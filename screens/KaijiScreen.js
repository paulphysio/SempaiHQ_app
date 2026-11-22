import React, { useState, useEffect, useContext, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  StatusBar,
  Animated,
  Easing,
  Modal,
  Vibration,
  AccessibilityInfo,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Orientation from 'react-native-orientation-locker';
import { Audio } from 'expo-av';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useAuth } from '../context/AuthContext';
import {
  getKaijiConfig,
  depositAndJoin,
  resumeMatch,
  submitPick as submitOnlinePick,
  cancelWaiting,
  getMatchState,
  getChallenge,
  watchMatch,
  clearSession,
} from '../services/kaijiApi';
import { getKaijiLeaderboard } from '../services/kaijiLeaderboard';
import { isOpen, isFinished, viewOf, roundForMe, roundMessage, endInfo, shortAddr } from '../services/kaijiMapping';
import { useTheme } from '../context/ThemeContext';
import { toast } from '../components/Toast';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ADMIN_ONLY = false; // the server-side wallet allowlist is the real gate; true also hides the screen from non-admins
const NORMAL_MODE_ENABLED = true; // needs the deployed `kaiji` edge function
const TOURNEY_ENABLED = false; // Tourney is not built yet
const WAGER_OPTIONS = [1, 5, 10, 25]; // tokens; filtered by the server's min/max

const CARD_BACK_SWIRL = require('../assets/kaiji/card-back-swirl.png');
const CARD_BACK_SEMPAI = require('../assets/kaiji/card-back-sempai.png');
const FACES = {
  R: require('../assets/kaiji/card-face-rock.png'),
  P: require('../assets/kaiji/card-face-paper.png'),
  S: require('../assets/kaiji/card-face-scissors.png'),
};
// Optional sounds. Add files under assets/kaiji/ and require them here.
const SOUNDS = { fanfare: null, lock: null, impact: null };

const FONT = 'Yoruka'; // already loaded in App.js

const COLORS = {
  ink: '#0a0807',
  ash: '#1d1713',
  line: '#3a2b22',
  ember: '#F36316',
  flame: '#ffb02e',
  bone: '#f4efe6',
  dim: '#a99b8d',
  bad: '#e0412f',
};

const KEYS = ['R', 'P', 'S'];
const CARDS = {
  R: { symbol: '', name: 'Rock', beats: 'S' },
  P: { symbol: '', name: 'Paper', beats: 'R' },
  S: { symbol: '', name: 'Scissors', beats: 'P' },
};
const START_HAND = { R: 4, P: 4, S: 4 };
const WINS_NEEDED = 3; // first to 3 round wins (best of 5)
const HAND_GAP = 8;
const NAMES = ['Ishida', 'Funai', 'Sahara', 'Tonegawa', 'Hyodo', 'Miyoshi'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const CARD_NAMES = { R: 'Rock', P: 'Paper', S: 'Scissors' };
const ERRORS = {
  not_allowed: 'This wallet is not enabled for Kaiji testing yet.',
  already_in_match: 'You already have an open match, or one whose refund is still being sent. Check the menu in a moment.',
  wager_out_of_range: 'That wager is outside the allowed range.',
  deposit_already_used: 'That deposit was already used.',
  deposit_tx_not_found: 'The deposit is not visible on-chain yet. Check the menu for your match in a moment.',
  deposit_amount_mismatch: 'The deposit amount did not match your wager.',
  deposit_memo_missing: 'The deposit was missing its Kaiji tag.',
  challenge_taken: 'Someone was faster — that challenge is already taken. Your wager was refunded to your wallet.',
  challenge_not_found: 'That challenge no longer exists.',
  'Password entry cancelled': 'Cancelled.',
};
const friendlyError = (m) => ERRORS[m] ?? m;
const total = (h) => h.R + h.P + h.S;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outcome = (a, b) => (a === b ? 0 : CARDS[a].beats === b ? 1 : -1); // 1 a wins, -1 b wins

const newGame = () => ({
  me: { ...START_HAND },
  bot: { ...START_HAND },
  w: 0,
  l: 0,
  round: 1,
  phase: 'intro', // intro | pick | locked | reveal
  res: null, // online only: win | lose | tie | idle for the round being revealed
  pick: null,
  myPlay: null,
  botPlay: null,
  botIn: false,
  msg: 'Get ready…',
  result: null,
});

async function playSound(key) {
  const src = SOUNDS[key];
  if (!src) return;
  try {
    const { sound } = await Audio.Sound.createAsync(src);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.didJustFinish) sound.unloadAsync();
    });
  } catch (e) {
    console.warn('[KaijiScreen] sound failed:', e.message);
  }
}

// AI picks BEFORE the reveal and only uses past information.
// easy = random. medium = studies remaining cards + past plays, counters ~55% of the time.
function aiChoose(level, botHand, playerHand, history) {
  const avail = KEYS.filter((k) => botHand[k] > 0);
  if (!avail.length) return null;
  const rand = () => avail[Math.floor(Math.random() * avail.length)];
  if (level === 'easy') return rand();
  const weight = { R: 0, P: 0, S: 0 };
  KEYS.forEach((k) => {
    weight[k] += playerHand[k];
  });
  history.forEach((k) => {
    weight[k] += 1.5;
  });
  const likely = KEYS.filter((k) => playerHand[k] > 0).sort((a, b) => weight[b] - weight[a])[0];
  const counter = KEYS.find((k) => CARDS[k].beats === likely);
  if (counter && botHand[counter] > 0 && Math.random() < 0.55) return counter;
  return rand();
}

function useTokenBalance(address, cfg, tick) {
  const [balance, setBalance] = useState(null);
  useEffect(() => {
    if (!address || !cfg) {
      setBalance(null);
      return undefined;
    }
    let dead = false;
    (async () => {
      try {
        const conn = new Connection(cfg.rpcUrl, 'confirmed');
        const ata = await getAssociatedTokenAddress(new PublicKey(cfg.mint), new PublicKey(address));
        const info = await conn.getAccountInfo(ata);
        const value = info ? Number(info.data.readBigUInt64LE(64)) / 10 ** cfg.decimals : 0;
        if (!dead) setBalance(value);
      } catch (e) {
        console.warn('[KaijiScreen] balance error:', e.message);
        if (!dead) setBalance(null);
      }
    })();
    return () => {
      dead = true;
    };
  }, [address, cfg, tick]);
  return balance;
}

// ---------------------------------------------------------------------------
// Visual pieces
// ---------------------------------------------------------------------------
const Face = ({ k, w }) => (
  <Image source={FACES[k]} style={{ width: w, height: w * 1.4, borderRadius: w * 0.06 }} resizeMode="cover" />
);

const Back = ({ w, src = CARD_BACK_SEMPAI }) => (
  <Image source={src} style={{ width: w, height: w * 1.4, borderRadius: w * 0.1 }} resizeMode="cover" />
);

const Embers = ({ w, h, rm }) => {
  const embers = useRef(
    Array.from({ length: 9 }, () => ({
      v: new Animated.Value(0),
      left: Math.random(),
      size: 3 + Math.random() * 4,
      dur: 4500 + Math.random() * 3500,
      delay: Math.random() * 4000,
    }))
  ).current;
  useEffect(() => {
    if (rm) return undefined;
    const loops = embers.map((e) => {
      const a = Animated.loop(
        Animated.sequence([
          Animated.delay(e.delay),
          Animated.timing(e.v, { toValue: 1, duration: e.dur, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(e.v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      a.start();
      return a;
    });
    return () => loops.forEach((a) => a.stop());
  }, [embers, rm]);
  if (rm) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {embers.map((e, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: e.left * w,
            bottom: 0,
            width: e.size,
            height: e.size,
            borderRadius: e.size / 2,
            backgroundColor: i % 2 ? COLORS.flame : COLORS.ember,
            opacity: e.v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.9, 0.5, 0] }),
            transform: [
              { translateY: e.v.interpolate({ inputRange: [0, 1], outputRange: [0, -h] }) },
              { translateX: e.v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 14, -10] }) },
            ],
          }}
        />
      ))}
    </View>
  );
};

const SpeedLines = ({ w, h }) => (
  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
    {Array.from({ length: 16 }).map((_, i) => (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: (i / 16) * w * 1.3 - 40,
          top: -h * 0.2,
          width: i % 3 === 0 ? 3 : 1.5,
          height: h * 1.6,
          backgroundColor: COLORS.ember,
          opacity: i % 3 === 0 ? 0.09 : 0.05,
          transform: [{ rotate: '22deg' }],
        }}
      />
    ))}
  </View>
);

