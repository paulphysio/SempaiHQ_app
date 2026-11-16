import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  Clipboard,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from '../components/ConnectButtonEnhanced';
import { useTheme } from '../context/ThemeContext';
import AutopaySettings from '../components/AutopaySettings';
import pioneerBadgeImg from '../assets/Pioneer.png';
import { getUserReadingTime, formatReadingTime } from '../hooks/useReadingTimer';
import { getProfileMangaStyles, getProfilePalette, INK } from '../styles/ProfileStyles';
import {
  useReduceMotion,
  PressScale,
  StaggerIn,
  MangaPanel,
  Halftone,
  SpeedLines,
  SakuraField,
  CountUp,
  SfxText,
  SlashBanner,
  ShineSweep,
  InkBar,
  SpeechBubble,
  InkButton,
} from '../components/MangaUI';
import { toast } from '../components/Toast';

// ---------------------------------------------------------------------------------------------
// Cosmetic "reader rank", derived from total reading time. Thresholds are in seconds; tweak freely.
// ---------------------------------------------------------------------------------------------
export const READER_RANKS = [
  { min: 0, title: 'Wandering Reader', jp: '旅人' },
  { min: 3600, title: 'Apprentice Scribe', jp: '見習い' },
  { min: 18000, title: 'Ink Disciple', jp: '弟子' },
  { min: 72000, title: 'Blade of Stories', jp: '剣士' },
  { min: 180000, title: 'Master of Tales', jp: '達人' },
  { min: 360000, title: 'Legend of the Archive', jp: '伝説' },
];

export function getReaderRank(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  let idx = 0;
  for (let i = 0; i < READER_RANKS.length; i++) if (sec >= READER_RANKS[i].min) idx = i;
  const cur = READER_RANKS[idx];
  const next = READER_RANKS[idx + 1] || null;
  const progress = next ? (sec - cur.min) / (next.min - cur.min) : 1;
  return {
    level: idx + 1,
    cur,
    next,
    progress: Math.max(0, Math.min(1, progress)),
    remaining: next ? Math.max(0, next.min - sec) : 0,
  };
}

// Only open links we can vouch for.
const TWITTER_RE = /^[A-Za-z0-9_]{1,15}$/;
export function buildTwitterUrl(handle) {
  const h = String(handle || '').trim().replace(/^@/, '');
  return TWITTER_RE.test(h) ? `https://x.com/${h}` : null;
}
export function buildWebsiteUrl(site) {
  const s = String(site || '').trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[a-z][a-z0-9+.-]*:/i.test(s) ? null : `https://${s}`;
  return withScheme && /^https?:\/\/[^\s]+$/i.test(withScheme) ? withScheme : null;
}

