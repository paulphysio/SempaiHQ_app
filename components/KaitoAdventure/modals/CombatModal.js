import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Svg, { Circle } from 'react-native-svg';

/* ══════════════════════════════════════════════════════════
   COLORS  (exact original palette)
══════════════════════════════════════════════════════════ */
const KA_COLORS = {
  bgPrimary:     '#0c0c0c',
  bgCard:        '#141210',
  bgElevated:    '#1a1714',
  bgInput:       '#0f0e0d',
  orangePrimary: '#cc5500',
  orangeBright:  '#ff6b35',
  orangeSoft:    '#e67e22',
  orangeDim:     '#8b4513',
  redAccent:     '#c41e3a',
  redDeep:       '#8b0000',
  gold:          '#c9a84c',
  goldBright:    '#ffd700',
  ivory:         '#f5e6d3',
  ivoryDim:      '#c4b5a0',
  ink:           '#2a2520',
  border:        '#2d2418',
  textPrimary:   '#f5e6d3',
  textSecondary: '#a09080',
  textMuted:     '#6b5d4f',
  success:       '#4a7c59',
  successBright: '#6ab77a',
  danger:        '#c41e3a',
  dangerSoft:    '#8b3a3a',
};

/* ══════════════════════════════════════════════════════════
   SPRITE CONFIG
══════════════════════════════════════════════════════════ */
const SPRITE_CONFIG = {
  kaito: {
    idle:         { frames: 6, loop: true,  speed: 180 },
    basic_attack: { frames: 9, loop: false, speed: 80  },
    skill_attack: { frames: 7, loop: false, speed: 90  },
    healing:      { frames: 6, loop: false, speed: 120 },
    hit:          { frames: 4, loop: false, speed: 100 },
    victory:      { frames: 5, loop: true,  speed: 150 },
    defeat:       { frames: 4, loop: false, speed: 150 },
    block:        { frames: 3, loop: false, speed: 100 },
    dodge:        { frames: 4, loop: false, speed: 80  },
  },
  bandit: {
    idle:         { frames: 4, loop: true,  speed: 200 },
    attack:       { frames: 6, loop: false, speed: 90  },
    hit:          { frames: 4, loop: false, speed: 100 },
    defeat:       { frames: 4, loop: false, speed: 150 },
  },
  golem: {
    idle:         { frames: 4, loop: true,  speed: 250 },
    attack:       { frames: 6, loop: false, speed: 80  },
    hit:          { frames: 4, loop: false, speed: 120 },
    defeat:       { frames: 4, loop: false, speed: 150 },
  },
  'shadow-ninja': {
    idle:         { frames: 4, loop: true,  speed: 180 },
    attack:       { frames: 6, loop: false, speed: 85  },
    hit:          { frames: 4, loop: false, speed: 100 },
    defeat:       { frames: 4, loop: false, speed: 150 },
  },
};

const SUPABASE_URL =
  'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure';