// One-shot impact rays (driven by `progress` 0 -> 1)
const Burst = ({ progress, size }) => (
  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
    {Array.from({ length: 12 }).map((_, i) => (
      <Animated.View
        key={i}
        style={{
          position: 'absolute',
          width: size,
          height: i % 2 ? 3 : 6,
          backgroundColor: COLORS.flame,
          opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] }),
          transform: [
            { rotate: `${i * 15}deg` },
            { scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1.15] }) },
          ],
        }}
      />
    ))}
  </View>
);

// Slowly rotating sunburst for the victory screen
const Sunburst = ({ size, rm }) => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rm) return undefined;
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [rm, spin]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size,
            height: i % 2 ? 6 : 14,
            backgroundColor: COLORS.flame,
            opacity: i % 2 ? 0.1 : 0.16,
            transform: [{ rotate: `${i * 15}deg` }],
          }}
        />
      ))}
    </Animated.View>
  );
};

const Orb = ({ filled, color, size = 17 }) => {
  const s = useRef(new Animated.Value(filled ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(s, { toValue: filled ? 1 : 0, friction: 4, tension: 200, useNativeDriver: true }).start();
  }, [filled, s]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: filled ? color : COLORS.line,
        marginHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{ width: size - 7, height: size - 7, borderRadius: (size - 7) / 2, backgroundColor: color, transform: [{ scale: s }] }}
      />
    </View>
  );
};

const Orbs = ({ count, color }) => (
  <View style={{ flexDirection: 'row' }}>
    {Array.from({ length: WINS_NEEDED }, (_, i) => i).map((i) => (
      <Orb key={i} filled={i < count} color={color} />
    ))}
  </View>
);

const OppFan = ({ w, rm }) => {
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rm) return undefined;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [rm, breathe]);
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
      }}
    >
      {[-12, 0, 12].map((deg, i) => (
        <View key={i} style={{ marginLeft: i ? -w * 0.45 : 0, transform: [{ rotate: `${deg}deg` }] }}>
          <Back w={w} src={CARD_BACK_SWIRL} />
        </View>
      ))}
    </Animated.View>
  );
};

// Subcomponents below read the same themed styles as the screen. They used to
// reference an undefined `styles` and crashed the moment they rendered.
const useKaijiStyles = () => {
  const { isDark, colors } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getKaijiStyles(colors), [isDark]);
};

const Slot = ({ label, mode, k, w, h, flip, enter, resolve, state, side }) => {
  const styles = useKaijiStyles();
  const rotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });
  const enterX = enter.interpolate({ inputRange: [0, 1], outputRange: [side === 'bot' ? -80 : 80, 0] });
  const enterS = enter.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] });
  const scale = state === 'win' ? resolve.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) : 1;
  const ty = state === 'lose' ? resolve.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) : 0;
  const rot =
    state === 'lose'
      ? resolve.interpolate({ inputRange: [0, 1], outputRange: ['0deg', side === 'bot' ? '-7deg' : '7deg'] })
      : '0deg';
  const op = state === 'lose' ? resolve.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }) : 1;
  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={[
          { width: w, height: h, opacity: op, transform: [{ translateY: ty }, { rotate: rot }, { scale }] },
          state === 'win' && styles.glow,
        ]}
      >
        {mode === 'empty' && (
          <View style={[styles.slotEmpty, { borderRadius: w * 0.1 }]}>
            <Text style={styles.slotQ}>?</Text>
          </View>
        )}
        {mode === 'back' && (
          <Animated.View style={{ opacity: enter, transform: [{ translateX: enterX }, { scale: enterS }] }}>
            <Back w={w} />
          </Animated.View>
        )}
        {mode === 'face' && k && (
          <Animated.View style={{ transform: [{ perspective: 700 }, { rotateY }] }}>
            <Face k={k} w={w} />
          </Animated.View>
        )}
      </Animated.View>
      <Text style={styles.slotLabel}>{label}</Text>
    </View>
  );
};

const HandCard = ({ k, count, selected, dim, disabled, w, onPress }) => {
  const styles = useKaijiStyles();
  const lift = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    // Use timing instead of spring for faster, snappier response
    Animated.timing(lift, { toValue: selected ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [selected, lift]);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => Animated.timing(press, { toValue: 0.94, duration: 50, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(press, { toValue: 1, duration: 50, useNativeDriver: true }).start()}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${CARDS[k].name}, ${count} left`}
    >
      <Animated.View
        style={[
          {
            opacity: count === 0 ? 0.25 : dim ? 0.55 : 1,
            transform: [
              { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
              { scale: Animated.multiply(press, lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] })) },
            ],
          },
          selected && styles.glow,
        ]}
      >
        <Face k={k} w={w} />
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const LockButton = ({ label, enabled, onPress, rm }) => {
  const styles = useKaijiStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled || rm) {
      pulse.setValue(0);
      return undefined;
    }
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [enabled, rm, pulse]);
  return (
    <Pressable disabled={!enabled} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View
        style={[
          styles.lock,
          !enabled && styles.lockOff,
          { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }] },
        ]}
      >
        <Text style={styles.lockText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
};

const PulseCard = ({ w, rm }) => {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (rm) return undefined;
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [rm, p]);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
          { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
        ],
      }}
    >
      <Back w={w} src={CARD_BACK_SWIRL} />
    </Animated.View>
  );
};

const ModeTile = ({ title, tagline, badge, locked, onPress, children }) => {
  const styles = useKaijiStyles();
  return (
  <Pressable
    style={{ flex: 1 }}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${title}. ${tagline}${locked ? '. Coming soon' : ''}`}
  >
    <ImageBackground
      source={CARD_BACK_SWIRL}
      resizeMode="cover"
      imageStyle={{ opacity: locked ? 0.1 : 0.28, borderRadius: 18 }}
      style={[styles.tile, locked && styles.tileLocked]}
    >
      <View style={[styles.badge, locked && styles.badgeLocked]}>
        <Text style={[styles.badgeText, locked && { color: COLORS.dim }]}>{badge}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {children}
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileTag}>{tagline}</Text>
      </View>
    </ImageBackground>
  </Pressable>
  );
};

const Meter = ({ n }) => {
  const styles = useKaijiStyles();
  return (
  <View style={{ flexDirection: 'row', marginBottom: 8 }}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={[styles.meterDot, i < n && styles.meterOn]} />
    ))}
  </View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