const EMPTY_STATS = { total_seconds: 0, total_chapters: 0, total_novels: 0, last_read_at: null };

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { userId } = route.params || {};
  const walletContext = useContext(EmbeddedWalletContext);
  const wallet = walletContext?.wallet;
  const isWalletConnected = !!wallet?.publicKey;
  const activeWalletAddress = wallet?.publicKey?.toString();
  const { isDark } = useTheme();
  const palette = useMemo(() => getProfilePalette(isDark), [isDark]);
  const styles = useMemo(() => getProfileMangaStyles(isDark), [isDark]);
  const reduceMotion = useReduceMotion();

  const [creatorData, setCreatorData] = useState(null);
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isWriter, setIsWriter] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isBenefactor, setIsBenefactor] = useState(false);
  const [benefactorLevel, setBenefactorLevel] = useState(null);
  const [isPioneer, setIsPioneer] = useState(false);
  const [userBadges, setUserBadges] = useState([]);
  const [readingStats, setReadingStats] = useState(EMPTY_STATS);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  // ------------------------------------------------------------------ data
  const reqRef = useRef(0);
  const copiedTimer = useRef(null);

  const getUserIdByWallet = useCallback(async (walletAddress) => {
    try {
      const { data } = await supabase.from('users').select('id').eq('wallet_address', walletAddress).single();
      return data?.id;
    } catch {
      return null;
    }
  }, []);

  const loadProfile = useCallback(
    async ({ silent = false } = {}) => {
      const req = ++reqRef.current;
      const alive = () => req === reqRef.current; // newer request or unmount invalidates this one

      if (!isWalletConnected && !userId) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');

      try {
        const targetUserId = userId || (activeWalletAddress ? await getUserIdByWallet(activeWalletAddress) : null);
        if (!alive()) return;
        if (!targetUserId) {
          setError('No user ID provided. Please connect your wallet or navigate with a user ID.');
          return;
        }

        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, isWriter, isArtist, isSuperuser, name, wallet_address, image, is_benefactor, benefactor_level')
          .eq('id', targetUserId)
          .single();
        if (userError || !user) throw new Error('User not found');

        // Secondary data loads in parallel; a failure in one of them must not blank the whole profile.
        const [badgesRes, profileRes, novelsRes, readingRes] = await Promise.all([
          supabase.from('user_badges').select('*, badges(*)').eq('user_id', user.id),
          supabase.from('writer_profiles').select('bio, twitter, discord, website').eq('user_id', user.id).maybeSingle(),
          supabase.from('novels').select('id, title, image, summary').eq('user_id', user.id).eq('is_visible', true),
          Promise.resolve(getUserReadingTime(user.id)).catch(() => null),
        ]);
        if (!alive()) return;

        const badgeRows = Array.isArray(badgesRes?.data) ? badgesRes.data : [];
        const normalised = badgeRows
          .filter((b) => b?.badges)
          .map((b) => ({
            id: b.id || b.badge_id,
            name: b.badges.name || 'Badge',
            type: b.badges.type || null,
            image_url: b.badges.image_url || null,
            acquired_at: b.acquired_at || null,
          }))
          .sort((a, b) => new Date(b.acquired_at || 0) - new Date(a.acquired_at || 0));

        setIsWriter(!!user.isWriter);
        setIsArtist(!!user.isArtist);
        setIsSuperuser(!!user.isSuperuser);
        setIsBenefactor(!!user.is_benefactor);
        setBenefactorLevel(user.benefactor_level || null);
        setIsPioneer(normalised.some((b) => b.type === 'pioneer'));
        setUserBadges(normalised);
        setIsOwnProfile(!!activeWalletAddress && activeWalletAddress === user.wallet_address);
        setReadingStats(readingRes ? { ...EMPTY_STATS, ...readingRes } : EMPTY_STATS);
        setCreatorData({ ...user, ...(profileRes?.data || {}) });
        setNovels(Array.isArray(novelsRes?.data) ? novelsRes.data : []);
        setAvatarFailed(false);
      } catch (err) {
        if (alive()) setError(err?.message || 'Something went wrong.');
      } finally {
        if (alive()) setLoading(false);
      }
    },
    [isWalletConnected, activeWalletAddress, userId, getUserIdByWallet],
  );

  useEffect(() => {
    loadProfile();
    return () => {
      reqRef.current += 1; // invalidate any in-flight request on unmount / dependency change
    };
  }, [loadProfile]);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile({ silent: true });
    setRefreshing(false);
  }, [loadProfile]);

  // ------------------------------------------------------------------ helpers (same behaviour as before)
  const getBenefactorBadgeImage = () => {
    if (!isBenefactor) return null;
    const level = benefactorLevel?.toLowerCase();
    if (level === 'gold') return require('../assets/plan-image/Gold.png');
    if (level === 'silver') return require('../assets/plan-image/Sliver.png');
    if (level === 'blue') return require('../assets/plan-image/Blue.png');
    return require('../assets/plan-image/Black.png');
  };

  const getDashboardButtonProps = () => {
    if (isSuperuser || (isWriter && isArtist)) {
      return {
        text: 'Dashboard',
        action: () =>
          Alert.alert('Choose Dashboard', '', [
            { text: 'Novel', onPress: () => navigation.navigate('NovelDashboard') },
            { text: 'Manga', onPress: () => navigation.navigate('MangaDashboard') },
            { text: 'Cancel', style: 'cancel' },
          ]),
      };
    } else if (isWriter) {
      return { text: 'Novel Dashboard', action: () => navigation.navigate('NovelDashboard') };
    } else if (isArtist) {
      return { text: 'Manga Dashboard', action: () => navigation.navigate('MangaDashboard') };
    }
    return { text: 'Apply', action: () => navigation.navigate('Apply') };
  };
  const dashboardButton = getDashboardButtonProps();

  const openUrl = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => toast.error(`Could not open link — ${url}`));
  };

  const copyWallet = async () => {
    const addr = creatorData?.wallet_address;
    if (!addr) return;
    try {
      Clipboard.setString(addr);
    } catch (e) {
      // Clipboard was removed in newer React Native versions: fall back to the share sheet.
      try {
        await Share.share({ message: addr });
      } catch (e2) {
        return;
      }
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  // ------------------------------------------------------------------ derived
  const displayName = creatorData?.name || creatorData?.wallet_address?.slice(0, 8) || 'Unknown';
  const shortWallet = creatorData?.wallet_address
    ? `${creatorData.wallet_address.slice(0, 6)}...${creatorData.wallet_address.slice(-4)}`
    : '';
  const rank = useMemo(() => getReaderRank(readingStats.total_seconds), [readingStats.total_seconds]);
  const benefactorImg = getBenefactorBadgeImage();
  const twitterUrl = buildTwitterUrl(creatorData?.twitter);
  const websiteUrl = buildWebsiteUrl(creatorData?.website);
  const hasSocials = !!(creatorData?.twitter || creatorData?.discord || creatorData?.website);
  const bottomPad = Math.max(insets?.bottom || 0, 8) + 12 + 68 + 28; // clears the floating bottom nav

  const roleChips = [
    isSuperuser && { key: 'admin', label: 'ADMIN', icon: 'shield-alt', color: palette.error },
    isWriter && { key: 'writer', label: 'WRITER', icon: 'pen-nib', color: palette.accent },
    isArtist && { key: 'artist', label: 'ARTIST', icon: 'palette', color: palette.gold },
    isBenefactor && {
      key: 'benefactor',
      label: `${(benefactorLevel || 'benefactor').toString().toUpperCase()}`,
      icon: 'crown',
      color: palette.goldBright,
    },
  ].filter(Boolean);

  const sunPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sunPulse, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [reduceMotion]);

  // avatar rings
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const p = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    p.start();
    s.start();
    return () => {
      p.stop();
      s.stop();
    };
  }, [reduceMotion]);

  const iconBox = (name, color, brand) => <FontAwesome5 name={name} size={18} color={color} brand={brand} />;

  // ------------------------------------------------------------------ panels
  const renderHero = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <SpeedLines color={palette.accent} reduceMotion={reduceMotion} />
      <Halftone color={palette.accent} corner="tr" />
      <Halftone color={palette.gold} corner="bl" rows={4} cols={6} />
      {isOwnProfile ? (
        <View style={styles.ownTag}>
          <Text style={styles.ownTagText}>YOU</Text>
        </View>
      ) : null}
      <SfxText
        color={palette.accentBright}
        outline={isDark ? palette.bg : palette.textPrimary}
        size={26}
        tilt={-10}
        reduceMotion={reduceMotion}
        style={{ top: 10, left: 14 }}
      >
        ドン!
      </SfxText>

      <View style={styles.heroBody}>
        <View style={styles.avatarWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarPulse,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.22] }) }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.avatarDashed,
              { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
          />
          <View style={styles.avatarCore}>
            {creatorData?.image && !avatarFailed ? (
              <Image source={{ uri: creatorData.image }} style={styles.avatarImg} onError={() => setAvatarFailed(true)} accessibilityLabel="Profile picture" />
            ) : (
              <Text style={styles.avatarInitial}>{String(displayName).charAt(0).toUpperCase()}</Text>
            )}
          </View>
        </View>

        <View style={styles.nameRow}>
          <View style={styles.namePlate}>
            <Text style={styles.nameText} numberOfLines={1}>
              {displayName}
            </Text>
            <ShineSweep color={palette.textOnAccent} reduceMotion={reduceMotion} />
          </View>
          {isPioneer ? <Image source={pioneerBadgeImg} style={styles.nameBadge} accessibilityLabel="Pioneer badge" /> : null}
          {benefactorImg ? <Image source={benefactorImg} style={styles.nameBadge} accessibilityLabel="Benefactor badge" /> : null}
        </View>

        {roleChips.length > 0 ? (
          <View style={styles.chipRow}>
            {roleChips.map((r) => (
              <View key={r.key} style={[styles.chip, { backgroundColor: palette.bgElevated }]}>
                <View style={styles.chipInner}>
                  <FontAwesome5 name={r.icon} size={11} color={r.color} />
                  <Text style={[styles.chipText, { color: r.color }]}>{r.label}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <SpeechBubble palette={palette}>
          <Text style={styles.bioText}>{creatorData?.bio || 'No bio provided.'}</Text>
        </SpeechBubble>
      </View>
    </MangaPanel>
  );

  const renderStats = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="READING STATS" subtitle="読書記録" palette={palette} />
        <View style={styles.statsRow}>
          {[
            { key: 'time', icon: 'clock', color: palette.gold, value: readingStats.total_seconds, label: 'Total Time', fmt: formatReadingTime },
            { key: 'chapters', icon: 'book-open', color: palette.accent, value: readingStats.total_chapters, label: 'Chapters', fmt: (n) => String(n) },
            { key: 'novels', icon: 'layer-group', color: palette.success, value: readingStats.total_novels, label: 'Novels', fmt: (n) => String(n) },
          ].map((s) => (
            <View key={s.key} style={styles.statTile}>
              <View style={[styles.statTileTop, { backgroundColor: s.color }]} />
              <View style={styles.statIconWrap}>{iconBox(s.icon, s.color)}</View>
              <CountUp value={s.value} format={s.fmt} style={styles.statValue} reduceMotion={reduceMotion} />
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.rankBox}>
          <View style={styles.rankTop}>
            <View style={styles.rankLevel}>
              <Text style={styles.rankLevelLv}>LV</Text>
              <Text style={styles.rankLevelNum}>{rank.level}</Text>
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.rankTitle}>{rank.cur.title.toUpperCase()}</Text>
              <Text style={styles.rankJp}>{rank.cur.jp}</Text>
            </View>
          </View>
          <InkBar progress={rank.progress} palette={palette} reduceMotion={reduceMotion} />
          <Text style={styles.rankHint}>
            {rank.next ? `${formatReadingTime(rank.remaining)} more to become “${rank.next.title}”` : 'Maximum rank reached. A true legend.'}
          </Text>
        </View>

        {readingStats.last_read_at ? (
          <Text style={styles.lastRead}>Last read: {new Date(readingStats.last_read_at).toLocaleDateString()}</Text>
        ) : null}
      </View>
    </MangaPanel>
  );

  const renderBadges = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="BADGES" subtitle="称号" palette={palette} />
        {userBadges.length > 0 ? (
          <View style={styles.badgeGrid}>
            {userBadges.map((b, i) => (
              <StaggerIn key={b.id || i} index={i} base={500} step={70} from={14} reduceMotion={reduceMotion} style={styles.badgeCell}>
                <View style={[styles.badgeFrame, { transform: [{ rotate: i % 2 ? '4deg' : '-4deg' }] }]}>
                  {b.type === 'pioneer' ? (
                    <Image source={pioneerBadgeImg} style={styles.badgeImg} />
                  ) : b.image_url ? (
                    <Image source={{ uri: b.image_url }} style={styles.badgeImg} />
                  ) : (
                    <FontAwesome5 name="medal" size={26} color={palette.gold} />
                  )}
                </View>
                <Text style={styles.badgeName} numberOfLines={2}>
                  {b.name}
                </Text>
              </StaggerIn>
            ))}
          </View>
        ) : (
          <Text style={styles.placeholder}>No badges earned yet.</Text>
        )}
      </View>
    </MangaPanel>
  );

  const renderCreations = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="CREATIONS" subtitle="作品" palette={palette} />
        {novels.length > 0 ? (
          <View style={styles.workGrid}>
            {novels.map((novel, i) => (
              <StaggerIn key={novel.id} index={i} base={450} step={90} from={20} reduceMotion={reduceMotion} style={styles.workCell}>
                <PressScale
                  onPress={() => navigation.navigate('NovelDetail', { id: novel.id })}
                  accessibilityLabel={`Open ${novel.title}`}
                  scaleTo={0.96}
                >
                  <View style={{ transform: [{ rotate: i % 2 ? '1.2deg' : '-1.2deg' }] }}>
                    <View style={styles.workCover}>
                      <View style={styles.workSpine} />
                      {novel.image ? (
                        <Image source={{ uri: novel.image }} style={styles.workImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.workImg, styles.workImgEmpty]}>
                          <FontAwesome5 name="book" size={30} color={palette.textMuted} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.workTitle} numberOfLines={2}>
                      {novel.title}
                    </Text>
                    {novel.summary ? (
                      <Text style={styles.workSummary} numberOfLines={2}>
                        {novel.summary}
                      </Text>
                    ) : null}
                  </View>
                </PressScale>
              </StaggerIn>
            ))}
          </View>
        ) : (
          <Text style={styles.placeholder}>No creations yet. Begin your journey.</Text>
        )}
      </View>
    </MangaPanel>
  );

  const renderConnect = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="CONNECT" subtitle="つながり" palette={palette} />
        {hasSocials ? (
          <View style={styles.socialRow}>
            {creatorData?.twitter ? (
              <PressScale onPress={() => openUrl(twitterUrl)} disabled={!twitterUrl} accessibilityLabel="Open Twitter profile">
                <View style={styles.socialChip}>
                  <FontAwesome5 name="twitter" size={16} color="#1DA1F2" brand />
                  <Text style={styles.socialText}>@{String(creatorData.twitter).replace(/^@/, '')}</Text>
                </View>
              </PressScale>
            ) : null}
            {creatorData?.discord ? (
              <View style={styles.socialChip}>
                <FontAwesome5 name="discord" size={16} color="#7289DA" brand />
                <Text style={styles.socialText}>{creatorData.discord}</Text>
              </View>
            ) : null}
            {creatorData?.website ? (
              <PressScale onPress={() => openUrl(websiteUrl)} disabled={!websiteUrl} accessibilityLabel="Open website">
                <View style={styles.socialChip}>
                  <FontAwesome5 name="globe" size={16} color={palette.accent} />
                  <Text style={styles.socialText}>Website</Text>
                </View>
              </PressScale>
            ) : null}
          </View>
        ) : (
          <Text style={styles.placeholder}>No social links added</Text>
        )}

        {shortWallet ? (
          <View style={styles.walletRow}>
            <View style={styles.walletLeft}>
              <FontAwesome5 name="wallet" size={14} color={palette.gold} />
              <Text style={styles.walletText} numberOfLines={1}>
                {shortWallet}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {copied ? <Text style={styles.copiedTag}>COPIED</Text> : null}
              <PressScale onPress={copyWallet} accessibilityLabel="Copy wallet address">
                <View style={styles.copyBtn}>
                  <FontAwesome5 name={copied ? 'check' : 'copy'} size={13} color={copied ? palette.success : palette.textPrimary} />
                </View>
              </PressScale>
            </View>
          </View>
        ) : null}
      </View>
    </MangaPanel>
  );

  const renderSettings = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.panelPad}>
        <SlashBanner title="SETTINGS" subtitle="設定" palette={palette} />
        <AutopaySettings walletAddress={activeWalletAddress} />
        <View style={styles.actionsRow}>
          <View style={styles.actionCell}>
            <InkButton
              label="EDIT"
              palette={palette}
              isDark={isDark}
              icon={<FontAwesome5 name="edit" size={14} color={palette.textOnAccent} />}
              onPress={() => navigation.navigate('EditProfile')}
            />
          </View>
          <View style={styles.actionCell}>
            <InkButton
              label={dashboardButton.text.toUpperCase()}
              palette={palette}
              isDark={isDark}
              variant="ghost"
              icon={<FontAwesome5 name="rocket" size={14} color={palette.textPrimary} />}
              onPress={dashboardButton.action}
            />
          </View>
        </View>
      </View>
    </MangaPanel>
  );

  // ------------------------------------------------------------------ states
  const renderLoading = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={palette.accent} />
        <Text style={styles.loadingText}>LOADING...</Text>
      </View>
    </MangaPanel>
  );

  const renderConnectPrompt = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <SpeedLines color={palette.accent} reduceMotion={reduceMotion} />
      <View style={styles.centerBox}>
        <View style={styles.stateIconWrap}>
          <FontAwesome5 name="wallet" size={30} color={palette.accent} />
        </View>
        <Text style={styles.stateText}>Connect your Solana wallet to view your profile</Text>
        <View style={{ marginTop: 20 }}>
          <InkButton
            label="CONNECT WALLET"
            palette={palette}
            isDark={isDark}
            icon={<FontAwesome5 name="plug" size={14} color={palette.textOnAccent} />}
            onPress={() => navigation.navigate('WalletImport')}
          />
        </View>
      </View>
    </MangaPanel>
  );

  const renderError = () => (
    <MangaPanel palette={palette} isDark={isDark} offset={INK}>
      <View style={styles.centerBox}>
        <View style={[styles.stateIconWrap, { borderColor: palette.error }]}>
          <FontAwesome5 name="exclamation-triangle" size={28} color={palette.error} />
        </View>
        <Text style={styles.errorText}>{error}</Text>
        <View style={{ marginTop: 20 }}>
          <InkButton
            label="TRY AGAIN"
            palette={palette}
            isDark={isDark}
            icon={<FontAwesome5 name="sync-alt" size={14} color={palette.textOnAccent} />}
            onPress={() => loadProfile()}
          />
        </View>
      </View>
    </MangaPanel>
  );

  const showProfile = !loading && !error && (isWalletConnected || !!userId) && !!creatorData;
  const showPrompt = !loading && !isWalletConnected && !userId;
  const showError = !loading && !!error && (isWalletConnected || !!userId);

  let panels = [];
  if (loading) panels = [renderLoading()];
  else if (showPrompt) panels = [renderConnectPrompt()];
  else if (showError) panels = [renderError()];
  else if (showProfile) {
    panels = [renderHero(), renderStats(), renderBadges(), renderCreations(), renderConnect()];
    if (isOwnProfile) panels.push(renderSettings());
  }

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sunDisc,
          { transform: [{ scale: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] },
        ]}
      />
      <View pointerEvents="none" style={styles.sunRing} />
      <SakuraField palette={palette} reduceMotion={reduceMotion} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isWalletConnected || userId ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.accent]} />
          ) : undefined
        }
      >
        <StaggerIn index={0} base={0} reduceMotion={reduceMotion} from={-16}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>MY PROFILE</Text>
            <View style={styles.titleSlashRow}>
              <View style={styles.titleSlash} />
              <View style={styles.titleSlashThin} />
            </View>
            <Text style={styles.subtitle}>武士道 • Bushido</Text>
          </View>
        </StaggerIn>

        {panels.map((panel, i) => (
          <StaggerIn key={`${loading ? 'l' : showPrompt ? 'p' : showError ? 'e' : 'ok'}-${i}`} index={i + 1} reduceMotion={reduceMotion}>
            {panel}
          </StaggerIn>
        ))}
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;