/* ══════════════════════════════════════════════════════════
   SPRITE ASSET MAPPING
══════════════════════════════════════════════════════════ */
const SPRITE_ASSETS = {
  kaito: {
    idle: [
      require('../../../assets/sprites/kaito/idle/idle_001.png'),
      require('../../../assets/sprites/kaito/idle/idle_002.png'),
      require('../../../assets/sprites/kaito/idle/idle_003.png'),
      require('../../../assets/sprites/kaito/idle/idle_004.png'),
      require('../../../assets/sprites/kaito/idle/idle_005.png'),
      require('../../../assets/sprites/kaito/idle/idle_006.png'),
    ],
    basic_attack: [
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_001.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_002.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_003.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_004.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_005.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_006.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_007.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_008.png'),
      require('../../../assets/sprites/kaito/basic_attack/basic_attack_009.png'),
    ],
    skill_attack: [
      require('../../../assets/sprites/kaito/skill_attack/skill_attack_001.png'),
      require('../../../assets/sprites/kaito/skill_attack/skill_attack_002.png'),
      require('../../../assets/sprites/kaito/skill_attack/skill_attack_003.png'),
      require('../../../assets/sprites/kaito/skill_attack/skill_attack_004.png'),
      require('../../../assets/sprites/kaito/skill_attack/skill_attack_005.png'),
      require('../../../assets/sprites/kaito/skill_attack/skill_attack_006.png'),
      require('../../../assets/sprites/kaito/skill_attack/skill_attack_007.png'),
    ],
    healing: [
      require('../../../assets/sprites/kaito/healing/healing_001.png'),
      require('../../../assets/sprites/kaito/healing/healing_002.png'),
      require('../../../assets/sprites/kaito/healing/healing_003.png'),
      require('../../../assets/sprites/kaito/healing/healing_004.png'),
      require('../../../assets/sprites/kaito/healing/healing_005.png'),
      require('../../../assets/sprites/kaito/healing/healing_006.png'),
    ],
    hit: [
      require('../../../assets/sprites/kaito/hit/hit_001.png'),
      require('../../../assets/sprites/kaito/hit/hit_002.png'),
      require('../../../assets/sprites/kaito/hit/hit_003.png'),
      require('../../../assets/sprites/kaito/hit/hit_004.png'),
    ],
    victory: [
      require('../../../assets/sprites/kaito/victory/victory_001.png'),
      require('../../../assets/sprites/kaito/victory/victory_002.png'),
      require('../../../assets/sprites/kaito/victory/victory_003.png'),
      require('../../../assets/sprites/kaito/victory/victory_004.png'),
      require('../../../assets/sprites/kaito/victory/victory_005.png'),
    ],
    defeat: [
      require('../../../assets/sprites/kaito/defeat/defeat_001.png'),
      require('../../../assets/sprites/kaito/defeat/defeat_002.png'),
      require('../../../assets/sprites/kaito/defeat/defeat_003.png'),
      require('../../../assets/sprites/kaito/defeat/defeat_004.png'),
    ],
    block: [
      require('../../../assets/sprites/kaito/block/block_001.png'),
      require('../../../assets/sprites/kaito/block/block_002.png'),
      require('../../../assets/sprites/kaito/block/block_003.png'),
    ],
    dodge: [
      require('../../../assets/sprites/kaito/dodge/dodge_001.png'),
      require('../../../assets/sprites/kaito/dodge/dodge_002.png'),
      require('../../../assets/sprites/kaito/dodge/dodge_003.png'),
      require('../../../assets/sprites/kaito/dodge/dodge_004.png'),
    ],
  },
  bandit: {
    idle: [
      require('../../../assets/sprites/enemies/bandit/idle_left_001.png'),
      require('../../../assets/sprites/enemies/bandit/idle_left_002.png'),
      require('../../../assets/sprites/enemies/bandit/idle_left_003.png'),
      require('../../../assets/sprites/enemies/bandit/idle_left_004.png'),
    ],
    attack: [
      require('../../../assets/sprites/enemies/bandit/attack_left_001.png'),
      require('../../../assets/sprites/enemies/bandit/attack_left_002.png'),
      require('../../../assets/sprites/enemies/bandit/attack_left_003.png'),
      require('../../../assets/sprites/enemies/bandit/attack_left_004.png'),
      require('../../../assets/sprites/enemies/bandit/attack_left_005.png'),
      require('../../../assets/sprites/enemies/bandit/attack_left_006.png'),
      require('../../../assets/sprites/enemies/bandit/attack_left_007.png'),
    ],
    hit: [
      require('../../../assets/sprites/enemies/bandit/hit_left_001.png'),
      require('../../../assets/sprites/enemies/bandit/hit_left_002.png'),
      require('../../../assets/sprites/enemies/bandit/hit_left_003.png'),
      require('../../../assets/sprites/enemies/bandit/hit_left_004.png'),
    ],
    defeat: [
      require('../../../assets/sprites/enemies/bandit/defeat_left_001.png'),
      require('../../../assets/sprites/enemies/bandit/defeat_left_002.png'),
      require('../../../assets/sprites/enemies/bandit/defeat_left_003.png'),
      require('../../../assets/sprites/enemies/bandit/defeat_left_004.png'),
    ],
  },
  golem: {
    idle: [
      require('../../../assets/sprites/enemies/golem/idle_left_001.png'),
      require('../../../assets/sprites/enemies/golem/idle_left_002.png'),
      require('../../../assets/sprites/enemies/golem/idle_left_003.png'),
      require('../../../assets/sprites/enemies/golem/idle_left_004.png'),
      require('../../../assets/sprites/enemies/golem/idle_left_005.png'),
    ],
    attack: [
      require('../../../assets/sprites/enemies/golem/attack_left_001.png'),
      require('../../../assets/sprites/enemies/golem/attack_left_002.png'),
      require('../../../assets/sprites/enemies/golem/attack_left_003.png'),
      require('../../../assets/sprites/enemies/golem/attack_left_004.png'),
      require('../../../assets/sprites/enemies/golem/attack_left_005.png'),
      require('../../../assets/sprites/enemies/golem/attack_left_006.png'),
      require('../../../assets/sprites/enemies/golem/attack_left_007.png'),
      require('../../../assets/sprites/enemies/golem/attack_left_008.png'),
    ],
    hit: [
      require('../../../assets/sprites/enemies/golem/hit_left_001.png'),
      require('../../../assets/sprites/enemies/golem/hit_left_002.png'),
      require('../../../assets/sprites/enemies/golem/hit_left_003.png'),
      require('../../../assets/sprites/enemies/golem/hit_left_004.png'),
    ],
    defeat: [
      require('../../../assets/sprites/enemies/golem/defeat_left_001.png'),
      require('../../../assets/sprites/enemies/golem/defeat_left_002.png'),
      require('../../../assets/sprites/enemies/golem/defeat_left_003.png'),
      require('../../../assets/sprites/enemies/golem/defeat_left_004.png'),
      require('../../../assets/sprites/enemies/golem/defeat_left_005.png'),
    ],
  },
  'shadow-ninja': {
    idle: [
      require('../../../assets/sprites/enemies/shadow-ninja/idle_001.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/idle_002.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/idle_003.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/idle_004.png'),
    ],
    attack: [
      require('../../../assets/sprites/enemies/shadow-ninja/attack_001.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/attack_002.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/attack_003.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/attack_004.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/attack_005.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/attack_006.png'),
    ],
    hit: [
      require('../../../assets/sprites/enemies/shadow-ninja/hit_001.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/hit_002.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/hit_003.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/hit_004.png'),
    ],
    defeat: [
      require('../../../assets/sprites/enemies/shadow-ninja/defeat_001.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/defeat_002.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/defeat_003.png'),
      require('../../../assets/sprites/enemies/shadow-ninja/defeat_004.png'),
    ],
  },
};

/* ══════════════════════════════════════════════════════════
   COMBAT CONSTANTS
══════════════════════════════════════════════════════════ */
const COOLDOWNS = {
  basicAttack: 1200,
  skillAttack: 2500,
  block:        800,
  dodge:       1000,
  heal:        3000,
  move:         600,
};

const ENEMY_ATTACK_INTERVAL_MS = 2800;
const ENEMY_ATTACK_VARIANCE    = 800;

const ANNOUNCEMENT_CONFIGS = {
  FIGHT:        { text: 'FIGHT!',           color: '#ffd700', duration: 1800 },
  FINISH_HIM:   { text: 'FINISH HIM!',      color: '#ff0000', duration: 3000 },
  FATALITY:     { text: 'FATALITY',         color: '#dc143c', duration: 4000 },
  VICTORY:      { text: 'VICTORY',          color: '#ffd700', duration: 3000 },
  DEFEAT:       { text: 'DEFEAT',           color: '#8b0000', duration: 3000 },
  FLAWLESS:     { text: 'FLAWLESS VICTORY', color: '#ffd700', duration: 4000 },
  CRITICAL:     { text: 'CRITICAL HIT!',    color: '#ff6347', duration: 1200 },
  BLOCK:        { text: 'BLOCK!',           color: '#4169e1', duration: 900  },
  DODGE:        { text: 'DODGE!',           color: '#32cd32', duration: 900  },
  CLOSE_COMBAT: { text: 'CLOSE COMBAT!',    color: '#ff8c00', duration: 1000 },
  COMBO_2:      { text: '2 HITS',           color: '#ff8c00', duration: 1000 },
  COMBO_3:      { text: '3 HITS',           color: '#ff6347', duration: 1000 },
  COMBO_4:      { text: '4 HITS',           color: '#ff0000', duration: 1000 },
  COMBO_5:      { text: '5 HITS',           color: '#dc143c', duration: 1200 },
};

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const getEnemyKey = (name) => {
  if (!name) return 'bandit';
  const key = name.toLowerCase().replace(/\s+/g, '-');
  return SPRITE_CONFIG[key] ? key : 'bandit';
};

const getAnimDuration = (charKey, animKey) => {
  const cfg = SPRITE_CONFIG[charKey]?.[animKey];
  if (!cfg) return 600;
  return cfg.frames * cfg.speed;
};