const KaijiScreen = () => {
  const { isDark, colors } = useTheme();
  const styles = useMemo(() => getKaijiStyles(colors), [isDark]);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = walletContext?.isWalletConnected;
  const walletAddress = wallet?.publicKey ? wallet.publicKey.toString() : null;
  const signTransactionOnly = walletContext?.signTransactionOnly;
  const { user } = useAuth();
  const signedIn = !!user && !user.isGuest;

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('modes'); // modes | setup | wager | queue | play | leaderboard | challenge
  const route = useRoute();
  const [challenge, setChallenge] = useState(null); // { id, open, wager, decimals, expiresAt, challenger, record } being looked at
  const [level, setLevel] = useState('easy');
  const [opp, setOpp] = useState(NAMES[0]);
  const [g, setG] = useState(newGame());
  const [rm, setRm] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [mode, setMode] = useState('ai'); // 'ai' | 'online'
  const [cfg, setCfg] = useState(null);
  const [net, setNet] = useState(null); // latest { match, side, rounds } from the server
  const [wagerTokens, setWagerTokens] = useState(1);
  const [joining, setJoining] = useState(false);
  const [resumable, setResumable] = useState(null);
  const [pendingSettle, setPendingSettle] = useState(null); // a finished or cancelled match whose refund / payout is not confirmed yet
  const [now, setNow] = useState(Date.now());
  const [balTick, setBalTick] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const alive = useRef(true);
  const matchId = useRef(0);
  const history = useRef([]);
  const netRef = useRef({ match: null, side: null, rounds: [] });
  const handled = useRef(0); // resolved rounds already shown on screen
  const draining = useRef(false);
  const endShown = useRef(false);
  const stopWatch = useRef(null);
  const viewRef = useRef('modes');
  const modeRef = useRef('ai');
  const cfgRef = useRef(null);
  const onNetRef = useRef(() => {});

  const flip = useRef(new Animated.Value(1)).current;
  const enterMe = useRef(new Animated.Value(1)).current;
  const enterBot = useRef(new Animated.Value(1)).current;
  const resolve = useRef(new Animated.Value(0)).current;
  const impact = useRef(new Animated.Value(0)).current;
  const shakeV = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const bannerX = useRef(new Animated.Value(0)).current;
  const bannerO = useRef(new Animated.Value(0)).current;
  const slam = useRef(new Animated.Value(0)).current;
  const zawa = useRef(new Animated.Value(0)).current;

  const skrBalance = useTokenBalance(isAdmin || !ADMIN_ONLY ? walletAddress : null, cfg, balTick);

  // Landscape for this screen, portrait again when leaving
  useFocusEffect(
    useCallback(() => {
      Orientation.lockToLandscape();
      return () => {
        Orientation.lockToPortrait();
      };
    }, [])
  );

  useEffect(() => {
    alive.current = true;
    AccessibilityInfo.isReduceMotionEnabled().then(setRm).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setRm);
    return () => {
      alive.current = false;
      sub?.remove?.();
    };
  }, []);

  // Admin gate
  useEffect(() => {
    const check = async () => {
      try {
        if (!ADMIN_ONLY) {
          setIsAdmin(true);
          return;
        }
        if (!isWalletConnected || !walletAddress) {
          setIsAdmin(false);
          return;
        }
        const { data } = await supabase.from('users').select('isSuperuser').eq('wallet_address', walletAddress).single();
        setIsAdmin(data?.isSuperuser || false);
      } catch (e) {
        console.error('[KaijiScreen] Error checking admin status:', e);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [isWalletConnected, walletAddress]);

  // "zawa... zawa..." tension pulse while both cards are face down
  useEffect(() => {
    if (g.phase !== 'locked' || rm) {
      zawa.setValue(0);
      return undefined;
    }
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(zawa, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(zawa, { toValue: 0, duration: 420, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [g.phase, rm, zawa]);

  const L = useMemo(() => {
    const handH = clamp(H * 0.28, 78, 124);
    const handW = Math.floor(handH / 1.4);
    const rightW = handW * 3 + HAND_GAP * 2 + 24;
    const leftW = clamp(W * 0.16, 112, 160);
    const centerW = W - insets.left - insets.right - leftW - rightW - 24;
    const slotW = Math.floor(clamp(Math.min((H * 0.5) / 1.4, (centerW - 64) / 2), 70, 150));
    return { handW, rightW, leftW, centerW, slotW, slotH: Math.floor(slotW * 1.4) };
  }, [W, H, insets.left, insets.right]);

  const shakeIt = useCallback(
    (s) => {
      if (rm) return;
      shakeV.setValue(0);
      Animated.sequence(
        [1, -1, 0.7, -0.7, 0.35, 0].map((v) => Animated.timing(shakeV, { toValue: v * s, duration: 45, useNativeDriver: true }))
      ).start();
    },
    [rm, shakeV]
  );

  const impactFx = useCallback(
    (r) => {
      const s = r === 0 ? 0.5 : 1;
      if (!rm) {
        impact.setValue(0);
        Animated.timing(impact, { toValue: 1, duration: 560, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }
      shakeIt(s);
      flash.setValue(0.85 * (r === 0 ? 0.4 : 1));
      Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }).start();
      Animated.timing(resolve, { toValue: 1, duration: rm ? 0 : 350, useNativeDriver: true }).start();
      playSound('impact');
      Vibration.vibrate(r > 0 ? [0, 40, 30, 40] : r < 0 ? 140 : 25);
    },
    [rm, impact, shakeIt, flash, resolve]
  );

  const playBanner = useCallback(
    (text) =>
      new Promise((resolveP) => {
        setBannerText(text);
        const done = () => {
          bannerO.setValue(0);
          resolveP();
        };
        if (rm) {
          bannerX.setValue(0);
          Animated.sequence([
            Animated.timing(bannerO, { toValue: 1, duration: 150, useNativeDriver: true }),
            Animated.delay(650),
            Animated.timing(bannerO, { toValue: 0, duration: 150, useNativeDriver: true }),
          ]).start(done);
          return;
        }
        bannerX.setValue(W);
        bannerO.setValue(1);
        Animated.sequence([
          Animated.timing(bannerX, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.delay(520),
          Animated.timing(bannerX, { toValue: -W, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start(done);
      }),
    [rm, W, bannerX, bannerO]
  );

  const beginRound = useCallback(
    async (n) => {
      const mid = matchId.current;
      resolve.setValue(0);
      impact.setValue(0);
      setG((p) => ({ ...p, phase: 'intro', round: n, pick: null, myPlay: null, botPlay: null, botIn: false, res: null, msg: 'Get ready…' }));
      await playBanner(`ROUND ${n}`);
      if (!alive.current || mid !== matchId.current) return;
      setG((p) => ({ ...p, phase: 'pick', msg: 'Choose a card, then lock it in.' }));
    },
    [playBanner, resolve, impact]
  );

  const finish = useCallback(
    (result) => {
      setG((p) => ({ ...p, result }));
      slam.setValue(0);
      Animated.spring(slam, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
      shakeIt(result === 'win' ? 1 : 0.6);
      if (result === 'win') {
        Vibration.vibrate([0, 60, 40, 60, 40, 120]);
        playSound('fanfare');
      } else {
        Vibration.vibrate(220);
      }
    },
    [slam, shakeIt]
  );

  const startPractice = useCallback(
    (lvl) => {
      matchId.current += 1;
      stopWatch.current?.();
      stopWatch.current = null;
      endShown.current = false;
      setMode('ai');
      modeRef.current = 'ai';
      history.current = [];
      setLevel(lvl);
      setOpp(NAMES[Math.floor(Math.random() * NAMES.length)]);
      setG(newGame());
      setView('play');
      setTimeout(() => beginRound(1), 250);
    },
    [beginRound]
  );

  const leaveMatch = () => {
    if (modeRef.current === 'online') {
      Alert.alert(
        'Leave the match screen?',
        'The match keeps running. Any round you do not lock in before the timer ends is forfeited. You can resume it from the menu.',
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              stopWatch.current?.();
              stopWatch.current = null;
              matchId.current += 1;
              setView('modes');
            },
          },
        ]
      );
      return;
    }
    Alert.alert('Leave match?', 'Practice matches are free, so nothing is lost.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          matchId.current += 1;
          setView('modes');
        },
      },
    ]);
  };

  const connectPrompt = () =>
    Alert.alert('Connect your wallet', 'Connect or create a wallet to play for tokens.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Connect', onPress: () => navigation.navigate('WalletImport') },
    ]);

  const onNormal = () => {
    if (!NORMAL_MODE_ENABLED) return toast.info('Normal Mode is coming soon');
    if (!isWalletConnected) return connectPrompt();
    if (!cfg) return toast.error('Kaiji is offline — Could not reach the Kaiji server. Try again in a moment.');
    if (!cfg.allowed) return toast.error('Not enabled yet — Normal Mode is limited to test wallets right now.');
    setView('wager');
  };

  const onTourney = () => {
    if (!TOURNEY_ENABLED) return toast.info('Tourney Mode is coming soon — Tournaments will need a signed-in account and a connected wallet.');
    if (!signedIn) return toast.error('Sign in required — Tournaments are tied to your account as well as your wallet.');
    return toast.info('Tourney Mode — Connect this to the tournament lobby.');
  };

  const lockIn = useCallback(async () => {
    if (g.phase !== 'pick' || !g.pick) return;
    const mid = matchId.current;
    const stale = () => !alive.current || mid !== matchId.current;
    const mine = g.pick;
    const botPlay = aiChoose(level, g.bot, g.me, history.current);
    if (!botPlay) return finish('win');

    Vibration.vibrate(15);
    playSound('lock');
    enterMe.setValue(rm ? 1 : 0);
    enterBot.setValue(rm ? 1 : 0);
    flip.setValue(0);
    resolve.setValue(0);
    impact.setValue(0);
    setG((p) => ({ ...p, phase: 'locked', botIn: false, msg: 'Both players are locking in…' }));
    if (!rm) Animated.spring(enterMe, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();

    await sleep(rm ? 300 : 600);
    if (stale()) return;
    setG((p) => ({ ...p, botIn: true }));
    if (!rm) Animated.spring(enterBot, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
    Vibration.vibrate(10);

    await sleep(rm ? 600 : 1400);
    if (stale()) return;

    const r = outcome(mine, botPlay);
    const nw = g.w + (r > 0 ? 1 : 0);
    const nl = g.l + (r < 0 ? 1 : 0);
    const meLeft = total(g.me) - 1;
    const botLeft = total(g.bot) - 1;
    const msg =
      r === 0
        ? 'Tie. Both cards are gone. Replay the round.'
        : r > 0
        ? `${CARDS[mine].name} beats ${CARDS[botPlay].name}. You take the round.`
        : `${CARDS[botPlay].name} beats ${CARDS[mine].name}. ${opp} takes the round.`;

    history.current.push(mine);
    flip.setValue(rm ? 1 : 0);
    setG((p) => ({
      ...p,
      phase: 'reveal',
      myPlay: mine,
      botPlay,
      pick: null,
      me: { ...p.me, [mine]: p.me[mine] - 1 },
      bot: { ...p.bot, [botPlay]: p.bot[botPlay] - 1 },
      w: nw,
      l: nl,
      msg,
    }));
    if (!rm) Animated.timing(flip, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    await sleep(rm ? 0 : 380);
    if (stale()) return;
    impactFx(r);

    await sleep(2100);
    if (stale()) return;

    if (nw >= WINS_NEEDED || botLeft === 0) return finish('win');
    if (nl >= WINS_NEEDED || meLeft === 0) return finish('lose');
    beginRound(g.round + 1);
  }, [g, level, opp, rm, finish, beginRound, impactFx, enterMe, enterBot, flip, resolve, impact]);

  // ---------------- online (Normal Mode) ----------------
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);
  useEffect(
    () => () => {
      stopWatch.current?.();
    },
    []
  );

  // token, escrow, limits and whether this wallet may play
  useEffect(() => {
    if (!NORMAL_MODE_ENABLED || !walletAddress || (ADMIN_ONLY && !isAdmin)) return undefined;
    let dead = false;
    getKaijiConfig(walletAddress)
      .then((c) => !dead && setCfg(c))
      .catch((e) => {
        console.warn('[KaijiScreen] config failed:', e.message);
        if (!dead) setCfg(null);
      });
    return () => {
      dead = true;
    };
  }, [walletAddress, isAdmin]);

  // Load leaderboard when view changes to leaderboard
  useEffect(() => {
    if (view !== 'leaderboard') return undefined;
    setLoadingLeaderboard(true);
    getKaijiLeaderboard()
      .then((data) => {
        setLeaderboard(data);
        setLoadingLeaderboard(false);
      })
      .catch((e) => {
        console.error('[KaijiScreen] leaderboard failed:', e);
        setLeaderboard([]);
        setLoadingLeaderboard(false);
      });
  }, [view]);

  // On the menu: offer to resume an open match, or show that a refund / payout is still being finished.
  // Checking also nudges the server to retry a pending refund. The saved match is only forgotten once it is settled.
  useEffect(() => {
    if (view !== 'modes' || !NORMAL_MODE_ENABLED || (ADMIN_ONLY && !isAdmin)) return undefined;
    let dead = false;
    const check = async () => {
      const st = await resumeMatch();
      if (dead) return;
      if (st?.match && isOpen(st.match)) {
        if (isFinished(st.match)) {
          setPendingSettle(st);
          setResumable(null);
        } else {
          setResumable(st);
          setPendingSettle(null);
        }
      } else {
        if (st?.match?.status === 'settled') {
          await clearSession();
          setBalTick((t) => t + 1);
        }
        setResumable(null);
        setPendingSettle(null);
      }
    };
    check();
    const t = setInterval(check, 4000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [view, isAdmin]);

  // clock for the pick timer and the waiting countdown
  useEffect(() => {
    const ticking = view === 'queue' || view === 'challenge' || (mode === 'online' && view === 'play' && g.phase === 'pick');
    if (!ticking) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [mode, view, g.phase]);

  // the opponent's face-down card slides in as soon as the server says they locked
  useEffect(() => {
    if (mode !== 'online' || view !== 'play' || g.phase !== 'locked' || g.botIn || !net?.match) return;
    if (viewOf(net.match, net.side).lockedOpp) {
      setG((p) => ({ ...p, botIn: true }));
      enterBot.setValue(rm ? 1 : 0);
      if (!rm) Animated.spring(enterBot, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
    }
  }, [net, mode, view, g.phase, g.botIn, rm, enterBot]);

  const stopWatching = useCallback(() => {
    stopWatch.current?.();
    stopWatch.current = null;
  }, []);

  // show one server-resolved round: flip, impact, update hands and orbs
  const playReveal = useCallback(
    async (v, mid) => {
      const stale = () => !alive.current || mid !== matchId.current;
      flip.setValue(rm ? 1 : 0);
      resolve.setValue(0);
      impact.setValue(0);
      setG((p) => ({
        ...p,
        phase: 'reveal',
        res: v.res,
        myPlay: v.myCard,
        botPlay: v.oppCard,
        pick: null,
        me: v.myCard ? { ...p.me, [v.myCard]: p.me[v.myCard] - 1 } : p.me,
        bot: v.oppCard ? { ...p.bot, [v.oppCard]: p.bot[v.oppCard] - 1 } : p.bot,
        w: p.w + (v.res === 'win' ? 1 : 0),
        l: p.l + (v.res === 'lose' ? 1 : 0),
        msg: roundMessage(v, CARD_NAMES, opp),
      }));
      if (!rm) Animated.timing(flip, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      await sleep(rm ? 0 : 380);
      if (stale()) return;
      impactFx(v.res === 'win' ? 1 : v.res === 'lose' ? -1 : 0);
      await sleep(2100);
    },
    [rm, opp, flip, resolve, impact, impactFx]
  );

  // play every resolved round we have not shown yet, then either start the next round or end the match
  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    const mid = matchId.current;
    const stale = () => !alive.current || mid !== matchId.current;
    try {
      let played = false;
      for (;;) {
        const st = netRef.current;
        const r = st.rounds[handled.current];
        if (!r || stale()) break;
        handled.current += 1;
        played = true;
        await playReveal(roundForMe(r, st.side), mid);
      }
      if (stale()) return;
      const st = netRef.current;
      if (st.match && isFinished(st.match) && handled.current >= st.rounds.length) {
        if (!endShown.current && cfgRef.current) {
          endShown.current = true;
          finish(endInfo(st.match, st.side, cfgRef.current).kind);
        }
        return;
      }
      if (played && st.match?.status === 'active') beginRound(st.match.round);
    } finally {
      draining.current = false;
    }
  }, [playReveal, finish, beginRound]);

  const enterPlay = useCallback(
    (state) => {
      const m = state.match;
      const v = viewOf(m, state.side);
      handled.current = state.rounds.length; // anything already resolved was seen before (resume), a new match has 0
      endShown.current = false;
      setOpp(shortAddr(v.oppWallet));
      setG({ ...newGame(), me: v.hand, bot: v.oppHand, w: v.wins, l: v.oppWins, round: m.round });
      setView('play');
      if (!isFinished(m)) setTimeout(() => beginRound(m.round), 250);
    },
    [beginRound]
  );

  const onNetState = useCallback(
    (state) => {
      if (!state?.match) return;
      netRef.current = state;
      setNet(state);
      const m = state.match;
      if (viewRef.current === 'queue') {
        if (m.status === 'active') enterPlay(state);
        else if (isFinished(m)) {
          // nobody joined in time: the wager is refunded. Keep the saved match until the refund is confirmed,
          // so the menu can keep showing it.
          stopWatching();
          if (m.status === 'settled') clearSession();
          setView('modes');
          setBalTick((t) => t + 1);
          toast.info(`No opponent found — ${m.status === 'settled' ? 'Your wager was refunded to your wallet.' : 'Your wager is being refunded to your wallet.'}`);
        }
        return;
      }
      if (viewRef.current === 'play' && modeRef.current === 'online') drain();
      if (m.status === 'settled') {
        stopWatching();
        setBalTick((t) => t + 1);
      }
    },
    [enterPlay, stopWatching, drain]
  );
  useEffect(() => {
    onNetRef.current = onNetState;
  }, [onNetState]);

  const attachMatch = useCallback(
    (state) => {
      matchId.current += 1;
      endShown.current = false;
      history.current = [];
      stopWatching();
      netRef.current = state;
      setNet(state);
      setMode('online');
      modeRef.current = 'online';
      handled.current = state.rounds.length;
      if (state.match.status === 'waiting') setView('queue');
      else enterPlay(state);
      stopWatch.current = watchMatch(state.match.id, {
        onState: (st) => onNetRef.current(st),
        onError: (e) => console.warn('[KaijiScreen] poll failed:', e.message),
      });
    },
    [stopWatching, enterPlay]
  );

  // opts: {} quick match · { challenge: true } open a challenge · { challengeId, wagerUnits } accept one
  const startOnline = useCallback(async (opts = {}) => {
    if (joining) return;
    if (!isWalletConnected || !wallet || !signTransactionOnly) return connectPrompt();
    setJoining(true);
    try {
      const { match, side } = await depositAndJoin({ wallet, signTransactionOnly, wagerTokens, ...opts });
      attachMatch({ match, side, rounds: [] });
      if (opts.challenge && match.challenge) toast.success('Challenge sent — Kaiji players are being notified.');
    } catch (e) {
      if (e.message === 'challenge_taken') {
        setBalTick((t) => t + 1);
        setChallenge((c) => (c ? { ...c, open: false } : c));
      }
      toast.error(`Could not join — ${friendlyError(e.message)}`);
    } finally {
      setJoining(false);
    }
  }, [joining, isWalletConnected, wallet, signTransactionOnly, wagerTokens, attachMatch]);

  // Opened from a challenge notification: show who is challenging, then let them accept.
  const incomingChallenge = route.params?.challengeId;
  useEffect(() => {
    if (!incomingChallenge) return;
    navigation.setParams({ challengeId: undefined });
    if (viewRef.current === 'play' || viewRef.current === 'queue') {
      toast.info('Finish your current match first — then accept challenges.');
      return;
    }
    setChallenge({ id: incomingChallenge, loading: true });
    setView('challenge');
    getChallenge(incomingChallenge)
      .then((c) => alive.current && setChallenge(c))
      .catch((e) => alive.current && setChallenge({ id: incomingChallenge, open: false, error: friendlyError(e.message) }));
  }, [incomingChallenge]); // eslint-disable-line react-hooks/exhaustive-deps

  const acceptChallenge = useCallback(() => {
    const c = challenge;
    if (!c?.open) return;
    if (!cfg) return toast.error('Kaiji is offline — Could not reach the Kaiji server. Try again in a moment.');
    if (!cfg.allowed) return toast.error('Not enabled yet — Normal Mode is limited to test wallets right now.');
    startOnline({ challengeId: c.id, wagerUnits: c.wager });
  }, [challenge, cfg, startOnline]);

  const cancelQueue = useCallback(async () => {
    const m = netRef.current.match;
    if (!m) return setView('modes');
    try {
      const res = await cancelWaiting(m.id);
      stopWatching();
      if (res.status === 'settled') {
        await clearSession();
        setBalTick((t) => t + 1);
      } else {
        // refund sent but not confirmed yet, or it hit a problem: keep the saved match so the menu shows it
        toast.info(`Refund in progress — ${res.status === 'settle_failed'
            ? `The refund hit a problem and will be retried automatically.${res.error ? `\n\n${res.error}` : ''}`
            : 'Your wager is being refunded.'}`);
      }
      setView('modes');
    } catch (e) {
      if (e.message === 'cannot_cancel') return; // an opponent just joined; the next poll moves us into the match
      toast.error(`Could not cancel — ${friendlyError(e.message)}`);
    }
  }, [stopWatching]);

  const exitToModes = useCallback(async () => {
    if (modeRef.current === 'online') {
      stopWatching();
      if (netRef.current.match?.status === 'settled') await clearSession(); // otherwise the menu keeps showing the pending payout
      setBalTick((t) => t + 1);
    }
    setView('modes');
  }, [stopWatching]);

  const playAgainOnline = useCallback(async () => {
    stopWatching();
    setBalTick((t) => t + 1);
    if (netRef.current.match?.status !== 'settled') {
      setView('modes'); // the payout is still being sent: the menu shows its progress
      return;
    }
    await clearSession();
    setG(newGame());
    setView('wager');
  }, [stopWatching]);

  const lockInOnline = useCallback(async () => {
    const m = netRef.current.match;
    if (g.phase !== 'pick' || !g.pick || !m) return;

    // Check if deadline has passed
    const deadlineMs = m.round_deadline ? Date.parse(m.round_deadline) : 0;
    if (deadlineMs > 0 && Date.now() > deadlineMs) {
      setG((p) => ({ ...p, msg: 'Time ran out! Round forfeited.' }));
      // Refresh match state to get the server's timeout result
      try {
        onNetRef.current(await getMatchState(m.id));
      } catch (e) {
        console.error('[lockInOnline] Failed to refresh after timeout:', e);
      }
      return;
    }

    const card = g.pick;
    Vibration.vibrate(15);
    playSound('lock');
    enterMe.setValue(rm ? 1 : 0);
    setG((p) => ({ ...p, phase: 'locked', msg: 'Locked in. Waiting for your opponent…' }));
    if (!rm) Animated.spring(enterMe, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
    try {
      await submitOnlinePick(m.id, card);
      onNetRef.current(await getMatchState(m.id)); // do not wait for the next poll
    } catch (e) {
      if (e.message === 'already_locked') return;
      setG((p) => ({ ...p, phase: 'pick', msg: friendlyError(e.message) }));
    }
  }, [g.phase, g.pick, rm, enterMe]);

  // ----- gates -----
  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: COLORS.ember }]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  if (ADMIN_ONLY && !isAdmin) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: COLORS.ember }]}>
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedSub}>This page is only accessible to administrators</Text>
      </View>
    );
  }
  if (W < H) {
    return (
      <View style={[styles.root, styles.centered]}>
        <StatusBar hidden />
        <Text style={{ fontSize: 44 }}>📱</Text>
        <Text style={styles.rotateText}>Rotate your phone to landscape</Text>
      </View>
    );
  }

  const pad = {
    paddingLeft: Math.max(insets.left, 14),
    paddingRight: Math.max(insets.right, 14),
    paddingTop: Math.max(insets.top, 8),
    paddingBottom: Math.max(insets.bottom, 8),
  };

  const Header = ({ title, onBack, right }) => (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );

  const balancePill = (
    <View style={styles.balancePill}>
      <Text style={styles.balanceText}>
        {skrBalance === null ? '— SKR' : `${skrBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SKR`}
      </Text>
    </View>
  );

  // ----- mode select -----
  if (view === 'modes') {
    return (
      <View style={[styles.root, pad]}>
        <StatusBar hidden />
        <SpeedLines w={W} h={H} />
        <Embers w={W} h={H} rm={rm} />
        <Header
          title="Kaiji"
          onBack={() => navigation.goBack()}
          right={
            <View style={styles.balancePill}>
              <Text style={styles.balanceText}>
                {skrBalance === null ? '— SKR' : `${skrBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} SKR`}
              </Text>
            </View>
          }
        />
        {resumable && (
          <Pressable
            style={styles.resume}
            onPress={() => {
              attachMatch(resumable);
              setResumable(null);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.resumeText}>Match in progress. Tap to resume.</Text>
          </Pressable>
        )}
        {pendingSettle && (
          <View style={styles.pendingBar}>
            <Text style={styles.pendingText} numberOfLines={3}>
              {pendingSettle.match.status === 'settle_failed'
                ? `Your refund or payout hit a problem and is being retried.${pendingSettle.match.error ? ` (${pendingSettle.match.error})` : ''}`
                : 'Finishing your last match: refund or payout in progress…'}
            </Text>
          </View>
        )}
        <View style={styles.tiles}>
          <ModeTile title="Practice vs AI" tagline="Free. No tokens at stake. Easy or medium opponent." badge="PLAY" onPress={() => setView('setup')}>
            <Image source={FACES.R} style={styles.tileGlyph} />
          </ModeTile>
          <ModeTile
            title="Normal Mode"
            tagline={
              cfg && !cfg.allowed
                ? 'Limited to test wallets right now.'
                : `First to 3 round wins. ${cfg ? Number(cfg.minWager) / 10 ** cfg.decimals : 1} SKR minimum. 10% fee.`
            }
            badge={NORMAL_MODE_ENABLED && cfg?.allowed ? 'PLAY' : 'SOON'}
            locked={!(NORMAL_MODE_ENABLED && cfg?.allowed)}
            onPress={onNormal}
          >
            <Image source={FACES.S} style={styles.tileGlyph} />
          </ModeTile>
          <ModeTile
            title="Tourney Mode"
            tagline="6, 12 or 24 players. 25 $SKR minimum. Needs a signed-in account."
            badge="SOON"
            locked={!TOURNEY_ENABLED}
            onPress={onTourney}
          >
            <Image source={FACES.P} style={styles.tileGlyph} />
          </ModeTile>
        </View>
        <Pressable style={styles.leaderboardButton} onPress={() => setView('leaderboard')}>
          <Text style={styles.leaderboardButtonText}>🏆 View Leaderboard</Text>
        </Pressable>
        <Text style={styles.footnote}>
          4 Rock, 4 Paper, 4 Scissors each. Played cards are gone. Ties replay. First to 3 round wins takes the match.
        </Text>
      </View>
    );
  }

  // ----- leaderboard -----
  if (view === 'leaderboard') {
    return (
      <View style={[styles.root, pad]}>
        <StatusBar hidden />
        <SpeedLines w={W} h={H} />
        <Embers w={W} h={H} rm={rm} />
        <Header title="Kaiji Leaderboard" onBack={() => setView('modes')} />
        <View style={styles.leaderboardContainer}>
          {loadingLeaderboard ? (
            <ActivityIndicator size="large" color={COLORS.flame} />
          ) : leaderboard.length === 0 ? (
            <Text style={styles.leaderboardEmpty}>No matches yet. Be the first!</Text>
          ) : (
            <ScrollView style={styles.leaderboardScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.leaderboardHeader}>
                <Text style={styles.leaderboardHeaderRank}>#</Text>
                <Text style={styles.leaderboardHeaderPlayer}>Player</Text>
                <Text style={styles.leaderboardHeaderStats}>W-L</Text>
                <Text style={styles.leaderboardHeaderRate}>Win %</Text>
              </View>
              {leaderboard.map((entry) => (
                <View key={entry.wallet} style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardRank}>{entry.rank}</Text>
                  <View style={styles.leaderboardPlayer}>
                    {entry.image ? (
                      <Image source={{ uri: entry.image }} style={styles.leaderboardAvatar} />
                    ) : (
                      <View style={styles.leaderboardAvatarPlaceholder}>
                        <Text style={styles.leaderboardAvatarText}>
                          {(entry.name || entry.wallet)?.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.leaderboardName}>{entry.name || `${entry.wallet.slice(0, 6)}...${entry.wallet.slice(-4)}`}</Text>
                  </View>
                  <Text style={styles.leaderboardStats}>{entry.wins}-{entry.matches - entry.wins}</Text>
                  <Text style={styles.leaderboardRate}>{entry.win_rate.toFixed(1)}%</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    );
  }

  // ----- difficulty -----
  if (view === 'setup') {
    return (
      <View style={[styles.root, pad]}>
        <StatusBar hidden />
        <SpeedLines w={W} h={H} />
        <Embers w={W} h={H} rm={rm} />
        <Header title="Choose your opponent" onBack={() => setView('modes')} />
        <View style={styles.tiles}>
          <ModeTile title="Easy" tagline="Plays cards at random." badge="START" onPress={() => startPractice('easy')}>
            <Meter n={1} />
          </ModeTile>
          <ModeTile
            title="Medium"
            tagline="Watches your habits and remaining cards, then tries to counter you."
            badge="START"
            onPress={() => startPractice('medium')}
          >
            <Meter n={2} />
          </ModeTile>
        </View>
      </View>
    );
  }

  // ----- wager -----
  if (view === 'wager') {
    const dec = cfg?.decimals ?? 6;
    const minT = cfg ? Number(cfg.minWager) / 10 ** dec : 1;
    const maxT = cfg ? Number(cfg.maxWager) / 10 ** dec : 100;
    const options = WAGER_OPTIONS.filter((w) => w >= minT && w <= maxT);
    const feeRate = cfg ? cfg.feeBps / 10000 : 0.1;
    const afford = skrBalance === null || wagerTokens <= skrBalance;
    const fmt = (n) => `${Math.round(n * 100) / 100}`;
    return (
      <View style={[styles.root, pad]}>
        <StatusBar hidden />
        <SpeedLines w={W} h={H} />
        <Embers w={W} h={H} rm={rm} />
        <Header title="Normal Mode" onBack={() => setView('modes')} right={balancePill} />
        <View style={styles.wagerRow}>
          <View style={styles.wagerLeft}>
            <Text style={styles.sectionLabel}>CHOOSE YOUR WAGER</Text>
            <View style={styles.chips}>
              {options.map((w) => (
                <Pressable
                  key={w}
                  style={[styles.chip, wagerTokens === w && styles.chipOn]}
                  onPress={() => setWagerTokens(w)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: wagerTokens === w }}
                >
                  <Text style={[styles.chipText, wagerTokens === w && { color: COLORS.ink }]}>{w}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.pay}>
              <Text style={styles.payLabel}>Pot</Text>
              <Text style={styles.payVal}>{fmt(wagerTokens * 2)} SKR</Text>
              <Text style={styles.payLabel}>Sempai HQ fee ({Math.round(feeRate * 100)}%)</Text>
              <Text style={styles.payVal}>{fmt(wagerTokens * 2 * feeRate)} SKR</Text>
              <Text style={styles.payLabel}>You win</Text>
              <Text style={[styles.payVal, { color: COLORS.flame }]}>{fmt(wagerTokens * 2 * (1 - feeRate))} SKR</Text>
            </View>
          </View>
          <View style={styles.wagerRight}>
            <LockButton
              label={joining ? 'WAITING FOR WALLET…' : 'DEPOSIT & FIND OPPONENT'}
              enabled={!joining && afford}
              onPress={() => startOnline()}
              rm={rm}
            />
            <Pressable
              style={[styles.challengeBtn, (!afford || joining) && { opacity: 0.45 }]}
              onPress={() => (!joining && afford ? startOnline({ challenge: true }) : null)}
              accessibilityRole="button"
              accessibilityLabel={`Challenge everyone for ${wagerTokens} SKR`}
            >
              <Text style={styles.challengeBtnText}>⚔️  CHALLENGE EVERYONE</Text>
            </Pressable>
            {!afford && <Text style={styles.warn}>Not enough balance for this wager.</Text>}
            <Text style={styles.note}>
              Your wager is held by the Kaiji escrow wallet and paid out when the match ends. Quick match: refunded if nobody joins within{' '}
              {cfg?.waitingSeconds ?? 45}s. Challenge: Kaiji players get a notification with your wager and record — first to accept plays; refunded after{' '}
              {Math.round((cfg?.challengeSeconds ?? 180) / 60)} min.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ----- waiting for an opponent -----
  if (view === 'queue') {
    const m = net?.match;
    const isChallenge = !!m?.challenge;
    const waitMs = (cfg?.waitingSeconds ?? 45) * 1000;
    const endsAt = isChallenge && m?.expires_at ? new Date(m.expires_at).getTime() : m ? new Date(m.created_at).getTime() + waitMs : 0;
    const secs = m ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
    const clock = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs}s`;
    const dec = cfg?.decimals ?? 6;
    return (
      <View style={[styles.root, pad, styles.centered]}>
        <StatusBar hidden />
        <SpeedLines w={W} h={H} />
        <Embers w={W} h={H} rm={rm} />
        <PulseCard w={Math.min(110, H * 0.28)} rm={rm} />
        <Text style={styles.queueTitle}>{isChallenge ? 'Challenge sent ⚔️' : 'Waiting for an opponent…'}</Text>
        <Text style={styles.queueSub}>
          {isChallenge ? 'Kaiji players were notified — the first to accept plays you. ' : ''}
          Wager {m ? Math.round((Number(m.wager) / 10 ** dec) * 100) / 100 : wagerTokens} SKR · refund in {clock} if nobody joins
        </Text>
        <Pressable style={styles.ghost} onPress={cancelQueue} accessibilityRole="button">
          <Text style={styles.ghostText}>Cancel and refund</Text>
        </Pressable>
      </View>
    );
  }

  // ----- someone challenged you (opened from the notification) -----
  if (view === 'challenge') {
    const c = challenge || {};
    const dec = c.decimals ?? cfg?.decimals ?? 6;
    const wagerT = c.wager ? Math.round((Number(c.wager) / 10 ** dec) * 100) / 100 : null;
    const feeRate = cfg ? cfg.feeBps / 10000 : 0.1;
    const secs = c.expiresAt ? Math.max(0, Math.ceil((new Date(c.expiresAt).getTime() - now) / 1000)) : null;
    const clock = secs == null ? '' : secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : `${secs}s`;
    const open = !!c.open && (secs == null || secs > 0);
    const afford = skrBalance === null || wagerT == null || wagerT <= skrBalance;
    const rec = c.record || { wins: 0, losses: 0, draws: 0 };
    const played = rec.wins + rec.losses + rec.draws;
    return (
      <View style={[styles.root, pad]}>
        <StatusBar hidden />
        <SpeedLines w={W} h={H} />
        <Embers w={W} h={H} rm={rm} />
        <Header title="Challenge" onBack={() => { setChallenge(null); setView('modes'); }} right={balancePill} />
        {c.loading ? (
          <View style={[styles.centered, { flex: 1 }]}><ActivityIndicator color={COLORS.flame} /></View>
        ) : (
          <View style={styles.wagerRow}>
            <View style={styles.wagerLeft}>
              <Text style={styles.sectionLabel}>{open ? 'YOU HAVE BEEN CHALLENGED' : 'CHALLENGE CLOSED'}</Text>
              <Text style={styles.challenger} numberOfLines={1}>{c.challenger?.name || 'A Kaiji player'}</Text>
              <Text style={styles.record}>
                {played ? `${rec.wins}W · ${rec.losses}L${rec.draws ? ` · ${rec.draws}D` : ''}` : 'No matches played yet'}
              </Text>
              {wagerT != null ? (
                <View style={styles.pay}>
                  <Text style={styles.payLabel}>Wager (each)</Text>
                  <Text style={styles.payVal}>{wagerT} SKR</Text>
                  <Text style={styles.payLabel}>You win</Text>
                  <Text style={[styles.payVal, { color: COLORS.flame }]}>{Math.round(wagerT * 2 * (1 - feeRate) * 100) / 100} SKR</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.wagerRight}>
              {open ? (
                <>
                  <LockButton
                    label={joining ? 'WAITING FOR WALLET…' : `ACCEPT · DEPOSIT ${wagerT} SKR`}
                    enabled={!joining && afford}
                    onPress={acceptChallenge}
                    rm={rm}
                  />
                  {!afford && <Text style={styles.warn}>Not enough SKR for this wager.</Text>}
                  <Text style={styles.note}>
                    First to accept plays — {clock} left. If someone beats you to it, your deposit comes straight back.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.queueSub, { textAlign: 'center' }]}>
                    {c.error || (c.status === 'active' || c.status === 'settling' || c.status === 'settled'
                      ? 'Someone was faster — this challenge was already accepted.'
                      : 'This challenge has expired.')}
                  </Text>
                  <Pressable style={styles.ghost} onPress={() => { setChallenge(null); setView('wager'); }} accessibilityRole="button">
                    <Text style={styles.ghostText}>Issue your own challenge</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    );
  }

  // ----- play -----
  const rr = g.myPlay && g.botPlay ? outcome(g.myPlay, g.botPlay) : null;
  const revealing = g.phase === 'reveal';
  const res = g.res ?? (rr === null ? null : rr > 0 ? 'win' : rr < 0 ? 'lose' : 'tie');
  const meState = revealing && res === 'win' ? 'win' : revealing && res === 'lose' ? 'lose' : null;
  const botState = revealing && res === 'win' ? 'lose' : revealing && res === 'lose' ? 'win' : null;
  const meMode = revealing ? (g.myPlay ? 'face' : 'empty') : g.phase === 'locked' ? 'back' : 'empty';
  const botMode = revealing ? (g.botPlay ? 'face' : 'empty') : g.phase === 'locked' && g.botIn ? 'back' : 'empty';
  const online = mode === 'online';
  const oppLocked = online && net?.match ? viewOf(net.match, net.side).lockedOpp : false;
  const deadlineMs = online && net?.match?.round_deadline ? Date.parse(net.match.round_deadline) : 0;
  const timerPct = deadlineMs ? clamp(((deadlineMs - now) / ((cfg?.pickSeconds ?? 25) * 1000)) * 100, 0, 100) : 0;
  const endSub =
    online && net?.match && cfg
      ? endInfo(net.match, net.side, cfg).sub
      : g.result === 'win'
      ? 'You won the practice match.'
      : `${opp} took this one. Try again.`;
  const canPick = g.phase === 'pick' && !g.result;
  const botLeft = total(g.bot);
  const deadlinePassed = online && deadlineMs > 0 && Date.now() > deadlineMs;

  return (
    <View style={[styles.root, pad]}>
      <StatusBar hidden />
      <Animated.View
        style={[
          styles.stage,
          {
            transform: [
              { translateX: shakeV.interpolate({ inputRange: [-1, 1], outputRange: [-14, 14] }) },
              { translateY: shakeV.interpolate({ inputRange: [-1, 1], outputRange: [7, -7] }) },
            ],
          },
        ]}
      >
        <SpeedLines w={W} h={H} />
        <Embers w={W} h={H} rm={rm} />

        <View style={styles.topBar}>
          <Pressable onPress={leaveMatch} style={styles.backBtnSm} accessibilityRole="button" accessibilityLabel="Leave match">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.hudText}>
            {online ? 'NORMAL MODE' : `PRACTICE · ${level === 'easy' ? 'EASY' : 'MEDIUM'}`} · ROUND {g.round}
          </Text>
          <View style={{ width: 36 }} />
        </View>
        {online && g.phase === 'pick' && deadlineMs > 0 && (
          <View style={styles.timer}>
            <View style={[styles.timerFill, { width: `${timerPct}%`, backgroundColor: timerPct < 25 ? COLORS.bad : COLORS.flame }]} />
          </View>
        )}

        <View style={styles.row}>
          {/* Opponent */}
          <View style={[styles.sidePanel, { width: L.leftW }]}>
            <Text style={styles.sideName}>{opp.toUpperCase()}</Text>
            <Orbs count={g.l} color={COLORS.bad} />
            <View style={{ marginVertical: 10 }}>
              <OppFan w={Math.floor(L.leftW * 0.34)} rm={rm} />
            </View>
            <Text style={styles.sideSub}>{botLeft} cards left</Text>
            {oppLocked && g.phase === 'pick' && <Text style={styles.lockedTag}>● LOCKED IN</Text>}
          </View>

          {/* Arena */}
          <View style={styles.center}>
            <View style={styles.arenaRow}>
              <Burst progress={impact} size={Math.min(L.centerW, 360)} />
              <Slot
                label={opp}
                side="bot"
                mode={botMode}
                k={g.botPlay}
                w={L.slotW}
                h={L.slotH}
                flip={flip}
                enter={enterBot}
                resolve={resolve}
                state={botState}
              />
              <View style={styles.vs}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <Slot
                label="You"
                side="me"
                mode={meMode}
                k={g.myPlay}
                w={L.slotW}
                h={L.slotH}
                flip={flip}
                enter={enterMe}
                resolve={resolve}
                state={meState}
              />
              {g.phase === 'locked' && (
                <>
                  <Animated.Text
                    style={[
                      styles.zawa,
                      { top: 0, left: 0, transform: [{ rotate: '-8deg' }] },
                      { opacity: rm ? 1 : zawa.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                    ]}
                  >
                    ざわ…
                  </Animated.Text>
                  <Animated.Text
                    style={[
                      styles.zawa,
                      { bottom: 0, right: 0, transform: [{ rotate: '6deg' }] },
                      { opacity: rm ? 1 : zawa.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) },
                    ]}
                  >
                    ざわ…
                  </Animated.Text>
                </>
              )}
              {revealing && (
                <Animated.Text
                  pointerEvents="none"
                  style={[
                    styles.don,
                    {
                      opacity: impact.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                      transform: [
                        { rotate: '-10deg' },
                        { scale: impact.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1.5, 1.15] }) },
                      ],
                    },
                  ]}
                >
                  ドンッ!
                </Animated.Text>
              )}
            </View>
            <View style={styles.caption}>
              <Text style={styles.captionText} accessibilityLiveRegion="polite" numberOfLines={2}>
                {g.msg}
              </Text>
            </View>
          </View>

          {/* You */}
          <View style={[styles.sidePanel, { width: L.rightW }]}>
            <View style={styles.youHead}>
              <Text style={styles.sideName}>YOU</Text>
              <Orbs count={g.w} color={COLORS.flame} />
            </View>
            <View style={styles.hand}>
              {KEYS.map((k) => (
                <HandCard
                  key={k}
                  k={k}
                  w={L.handW}
                  count={g.me[k]}
                  selected={g.pick === k}
                  dim={!canPick}
                  disabled={!canPick || g.me[k] === 0}
                  onPress={() => {
                    Vibration.vibrate(8);
                    setG((p) => ({ ...p, pick: k }));
                  }}
                />
              ))}
            </View>
            <LockButton
              label={deadlinePassed ? 'TIME UP' : g.pick ? `LOCK IN ${CARDS[g.pick].name.toUpperCase()}` : 'PICK A CARD'}
              enabled={canPick && !!g.pick && !deadlinePassed}
              onPress={online ? lockInOnline : lockIn}
              rm={rm}
            />
          </View>
        </View>
      </Animated.View>

      {/* Impact flash */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.flame, opacity: flash }]} />

      {/* Round banner */}
      <Animated.View
        pointerEvents="none"
        style={[styles.bannerWrap, { opacity: bannerO, transform: [{ translateX: bannerX }] }]}
      >
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{bannerText}</Text>
        </View>
      </Animated.View>

      {/* Match end */}
      <Modal
        visible={!!g.result}
        transparent
        animationType="fade"
        statusBarTranslucent
        supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={exitToModes}
      >
        <View style={styles.overlay}>
          {g.result === 'win' && <Sunburst size={Math.max(W, H) * 0.95} rm={rm} />}
          <View style={styles.endRow}>
            <View style={styles.endLeft}>
              <Animated.Text
                style={[
                  styles.endTitle,
                  g.result === 'lose' && { color: COLORS.bad },
                  {
                    opacity: slam,
                    transform: [{ rotate: '-3deg' }, { scale: slam.interpolate({ inputRange: [0, 1], outputRange: [3, 1] }) }],
                  },
                ]}
              >
                {g.result === 'win' ? 'Kaiji!' : g.result === 'draw' ? 'Draw' : 'Crushed'}
              </Animated.Text>
              <Text style={styles.endSub}>
                {endSub}
              </Text>
            </View>
            <View style={styles.endRight}>
              <LockButton label="PLAY AGAIN" enabled onPress={() => (online ? playAgainOnline() : startPractice(level))} rm={rm} />
              <Pressable style={styles.ghost} onPress={exitToModes} accessibilityRole="button">
                <Text style={styles.ghostText}>Back to modes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export const getKaijiStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
  centered: { alignItems: 'center', justifyContent: 'center' },
  deniedTitle: { color: c.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  deniedSub: { color: c.textPrimary, fontSize: 16, opacity: 0.8 },
  rotateText: { color: COLORS.bone, fontSize: 18, marginTop: 12 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headerTitle: { fontFamily: FONT, color: COLORS.ember, fontSize: 40, marginLeft: 12, transform: [{ rotate: '-2deg' }] },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.ash, alignItems: 'center', justifyContent: 'center' },
  backBtnSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.ash, alignItems: 'center', justifyContent: 'center' },
  backText: { color: COLORS.bone, fontSize: 26, lineHeight: 30 },
  balancePill: { backgroundColor: COLORS.ash, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.line },
  balanceText: { color: COLORS.flame, fontWeight: '700' },

  tiles: { flex: 1, flexDirection: 'row', gap: 12, marginVertical: 8 },
  tile: { flex: 1, borderRadius: 18, borderWidth: 2, borderColor: COLORS.ember, backgroundColor: COLORS.ash, padding: 14, overflow: 'hidden' },
  tileLocked: { borderColor: COLORS.line },
  tileGlyph: { width: 40, height: 56, borderRadius: 5, marginBottom: 8 },
  tileTitle: { fontFamily: FONT, color: COLORS.bone, fontSize: 24 },
  tileTag: { color: COLORS.dim, fontSize: 13, marginTop: 4 },
  badge: { position: 'absolute', top: 12, right: 12, backgroundColor: COLORS.ember, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, zIndex: 2 },
  badgeLocked: { backgroundColor: COLORS.ink, borderWidth: 1, borderColor: COLORS.line },
  badgeText: { color: c.bgElevated, fontWeight: '800', fontSize: 12 },
  footnote: { color: COLORS.dim, fontSize: 12, textAlign: 'center' },
  meterDot: { width: 22, height: 8, borderRadius: 4, backgroundColor: COLORS.line, marginRight: 5 },
  meterOn: { backgroundColor: COLORS.flame },

  stage: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 38 },
  hudText: { color: COLORS.dim, fontSize: 12, letterSpacing: 1.5 },
  timer: { position: 'absolute', left: 0, right: 0, top: 36, height: 4, backgroundColor: COLORS.line, borderRadius: 2, overflow: 'hidden' },
  timerFill: { height: 4 },
  lockedTag: { color: COLORS.flame, fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 1 },
  resume: { backgroundColor: COLORS.ember, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 6 },
  resumeText: { color: c.bgElevated, fontWeight: '800' },
  pendingBar: { backgroundColor: COLORS.ash, borderLeftWidth: 4, borderLeftColor: COLORS.ember, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 6 },
  pendingText: { color: COLORS.bone, fontSize: 12 },
  wagerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 24 },
  wagerLeft: { flex: 1.2 },
  wagerRight: { flex: 1, alignItems: 'center', gap: 12 },
  sectionLabel: { color: COLORS.dim, fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  chip: { minWidth: 56, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderColor: COLORS.line, backgroundColor: COLORS.ash, alignItems: 'center' },
  chipOn: { backgroundColor: COLORS.flame, borderColor: COLORS.flame },
  chipText: { color: COLORS.bone, fontSize: 18, fontWeight: '800' },
  pay: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: COLORS.ash, borderRadius: 12, borderWidth: 1, borderColor: COLORS.line, padding: 12 },
  payLabel: { color: COLORS.dim, width: '60%', fontSize: 14, marginVertical: 3 },
  payVal: { color: COLORS.bone, width: '40%', textAlign: 'right', fontWeight: '800', fontSize: 14, marginVertical: 3 },
  warn: { color: COLORS.bad, fontWeight: '700' },
  note: { color: COLORS.dim, fontSize: 12, textAlign: 'center', maxWidth: 300 },
  queueTitle: { fontFamily: FONT, color: COLORS.bone, fontSize: 28, marginTop: 18 },
  challengeBtn: { borderWidth: 1.5, borderColor: COLORS.flame, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' },
  challengeBtnText: { color: COLORS.flame, fontWeight: '800', letterSpacing: 1.2, fontSize: 14 },
  challenger: { fontFamily: FONT, color: COLORS.bone, fontSize: 30 },
  record: { color: COLORS.flame, fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 10, letterSpacing: 1 },
  queueSub: { color: COLORS.dim, fontSize: 14, marginTop: 6, marginBottom: 8 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sidePanel: { alignItems: 'center', justifyContent: 'center' },
  sideName: { fontFamily: FONT, color: COLORS.bone, fontSize: 18, marginBottom: 4 },
  sideSub: { color: COLORS.dim, fontSize: 12 },
  youHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 6, marginBottom: 10 },
  hand: { flexDirection: 'row', gap: HAND_GAP, marginBottom: 10, paddingTop: 12 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  arenaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  vs: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.ember, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.ink },
  vsText: { fontFamily: FONT, color: COLORS.ink, fontSize: 20 },
  slotEmpty: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  slotQ: { color: COLORS.line, fontSize: 40, fontWeight: '900' },
  slotLabel: { color: COLORS.dim, fontSize: 11, marginTop: 6 },
  caption: { marginTop: 12, borderLeftWidth: 4, borderLeftColor: COLORS.ember, backgroundColor: 'rgba(29,23,19,0.9)', paddingVertical: 6, paddingHorizontal: 12, maxWidth: 380 },
  captionText: { color: COLORS.bone, fontSize: 14, fontWeight: '700' },
  zawa: { position: 'absolute', color: COLORS.bone, fontSize: 30, fontWeight: '900', textShadowColor: COLORS.ember, textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 } },
  don: { position: 'absolute', alignSelf: 'center', color: COLORS.flame, fontSize: 56, fontWeight: '900', textShadowColor: c.bgElevated, textShadowRadius: 6, textShadowOffset: { width: 3, height: 3 } },

  glow: { shadowColor: COLORS.ember, shadowOpacity: 0.95, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  count: { position: 'absolute', top: -8, right: -6, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.ember, borderWidth: 2, borderColor: COLORS.ink, alignItems: 'center', justifyContent: 'center' },
  countText: { color: c.bgElevated, fontWeight: '800', fontSize: 12 },

  lock: { backgroundColor: COLORS.ember, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', minWidth: 200, borderWidth: 2, borderColor: COLORS.flame },
  lockOff: { opacity: 0.4 },
  lockText: { fontFamily: FONT, color: c.bgElevated, fontSize: 16, letterSpacing: 1 },

  bannerWrap: { position: 'absolute', left: 0, right: 0, top: '38%', alignItems: 'center' },
  banner: { alignSelf: 'stretch', backgroundColor: COLORS.ember, paddingVertical: 10, alignItems: 'center', borderTopWidth: 4, borderBottomWidth: 4, borderColor: COLORS.flame, transform: [{ skewX: '-12deg' }] },
  bannerText: { fontFamily: FONT, color: COLORS.ink, fontSize: 46, letterSpacing: 4, transform: [{ skewX: '12deg' }] },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  endRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: '6%' },
  endLeft: { flex: 1.3 },
  endRight: { flex: 1, alignItems: 'center', gap: 10 },
  endTitle: { fontFamily: FONT, color: COLORS.flame, fontSize: 84, textShadowColor: COLORS.ember, textShadowRadius: 28, textShadowOffset: { width: 0, height: 4 } },
  endSub: { color: COLORS.bone, fontSize: 16, marginTop: 4 },
  ghost: { padding: 10 },
  ghostText: { color: COLORS.dim, fontSize: 15 },

  leaderboardButton: { backgroundColor: COLORS.ember, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  leaderboardButtonText: { color: c.bgElevated, fontWeight: '800', fontSize: 16 },
  leaderboardContainer: { flex: 1, backgroundColor: COLORS.ash, borderRadius: 18, borderWidth: 2, borderColor: COLORS.line, padding: 16 },
  leaderboardScroll: { flex: 1 },
  leaderboardEmpty: { color: COLORS.dim, fontSize: 16, textAlign: 'center', marginTop: 40 },
  leaderboardHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.line, marginBottom: 8 },
  leaderboardHeaderRank: { width: 40, color: COLORS.dim, fontSize: 12, fontWeight: '800' },
  leaderboardHeaderPlayer: { flex: 1, color: COLORS.dim, fontSize: 12, fontWeight: '800' },
  leaderboardHeaderStats: { width: 60, color: COLORS.dim, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  leaderboardHeaderRate: { width: 60, color: COLORS.dim, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(58,43,34,0.5)' },
  leaderboardRank: { width: 40, color: COLORS.bone, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  leaderboardPlayer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderboardAvatar: { width: 32, height: 32, borderRadius: 16 },
  leaderboardAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.ember, alignItems: 'center', justifyContent: 'center' },
  leaderboardAvatarText: { color: c.bgElevated, fontWeight: '800', fontSize: 14 },
  leaderboardName: { color: COLORS.bone, fontSize: 14, flex: 1 },
  leaderboardStats: { width: 60, color: COLORS.bone, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  leaderboardRate: { width: 60, color: COLORS.flame, fontSize: 14, fontWeight: '700', textAlign: 'right' },
});

export default KaijiScreen;