const padFrame = (n) => String(n + 1).padStart(3, '0');

/* ══════════════════════════════════════════════════════════
   SPRITE ANIMATOR
   rAF-based — no setInterval, no constant parent re-renders
══════════════════════════════════════════════════════════ */
const SpriteAnimator = memo(({ character, animation = 'idle', size = 150, freeze = false }) => {
  const charKey = character === 'kaito' ? 'kaito' : getEnemyKey(character);
  const animKey = animation || 'idle';
  const config  = SPRITE_CONFIG[charKey]?.[animKey] || SPRITE_CONFIG[charKey]?.idle;

  const [frame, setFrame] = useState(0);
  const rafRef    = useRef(null);
  const lastTs    = useRef(0);
  const frameRef  = useRef(0);

  useEffect(() => {
    if (!config || freeze) return;
    frameRef.current = 0;
    lastTs.current   = 0;
    setFrame(0);

    const tick = (ts) => {
      if (!lastTs.current) lastTs.current = ts;
      if (ts - lastTs.current >= config.speed) {
        lastTs.current = ts;
        frameRef.current += 1;
        if (config.loop) {
          frameRef.current = frameRef.current % config.frames;
        } else if (frameRef.current >= config.frames) {
          cancelAnimationFrame(rafRef.current);
          return;
        }
        setFrame(frameRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animKey, charKey, freeze]);

  // Load sprites from pre-loaded asset mapping
  const spriteArray = SPRITE_ASSETS[charKey]?.[animKey];
  const source = spriteArray?.[frame] || spriteArray?.[0];

  if (source) {
    return (
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    );
  } else {
    // Fallback to default if sprite not found
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="user" size={size / 2} color={KA_COLORS.ivory} />
      </View>
    );
  }
});

/* ══════════════════════════════════════════════════════════
   COOLDOWN RING  (exact original SVG layout)
══════════════════════════════════════════════════════════ */
const CooldownRing = memo(({ progress, ready }) => {
  const r    = 14;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, Math.max(0, progress));
  return (
    <Svg width={32} height={32}>
      <Circle cx={16} cy={16} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
      <Circle
        cx={16} cy={16} r={r}
        fill="none"
        stroke={ready ? '#ffd700' : '#ff6347'}
        strokeWidth={2.5}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
    </Svg>
  );
});

/* ══════════════════════════════════════════════════════════
   ACTION BUTTON  (memoised — prevents sibling re-renders)
══════════════════════════════════════════════════════════ */
const ActionButton = memo(({ icon, kanji, label, onPress, disabled, progress, ready, btnStyle, active }) => (
  <TouchableOpacity
    style={[
      S.jpActionBtn,
      btnStyle,
      active  ? S.activeBtn      : null,
      ready && !disabled ? S.actionReady : S.actionCooling,
    ]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.75}
  >
    <View style={S.actionBtnTop}>
      <Icon name={icon} size={20} color={KA_COLORS.ivory} style={S.jpActionIcon} />
      <CooldownRing progress={progress} ready={ready && !disabled} />
    </View>
    <Text style={S.jpActionLabel}>{kanji}</Text>
    <Text style={S.jpActionSub}>{label}</Text>
  </TouchableOpacity>
));

/* ══════════════════════════════════════════════════════════
   DISTANCE METER  (exact original layout)
══════════════════════════════════════════════════════════ */
const DistanceMeter = memo(({ distance, maxDistance = 100 }) => {
  const pct   = (distance / maxDistance) * 100;
  const color = distance <= 20 ? '#ffd700' : distance <= 50 ? '#ff6347' : '#90ee90';
  return (
    <View style={S.distanceMeter}>
      <Text style={S.distanceLabel}>DISTANCE</Text>
      <View style={S.distanceBar}>
        <View style={[S.distanceFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[S.distanceText, { color }]}>{Math.round(distance)}m</Text>
    </View>
  );
});

/* ══════════════════════════════════════════════════════════
   ANNOUNCEMENT  (isolated — own fade+scale, no parent deps)
══════════════════════════════════════════════════════════ */
const Announcement = memo(({ type, onComplete }) => {
  const [visible, setVisible] = useState(true);
  const cfg = ANNOUNCEMENT_CONFIGS[type];

  useEffect(() => {
    if (!cfg) return;
    const t = setTimeout(() => { setVisible(false); onComplete?.(); }, cfg.duration);
    return () => clearTimeout(t);
  }, [type]);

  if (!visible || !cfg) return null;
  return (
    <View style={S.announcementOverlay} pointerEvents="none">
      <Text style={[S.announcementText, { color: cfg.color }]}>{cfg.text}</Text>
    </View>
  );
});

/* ══════════════════════════════════════════════════════════
   SCREEN FLASH  (original: 200ms, opacity 0.35)
══════════════════════════════════════════════════════════ */
const ScreenFlash = memo(({ color = '#ffffff', duration = 200 }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <View
      style={[S.screenFlash, { backgroundColor: color, opacity: 0.35 }]}
      pointerEvents="none"
    />
  );
});

/* ══════════════════════════════════════════════════════════
   FLOATING DAMAGE  (original style names, animated fade+rise)
══════════════════════════════════════════════════════════ */
const FloatingDamage = memo(({ damage, type, x, y, isCritical }) => {
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 1600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -28, duration: 1600, useNativeDriver: true }),
    ]).start();
  }, []);

  const text = type === 'heal'  ? `+${damage}`
    : type === 'block'          ? 'BLOCK'
    : type === 'dodge'          ? 'DODGE!'
    : isCritical                ? `💥${damage}`
    : `-${damage}`;

  const textStyle = isCritical       ? S.critNumber
    : type === 'heal'                ? S.healNumber
    : type === 'block'               ? S.blockNumber
    : type === 'dodge'               ? S.dodgeNumber
    : S.damageNumber;

  return (
    <Animated.View
      style={[S.floatingNumber, textStyle, { left: x, top: y, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      pointerEvents="none"
    >
      <Text style={textStyle}>{text}</Text>
    </Animated.View>
  );
});

/* ══════════════════════════════════════════════════════════
   HEALTH BAR  (memoised — only re-renders when HP changes)
══════════════════════════════════════════════════════════ */
const HealthBar = memo(({ name, hp, maxHp, isEnemy, statusText, statusColor }) => {
  const pct    = Math.max(0, (hp / maxHp) * 100);
  const danger = hp < maxHp / 3;
  return (
    <View style={S.jpHealthSide}>
      <View style={S.jpHealthNameRow}>
        <Text style={S.jpNameTag}>{name}</Text>
        <Text style={S.jpHpText}>
          {hp}<Text style={S.jpHpSep}>/</Text>{maxHp}
        </Text>
      </View>
      <View style={[S.jpHpTrack, danger && S.jpHpDanger]}>
        <View style={[isEnemy ? S.jpHpFillEnemy : S.jpHpFill, { width: `${pct}%` }]} />
        <View style={S.jpHpShine} />
      </View>
      {!!statusText && (
        <Text style={[S.statusBadge, { color: statusColor }]}>{statusText}</Text>
      )}
    </View>
  );
});

/* ══════════════════════════════════════════════════════════
   COOLDOWN MANAGER HOOK
   All timing in refs — setState only on ready↔cooling flip.
   Zero extra renders between presses.
══════════════════════════════════════════════════════════ */
function useCooldowns() {
  const lastUsed  = useRef(Object.fromEntries(Object.keys(COOLDOWNS).map(k => [k, 0])));
  const readyRef  = useRef(Object.fromEntries(Object.keys(COOLDOWNS).map(k => [k, true])));
  const timers    = useRef({});

  const [ready, setReady] = useState(
    Object.fromEntries(Object.keys(COOLDOWNS).map(k => [k, true]))
  );

  const getProgress = useCallback((action) => {
    const elapsed = Date.now() - lastUsed.current[action];
    return Math.min(1, elapsed / COOLDOWNS[action]);
  }, []);

  const isReady = useCallback((action) => readyRef.current[action], []);

  const stamp = useCallback((action) => {
    lastUsed.current[action] = Date.now();
    readyRef.current[action] = false;
    setReady(r => ({ ...r, [action]: false }));
    clearTimeout(timers.current[action]);
    timers.current[action] = setTimeout(() => {
      readyRef.current[action] = true;
      setReady(r => ({ ...r, [action]: true }));
    }, COOLDOWNS[action]);
  }, []);

  const resetAll = useCallback(() => {
    Object.keys(COOLDOWNS).forEach(k => {
      lastUsed.current[k] = 0;
      clearTimeout(timers.current[k]);
    });
    const allTrue = Object.fromEntries(Object.keys(COOLDOWNS).map(k => [k, true]));
    readyRef.current = { ...allTrue };
    setReady(allTrue);
  }, []);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  return { ready, isReady, stamp, getProgress, resetAll };
}

/* ══════════════════════════════════════════════════════════
   MAIN COMBAT MODAL
══════════════════════════════════════════════════════════ */
const CombatModal = ({
  combat, combatResult, player, enemy,
  combatAttack, craftCombatPotion, toggleModal,
}) => {
  const combatState = combat;

  const [damageNumbers, setDamageNumbers]     = useState([]);
  const [announcement, setAnnouncement]       = useState(null);
  const [flashColor, setFlashColor]           = useState(null);
  const [showResult, setShowResult]           = useState(false);
  const [victoryPose, setVictoryPose]         = useState(false);
  const [perfectWin, setPerfectWin]           = useState(false);
  const [playerAnimation, setPlayerAnimation] = useState('idle');
  const [enemyAnimation, setEnemyAnimation]   = useState('idle');
  const [isBlocking, setIsBlocking]           = useState(false);
  const [isDodging, setIsDodging]             = useState(false);
  const [playerPos, setPlayerPos]             = useState(20);
  const [enemyPos, setEnemyPos]               = useState(80);
  const [distance, setDistance]               = useState(60);

  const { ready, isReady, stamp, getProgress, resetAll } = useCooldowns();

  /* refs — read by AI / timers without causing re-renders */
  const combatActive   = useRef(false);
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const blockTimer     = useRef(null);
  const dodgeTimer     = useRef(null);
  const playerAnimTmr  = useRef(null);
  const enemyAnimTmr   = useRef(null);
  const enemyAITmr     = useRef(null);
  const comboCount     = useRef(0);
  const comboResetTmr  = useRef(null);
  const isBlockingRef  = useRef(false);
  const isDodgingRef   = useRef(false);
  const playerPosRef   = useRef(20);
  const enemyPosRef    = useRef(80);
  const distanceRef    = useRef(60);
  const roundStarted   = useRef(false);
  const dmgCounter     = useRef(0);

  useEffect(() => { isBlockingRef.current = isBlocking; }, [isBlocking]);
  useEffect(() => { isDodgingRef.current  = isDodging;  }, [isDodging]);
  useEffect(() => { playerPosRef.current  = playerPos;  }, [playerPos]);
  useEffect(() => { enemyPosRef.current   = enemyPos;   }, [enemyPos]);
  useEffect(() => {
    const d = Math.abs(enemyPos - playerPos);
    distanceRef.current = d;
    setDistance(d);
  }, [playerPos, enemyPos]);

  /* ── helpers ── */
  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const flash = useCallback((color, duration = 200) => {
    setFlashColor(color);
    setTimeout(() => setFlashColor(null), duration);
  }, []);

  const addDmg = useCallback((damage, type, x, y, isCritical = false) => {
    const id = ++dmgCounter.current;
    setDamageNumbers(p => [...p.slice(-5), { id, damage, type, x, y, isCritical }]);
    setTimeout(() => setDamageNumbers(p => p.filter(d => d.id !== id)), 1800);
  }, []);

  const enemyKey = enemy
    ? getEnemyKey(enemy.name)
    : combatState
      ? getEnemyKey(combatState.enemy?.name)
      : 'bandit';

  const playPlayerAnim = useCallback((anim, fallback = 'idle') => {
    setPlayerAnimation(anim);
    clearTimeout(playerAnimTmr.current);
    playerAnimTmr.current = setTimeout(
      () => setPlayerAnimation(fallback),
      getAnimDuration('kaito', anim),
    );
  }, []);

  const playEnemyAnim = useCallback((anim, fallback = 'idle') => {
    setEnemyAnimation(anim);
    clearTimeout(enemyAnimTmr.current);
    enemyAnimTmr.current = setTimeout(
      () => setEnemyAnimation(fallback),
      getAnimDuration(enemyKey, anim),
    );
  }, [enemyKey]);

  const showAnn = useCallback((type) => setAnnouncement(type), []);

  /* ── round start ── */
  useEffect(() => {
    if (combatState && !combatResult && !roundStarted.current) {
      roundStarted.current = true;
      combatActive.current = true;
      setPlayerPos(20);
      setEnemyPos(80);
      setPlayerAnimation('idle');
      setEnemyAnimation('idle');
      setShowResult(false);
      setVictoryPose(false);
      setPerfectWin(false);
      comboCount.current = 0;
      resetAll();
      showAnn('FIGHT');
    }
  }, [combatState, combatResult]);

  /* ── combat result ── */
  useEffect(() => {
    if (!combatResult) return;
    combatActive.current = false;
    clearTimeout(enemyAITmr.current);

    if (combatResult.type === 'win') {
      setEnemyAnimation('defeat');
      setPlayerAnimation('victory');
      setVictoryPose(true);
      const isFlawless = (combatState?.playerHealth ?? 0) >= (player?.max_health || 100);
      setPerfectWin(isFlawless);
      showAnn(isFlawless ? 'FLAWLESS' : 'VICTORY');
      flash('#ffd700', 300);
      shake();
      setTimeout(() => setShowResult(true), 2500);
    } else if (combatResult.type === 'fail') {
      setPlayerAnimation('defeat');
      showAnn('DEFEAT');
      flash('#8b0000', 300);
      shake();
      setTimeout(() => setShowResult(true), 2000);
    }
  }, [combatResult]);

  /* ── enemy AI — minimal dep array, reads live via refs ── */
  const scheduleEnemy = useCallback(() => {
    clearTimeout(enemyAITmr.current);
    if (!combatActive.current) return;

    const delay = ENEMY_ATTACK_INTERVAL_MS
      + (Math.random() * ENEMY_ATTACK_VARIANCE * 2 - ENEMY_ATTACK_VARIANCE);

    enemyAITmr.current = setTimeout(() => {
      if (!combatActive.current) return;

      if (distanceRef.current > 55 && Math.random() < 0.25) {
        setEnemyAnimation('move_forward');
        setEnemyPos(p => {
          const next = Math.max(p - 12, playerPosRef.current + 10);
          enemyPosRef.current = next;
          return next;
        });
        setTimeout(() => setEnemyAnimation('idle'), getAnimDuration(enemyKey, 'move_forward'));
      } else {
        playEnemyAnim('attack');
        const atkDur = getAnimDuration(enemyKey, 'attack');
        setTimeout(() => {
          if (!combatActive.current) return;
          const isCrit   = Math.random() > 0.85;
          const baseDmg  = enemy?.damage || combatState?.enemy?.damage || 10;
          const finalDmg = isCrit ? Math.round(baseDmg * 1.8) : baseDmg;

          if (isBlockingRef.current) {
            addDmg(Math.round(finalDmg * 0.25), 'block', '22%', '32%');
            showAnn('BLOCK');
            shake();
            combatAttack('__enemy_blocked__');
          } else if (isDodgingRef.current) {
            addDmg(0, 'dodge', '22%', '32%');
            showAnn('DODGE');
          } else {
            addDmg(finalDmg, 'damage', '22%', '32%', isCrit);
            playPlayerAnim('hit');
            if (isCrit) { flash('#ff0000', 250); shake(); showAnn('CRITICAL'); }
            else shake();
            combatAttack('__enemy_attack__');
          }
        }, atkDur * 0.55);
      }

      scheduleEnemy();
    }, delay);
  }, [enemyKey]);   // intentionally narrow — reads state via refs

  useEffect(() => {
    if (combatActive.current && combatState && !combatResult) scheduleEnemy();
    return () => clearTimeout(enemyAITmr.current);
  }, [scheduleEnemy]);

  /* ══ player actions ══ */
  const handleAttack = useCallback((skillName = 'Basic Attack') => {
    if (!combatActive.current || combatResult) return;
    const isSkill = skillName !== 'Basic Attack';
    const cdKey   = isSkill ? 'skillAttack' : 'basicAttack';
    if (!isReady(cdKey)) return;
    stamp(cdKey);

    const animKey = isSkill ? 'skill_attack' : 'basic_attack';
    playPlayerAnim(animKey);
    const atkDur = getAnimDuration('kaito', animKey);

    setTimeout(() => {
      if (!combatActive.current) return;
      combatAttack(skillName);

      const distBonus = distanceRef.current <= 30 ? 1.4 : 1.0;
      const isCrit    = Math.random() > (isSkill ? 0.65 : 0.78);
      const baseDmg   = isSkill ? 25 : 15;
      const finalDmg  = Math.round(baseDmg * distBonus * (isCrit ? 1.9 : 1));

      clearTimeout(comboResetTmr.current);
      comboCount.current += 1;
      const cc = comboCount.current;
      if (cc >= 2 && cc <= 5) showAnn(`COMBO_${cc}`);
      comboResetTmr.current = setTimeout(() => { comboCount.current = 0; }, 3000);

      if (isCrit) { flash('#ffd700', 200); shake(); showAnn('CRITICAL'); }
      else shake();

      playEnemyAnim('hit');
      addDmg(finalDmg, isCrit ? 'crit' : 'damage', `${enemyPosRef.current - 5}%`, '28%', isCrit);
      if (distanceRef.current <= 30 && cc === 1) showAnn('CLOSE_COMBAT');
    }, atkDur * 0.55);
  }, [combatResult, isReady, stamp, playPlayerAnim, playEnemyAnim, addDmg, shake, flash, showAnn, combatAttack]);

  const handleBlock = useCallback(() => {
    if (!combatActive.current || combatResult || !isReady('block')) return;
    stamp('block');
    setIsBlocking(true);
    setPlayerAnimation('block');
    clearTimeout(blockTimer.current);
    blockTimer.current = setTimeout(() => {
      setIsBlocking(false);
      setPlayerAnimation('idle');
    }, 1200);
  }, [combatResult, isReady, stamp]);

  const handleDodge = useCallback(() => {
    if (!combatActive.current || combatResult || !isReady('dodge')) return;
    stamp('dodge');
    setIsDodging(true);
    playPlayerAnim('dodge');
    setPlayerPos(p => {
      const next = Math.max(5, p - 12);
      playerPosRef.current = next;
      return next;
    });
    clearTimeout(dodgeTimer.current);
    dodgeTimer.current = setTimeout(() => {
      setIsDodging(false);
      setPlayerPos(p => {
        const next = Math.min(p + 12, 45);
        playerPosRef.current = next;
        return next;
      });
    }, COOLDOWNS.dodge);
  }, [combatResult, isReady, stamp, playPlayerAnim]);

  const handleMove = useCallback(() => {
    if (!combatActive.current || combatResult || !isReady('move')) return;
    stamp('move');
    playPlayerAnim('move_forward');
    setPlayerPos(p => {
      const next = Math.min(p + 14, enemyPosRef.current - 12);
      playerPosRef.current = next;
      return next;
    });
    setTimeout(() => {
      if (distanceRef.current <= 30) showAnn('CLOSE_COMBAT');
    }, 600);
  }, [combatResult, isReady, stamp, playPlayerAnim, showAnn]);

  const handleHeal = useCallback((potionName) => {
    if (!combatActive.current || combatResult || !potionName || !isReady('heal')) return;
    stamp('heal');
    playPlayerAnim('healing');
    setTimeout(() => {
      if (!combatActive.current) return;
      craftCombatPotion(potionName);
      addDmg(30, 'heal', '22%', '28%');
    }, getAnimDuration('kaito', 'healing') * 0.5);
  }, [combatResult, isReady, stamp, playPlayerAnim, craftCombatPotion, addDmg]);

  /* ── loading ── */
  if (!combatState && !combatResult) {
    return (
      <View style={S.combatCard}>
        <View style={S.jpHeader}>
          <Text style={S.jpHeaderKanji}>決闘</Text>
          <Text style={S.jpHeaderSub}>DOJO ARENA</Text>
        </View>
        <View style={S.combatBody}>
          <View style={S.jpLoading}>
            <Text style={S.jpLoadingKanji}>待</Text>
            <Text style={S.jpLoadingText}>Preparing for battle...</Text>
          </View>
        </View>
      </View>
    );
  }

  /* ── derived display values ── */
  const playerHp   = combatState?.playerHealth ?? player.health;
  const enemyHp    = combatState?.enemyHealth ?? 0;
  const enemyMaxHp = enemy?.max_health ?? combatState?.enemyMaxHealth ?? 1;
  const enemyName  = enemy?.name ?? combatState?.enemy?.name ?? 'ENEMY';

  const pBasic = getProgress('basicAttack');
  const pSkill = getProgress('skillAttack');
  const pBlock = getProgress('block');
  const pDodge = getProgress('dodge');
  const pHeal  = getProgress('heal');
  const pMove  = getProgress('move');

  const canMove = ready.move && !combatResult && distance > 20;

  return (
    <Animated.View style={[S.combatCard, { transform: [{ translateX: shakeAnim }] }]}>

      {/* ── Header ── */}
      <View style={S.jpHeader}>
        <View style={S.jpHeaderLeft}>
          <Icon name="gavel" size={24} color={KA_COLORS.gold} />
          <View>
            <Text style={S.jpHeaderKanji}>決闘</Text>
            <Text style={S.jpHeaderSub}>KETTO</Text>
          </View>
        </View>

        <View style={S.jpHeaderCenter}>
          <View style={S.realtimeIndicator}>
            <View style={S.realtimeDot} />
            <Text style={S.realtimeText}>REAL-TIME</Text>
          </View>
        </View>

        <TouchableOpacity
          style={S.jpFleeBtn}
          onPress={() => toggleModal('combat')}
          disabled={isBlocking || isDodging}
          activeOpacity={0.8}
        >
          <Icon name="running" size={16} color={KA_COLORS.textSecondary} />
          <Text style={S.jpFleeText}>逃</Text>
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={S.combatBody}>
        <View style={S.fightingGame}>

          {/* Health Bars */}
          <View style={S.jpHealthBars}>
            <HealthBar
              name="KAITO"
              hp={playerHp}
              maxHp={player.max_health}
              isEnemy={false}
              statusText={isBlocking ? '🛡 BLOCKING' : isDodging ? '💨 EVADING' : null}
              statusColor={isBlocking ? '#4169e1' : '#32cd32'}
            />
            <Text style={S.jpVsDivider}>対</Text>
            <HealthBar
              name={enemyName.toUpperCase()}
              hp={enemyHp}
              maxHp={enemyMaxHp}
              isEnemy={true}
              statusText={enemyHp < enemyMaxHp / 3 ? '⚠ FINISH HIM' : null}
              statusColor="#ff0000"
            />
          </View>

          {/* Distance */}
          <View style={S.distanceMeterContainer}>
            <DistanceMeter distance={distance} />
          </View>

          {/* Announcements / Flash */}
          {announcement && (
            <Announcement
              type={announcement}
              onComplete={() => {
                if (!['VICTORY', 'DEFEAT', 'FLAWLESS'].includes(announcement)) {
                  setAnnouncement(null);
                }
              }}
            />
          )}
          {flashColor && <ScreenFlash color={flashColor} duration={250} />}

          {/* Fighting Stage */}
          <View style={[S.fightingStage, S.jpDojoStage]}>
            {/* Background layers */}
            <View style={S.stageBackground} pointerEvents="none">
              <View style={S.stageFloor} />
              <View style={S.stageWall} />
            </View>

            {/* Kanji overlay */}
            <View style={S.jpStageOverlay} pointerEvents="none">
              <Text style={S.jpBannerLeft}>戦</Text>
              <Text style={S.jpBannerRight}>闘</Text>
              <Text style={S.jpSigil}>道場</Text>
            </View>

            {/* Fighters */}
            <View style={S.fightersContainer}>
              <Animated.View
                style={[
                  S.fighter,
                  S.playerFighter,
                  victoryPose && S.victoryPose,
                  isBlocking && S.blocking,
                  isDodging  && S.dodging,
                  { left: `${playerPos}%` },
                ]}
              >
                <SpriteAnimator character="kaito" animation={playerAnimation} size={150} />
              </Animated.View>

              <View style={[S.fighter, S.enemyFighter, { left: `${enemyPos}%` }]}>
                <SpriteAnimator
                  character={combatState?.enemy?.name || 'bandit'}
                  animation={enemyAnimation}
                  size={150}
                />
              </View>
            </View>

            {/* Floating damage numbers */}
            {damageNumbers.map(d => (
              <FloatingDamage key={d.id} {...d} />
            ))}

            {/* Combat log */}
            {combatState?.log?.length > 0 && (
              <View style={S.jpLogFloat}>
                <View style={S.jpLogFloatHeader}>
                  <Icon name="magic" size={16} color={KA_COLORS.gold} />
                  <Text style={S.jpLogFloatTitle}>戦記</Text>
                </View>
                <ScrollView style={S.jpLogFloatScroll} scrollEnabled={false}>
                  {combatState.log.slice(-6).map((entry, idx) => (
                    <Text key={idx} style={S.jpLogFloatEntry}>{entry}</Text>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Equipment Strip */}
          <View style={S.jpEquipStrip}>
            {player.equipment?.weapon && (
              <View style={S.jpEquipSlot}>
                <Icon name="gavel" size={16} color={KA_COLORS.gold} />
                <Text style={S.jpEquipText}>{player.equipment.weapon}</Text>
              </View>
            )}
            {player.equipment?.armor && (
              <View style={S.jpEquipSlot}>
                <Icon name="shield-alt" size={16} color={KA_COLORS.gold} />
                <Text style={S.jpEquipText}>{player.equipment.armor}</Text>
              </View>
            )}
          </View>

          {/* Action Panel */}
          <View style={S.jpActionPanel}>
            <View style={S.jpActionGrid}>
              <ActionButton
                icon="gavel"       kanji="斬" label="ATTACK"
                onPress={() => handleAttack('Basic Attack')}
                disabled={!ready.basicAttack || !!combatResult}
                progress={pBasic}  ready={ready.basicAttack && !combatResult}
                btnStyle={S.jpAttackBtn}
              />
              <ActionButton
                icon="arrows-alt-h" kanji="進" label="ADVANCE"
                onPress={handleMove}
                disabled={!canMove}
                progress={pMove}   ready={canMove}
                btnStyle={S.jpMoveBtn}
              />
              <ActionButton
                icon="shield-alt"  kanji="守" label="BLOCK"
                onPress={handleBlock}
                disabled={!ready.block || !!combatResult}
                progress={pBlock}  ready={ready.block && !combatResult}
                btnStyle={S.jpBlockBtn}
                active={isBlocking}
              />
              <ActionButton
                icon="shoe-prints" kanji="避" label="DODGE"
                onPress={handleDodge}
                disabled={!ready.dodge || !!combatResult}
                progress={pDodge}  ready={ready.dodge && !combatResult}
                btnStyle={S.jpDodgeBtn}
                active={isDodging}
              />
              <ActionButton
                icon="bolt"        kanji="技" label="SKILL"
                onPress={() => handleAttack('Power Strike')}
                disabled={!ready.skillAttack || !!combatResult}
                progress={pSkill}  ready={ready.skillAttack && !combatResult}
                btnStyle={S.jpSkillBtn}
              />
              <ActionButton
                icon="flask"       kanji="薬" label="HEAL"
                onPress={() => handleHeal('Weak Healing Potion')}
                disabled={!ready.heal || !!combatResult}
                progress={pHeal}   ready={ready.heal && !combatResult}
                btnStyle={S.jpPotionBtn}
              />
            </View>

            <View style={S.hintBar}>
              <Text style={S.hintText}>Attack freely — enemy acts on its own timer.</Text>
              <Text style={S.hintText}>Block = 75% damage reduction · Dodge = full evade</Text>
            </View>
          </View>
        </View>

        {/* Result Screen */}
        {showResult && combatResult && (
          <Modal visible transparent animationType="fade">
            <View style={[
              S.jpResultScreen,
              combatResult.type === 'win' ? S.jpResultWin : S.jpResultLose,
            ]}>
              <View style={S.jpResultCard}>
                <Text style={S.jpResultKanji}>
                  {combatResult.type === 'win' ? '勝' : '敗'}
                </Text>
                <Text style={S.jpResultTitle}>
                  {combatResult.type === 'win' ? 'VICTORY' : 'DEFEAT'}
                </Text>
                <Text style={S.jpResultMsg}>{combatResult.message}</Text>

                {combatResult.type === 'win' && combatState?.enemy && (
                  <View style={S.jpRewards}>
                    <View style={S.jpRewardItem}>
                      <Icon name="coins" size={18} color={KA_COLORS.gold} />
                      <Text style={S.jpRewardText}>+{combatState?.enemy?.gold ?? 0} Gold</Text>
                    </View>
                    <View style={S.jpRewardItem}>
                      <Icon name="star" size={18} color={KA_COLORS.gold} />
                      <Text style={S.jpRewardText}>+{enemyName === 'Bandit' ? 20 : 25} XP</Text>
                    </View>
                    {perfectWin && (
                      <View style={S.jpRewardItem}>
                        <Icon name="star" size={18} color={KA_COLORS.gold} />
                        <Text style={S.jpRewardText}>PERFECT BONUS</Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[S.jpResultBtn, combatResult.type === 'win' ? S.jpResultBtnWin : S.jpResultBtnLose]}
                  onPress={() => toggleModal('combat')}
                  activeOpacity={0.8}
                >
                  <Text style={S.jpResultBtnText}>
                    {combatResult.type === 'win' ? '続 CONTINUE' : '再 RETRY'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Animated.View>
  );
};

/* ══════════════════════════════════════════════════════════
   STYLES  — exact original values faithfully restored
══════════════════════════════════════════════════════════ */
const S = StyleSheet.create({
  /* card wrapper */
  combatCard: {
    backgroundColor: KA_COLORS.bgCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    overflow: 'hidden',
  },

  /* header bar */
  jpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
    backgroundColor: KA_COLORS.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  jpHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jpHeaderKanji: {
    fontSize: 12,
    
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },
  jpHeaderSub: {
    fontSize: 6,
    color: KA_COLORS.textSecondary,
    letterSpacing: 1,
  },
  jpHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  realtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  realtimeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#22c55e',
  },
  realtimeText: {
    fontSize: 6,
    
    color: KA_COLORS.gold,
    letterSpacing: 1,
  },
  jpFleeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
  },
  jpFleeText: {
    fontSize: 8,
    color: KA_COLORS.textSecondary,
  },

  /* body */
  combatBody: {
    padding: 6,
  },
  fightingGame: {
    gap: 6,
  },

  /* health bars */
  jpHealthBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jpHealthSide: {
    flex: 1,
  },
  jpHealthNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  jpNameTag: {
    fontSize: 8,
    
    color: KA_COLORS.ivory,
    letterSpacing: 1,
  },
  jpHpText: {
    fontSize: 8,
    color: KA_COLORS.textSecondary,
  },
  jpHpSep: {
    marginHorizontal: 2,
  },
  jpHpTrack: {
    height: 6,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: KA_COLORS.border,
  },
  jpHpDanger: {
    borderColor: KA_COLORS.redAccent,
  },
  jpHpFill: {
    height: '100%',
    backgroundColor: KA_COLORS.success,
  },
  jpHpFillEnemy: {
    height: '100%',
    backgroundColor: KA_COLORS.redAccent,
  },
  jpHpShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusBadge: {
    fontSize: 6,
    
    marginTop: 2,
    letterSpacing: 0.5,
  },
  jpVsDivider: {
    fontSize: 12,
    
    color: KA_COLORS.gold,
    marginHorizontal: 8,
  },

  /* distance meter */
  distanceMeterContainer: {
    marginBottom: 6,
  },
  distanceMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceLabel: {
    fontSize: 6,
    color: KA_COLORS.textSecondary,
    letterSpacing: 1,
  },
  distanceBar: {
    flex: 1,
    height: 3,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  distanceFill: {
    height: '100%',
  },
  distanceText: {
    fontSize: 6,
    minWidth: 20,
    textAlign: 'right',
  },

  /* announcements */
  announcementOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    zIndex: 10,
  },
  announcementText: {
    fontSize: 16,
    
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },

  /* screen flash */
  screenFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
  },

  /* stage */
  fightingStage: {
    height: 100,
    backgroundColor: KA_COLORS.bgCard,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    marginBottom: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  jpDojoStage: {
    backgroundColor: 'rgba(47,79,79,0.1)',
  },
  stageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stageFloor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(139,69,19,0.3)',
  },
  stageWall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '70%',
    backgroundColor: 'rgba(47,79,79,0.2)',
  },
  jpStageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jpBannerLeft: {
    position: 'absolute',
    left: 5,
    top: 5,
    fontSize: 24,
    
    color: 'rgba(218,165,32,0.2)',
  },
  jpBannerRight: {
    position: 'absolute',
    right: 5,
    top: 5,
    fontSize: 24,
    
    color: 'rgba(218,165,32,0.2)',
  },
  jpSigil: {
    fontSize: 12,
    
    color: 'rgba(218,165,32,0.15)',
    letterSpacing: 4,
  },

  /* fighters */
  fightersContainer: {
    position: 'relative',
    height: '100%',
  },
  fighter: {
    position: 'absolute',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerFighter: {
    top: '30%',
  },
  enemyFighter: {
    top: '30%',
  },
  victoryPose: {
    transform: [{ scale: 1.1 }],
  },
  blocking: {
    opacity: 0.8,
  },
  dodging: {
    opacity: 0.6,
  },

  /* floating numbers */
  floatingNumber: {
    position: 'absolute',
    zIndex: 5,
  },
  damageNumber: {
    fontSize: 10,
    
    color: KA_COLORS.redAccent,
  },
  critNumber: {
    fontSize: 14,
    
    color: '#f43f5e',
  },
  healNumber: {
    fontSize: 10,
    
    color: KA_COLORS.successBright,
  },
  blockNumber: {
    fontSize: 10,
    
    color: '#4169e1',
  },
  dodgeNumber: {
    fontSize: 10,
    
    color: '#32cd32',
  },

  /* log float */
  jpLogFloat: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 75,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: KA_COLORS.gold,
    zIndex: 10,
  },
  jpLogFloatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  jpLogFloatTitle: {
    fontSize: 6,
    
    color: KA_COLORS.gold,
    letterSpacing: 1,
  },
  jpLogFloatScroll: {
    maxHeight: 40,
    padding: 4,
  },
  jpLogFloatEntry: {
    fontSize: 5,
    color: KA_COLORS.ivory,
    marginBottom: 2,
  },

  /* equipment strip */
  jpEquipStrip: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  jpEquipSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 2,
  },
  jpEquipText: {
    fontSize: 6,
    color: KA_COLORS.ivory,
  },

  /* action panel */
  jpActionPanel: {
    backgroundColor: KA_COLORS.bgElevated,
    borderTopWidth: 1,
    borderTopColor: KA_COLORS.border,
    padding: 6,
  },
  jpActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  jpActionBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 6,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    alignItems: 'center',
    gap: 2,
  },
  jpAttackBtn: {
    borderColor: KA_COLORS.redAccent,
    backgroundColor: 'rgba(220,38,38,0.15)',
  },
  jpMoveBtn: {
    borderColor: KA_COLORS.success,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  jpBlockBtn: {
    borderColor: KA_COLORS.gold,
    backgroundColor: 'rgba(234,179,8,0.15)',
  },
  jpDodgeBtn: {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(96,165,250,0.15)',
  },
  jpSkillBtn: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  jpPotionBtn: {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(167,139,250,0.15)',
  },
  actionBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 2,
  },
  jpActionIcon: {
    marginRight: 2,
  },
  jpActionLabel: {
    fontSize: 10,
    
    color: KA_COLORS.ivory,
  },
  jpActionSub: {
    fontSize: 5,
    color: KA_COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  actionReady: {
    opacity: 1,
  },
  actionCooling: {
    opacity: 0.5,
  },
  activeBtn: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.3)',
  },

  /* hint bar */
  hintBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  hintText: {
    fontSize: 5,
    color: KA_COLORS.textSecondary,
    flex: 1,
  },

  /* result screen */
  jpResultScreen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jpResultWin: {
    backgroundColor: 'rgba(34,197,94,0.9)',
  },
  jpResultLose: {
    backgroundColor: 'rgba(220,38,38,0.9)',
  },
  jpResultCard: {
    backgroundColor: KA_COLORS.bgCard,
    padding: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    alignItems: 'center',
  },
  jpResultKanji: {
    fontSize: 32,
    
    color: KA_COLORS.gold,
    marginBottom: 8,
  },
  jpResultTitle: {
    fontSize: 12,
    
    color: KA_COLORS.ivory,
    marginBottom: 4,
  },
  jpResultMsg: {
    fontSize: 7,
    color: KA_COLORS.textSecondary,
    marginBottom: 12,
  },
  jpRewards: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  jpRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jpRewardText: {
    fontSize: 7,
    color: KA_COLORS.gold,
  },
  jpResultBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 4,
  },
  jpResultBtnWin: {
    backgroundColor: KA_COLORS.success,
  },
  jpResultBtnLose: {
    backgroundColor: KA_COLORS.redAccent,
  },
  jpResultBtnText: {
    fontSize: 8,
    
    color: KA_COLORS.ivory,
  },

  /* loading */
  jpLoading: {
    alignItems: 'center',
    padding: 16,
  },
  jpLoadingKanji: {
    fontSize: 24,
    
    color: KA_COLORS.gold,
    marginBottom: 8,
  },
  jpLoadingText: {
    fontSize: 7,
    color: KA_COLORS.textSecondary,
  },
});

export { KA_COLORS };
export default CombatModal;
