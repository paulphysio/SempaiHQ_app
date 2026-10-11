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
   COLORS  (same palette as CombatModal)
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
   SPRITE CONFIG (same as CombatModal)
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

/* ══════════════════════════════════════════════════════════
   SPRITE ASSET MAPPING (same as CombatModal)
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
  WAVE_START:   { text: 'WAVE START!',      color: '#ff6b35', duration: 2000 },
  NEXT_WAVE:    { text: 'NEXT WAVE!',       color: '#ffd700', duration: 2000 },
  FIGHT:        { text: 'FIGHT!',           color: '#ffd700', duration: 1800 },
  VICTORY:      { text: 'VICTORY',          color: '#ffd700', duration: 3000 },
  DEFEAT:       { text: 'DEFEAT',           color: '#8b0000', duration: 3000 },
  CRITICAL:     { text: 'CRITICAL HIT!',    color: '#ff6347', duration: 1200 },
  BLOCK:        { text: 'BLOCK!',           color: '#4169e1', duration: 900  },
  DODGE:        { text: 'DODGE!',           color: '#32cd32', duration: 900  },
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

/* ══════════════════════════════════════════════════════════
   SPRITE ANIMATOR (same as CombatModal)
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

  const spriteArray = SPRITE_ASSETS[charKey]?.[animKey];
  const source = spriteArray?.[frame] || spriteArray?.[0];

  if (source) {
    return (
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
    );
  } else {
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name="user" size={size / 2} color={KA_COLORS.ivory} />
      </View>
    );
  }
});

/* ══════════════════════════════════════════════════════════
   COOLDOWN RING
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
   ACTION BUTTON
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
   ANNOUNCEMENT
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
   FLOATING DAMAGE
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
   HEALTH BAR
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
   WAVE ENEMY GENERATOR
══════════════════════════════════════════════════════════ */
const generateWaveEnemy = (waveNumber) => {
  const enemyTypes = [
    { name: "Bandit", health: 80, damage: 10, gold: 10, drop: "Shadow Root", dropChance: 0.2 },
    { name: "Shadow Ninja", health: 60, damage: 15, gold: 15, drop: "Mist Essence", dropChance: 0.3 },
    { name: "Golem", health: 120, damage: 8, gold: 20, drop: "Iron Ore", dropChance: 0.25 },
  ];
  
  // Scale difficulty with wave number
  const baseEnemy = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
  const healthScale = 1 + (waveNumber - 1) * 0.15;
  const damageScale = 1 + (waveNumber - 1) * 0.1;
  
  return {
    ...baseEnemy,
    health: Math.round(baseEnemy.health * healthScale),
    max_health: Math.round(baseEnemy.health * healthScale),
    damage: Math.round(baseEnemy.damage * damageScale),
    gold: Math.round(baseEnemy.gold * (1 + waveNumber * 0.1)),
  };
};

/* ══════════════════════════════════════════════════════════
   MAIN WAVE MODAL
══════════════════════════════════════════════════════════ */
const WaveModal = ({
  waveState, waveResult, player,
  waveAttack, craftWavePotion, toggleModal,
  waveCount, setWaveCount, setCurrentWaveEnemy,
}) => {
  const [damageNumbers, setDamageNumbers]     = useState([]);
  const [announcement, setAnnouncement]       = useState(null);
  const [showResult, setShowResult]           = useState(false);
  const [playerAnimation, setPlayerAnimation] = useState('idle');
  const [enemyAnimation, setEnemyAnimation]   = useState('idle');
  const [isBlocking, setIsBlocking]           = useState(false);
  const [isDodging, setIsDodging]             = useState(false);
  const [playerPos, setPlayerPos]             = useState(20);
  const [enemyPos, setEnemyPos]               = useState(80);
  const [distance, setDistance]               = useState(60);
  const [totalWaves, setTotalWaves]           = useState(0);
  const [enemiesDefeated, setEnemiesDefeated] = useState(0);

  const { ready, isReady, stamp, getProgress, resetAll } = useCooldowns();

  const combatActive   = useRef(false);
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const blockTimer     = useRef(null);
  const dodgeTimer     = useRef(null);
  const playerAnimTmr  = useRef(null);
  const enemyAnimTmr   = useRef(null);
  const enemyAITmr     = useRef(null);
  const dmgCounter     = useRef(0);

  const enemyKey = waveState?.enemy ? getEnemyKey(waveState.enemy.name) : 'bandit';

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const addDmg = useCallback((damage, type, x, y, isCritical = false) => {
    const id = ++dmgCounter.current;
    setDamageNumbers(p => [...p.slice(-5), { id, damage, type, x, y, isCritical }]);
    setTimeout(() => setDamageNumbers(p => p.filter(d => d.id !== id)), 1800);
  }, []);

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

  // Start wave
  useEffect(() => {
    if (waveState && !waveResult) {
      combatActive.current = true;
      setPlayerPos(20);
      setEnemyPos(80);
      setPlayerAnimation('idle');
      setEnemyAnimation('idle');
      setShowResult(false);
      resetAll();
      showAnn('WAVE_START');
    }
  }, [waveState, waveResult, resetAll, showAnn]);

  // Wave result
  useEffect(() => {
    if (!waveResult) return;
    combatActive.current = false;
    clearTimeout(enemyAITmr.current);

    if (waveResult.type === 'win') {
      setEnemyAnimation('defeat');
      setPlayerAnimation('victory');
      showAnn('VICTORY');
      shake();
      setEnemiesDefeated(prev => prev + 1);
      
      // Prepare next wave after delay
      setTimeout(() => {
        setTotalWaves(prev => prev + 1);
        const nextEnemy = generateWaveEnemy(waveCount + 1);
        setCurrentWaveEnemy(nextEnemy);
        setWaveCount(prev => prev + 1);
        setShowResult(false);
        showAnn('NEXT_WAVE');
      }, 3000);
    } else if (waveResult.type === 'fail') {
      setPlayerAnimation('defeat');
      showAnn('DEFEAT');
      shake();
      setTimeout(() => setShowResult(true), 2000);
    }
  }, [waveResult, waveCount, setCurrentWaveEnemy, setWaveCount, showAnn]);

  // Player attack
  const handleAttack = useCallback((skillName = 'Basic Attack') => {
    if (!combatActive.current || waveResult) return;
    const isSkill = skillName !== 'Basic Attack';
    const cdKey   = isSkill ? 'skillAttack' : 'basicAttack';
    if (!isReady(cdKey)) return;

    stamp(cdKey);
    const animKey = isSkill ? 'skill_attack' : 'basic_attack';
    playPlayerAnim(animKey);
    const atkDur = getAnimDuration('kaito', animKey);

    setTimeout(() => {
      if (!combatActive.current) return;
      waveAttack(skillName);

      const isCrit   = Math.random() > (isSkill ? 0.65 : 0.78);
      const baseDmg  = isSkill ? 25 : 15;
      const finalDmg = Math.round(baseDmg * (isCrit ? 1.9 : 1));

      if (isCrit) { shake(); showAnn('CRITICAL'); }
      else shake();

      playEnemyAnim('hit');
      addDmg(finalDmg, isCrit ? 'crit' : 'damage', '22%', '28%', isCrit);
    }, atkDur * 0.55);
  }, [waveResult, isReady, stamp, playPlayerAnim, playEnemyAnim, addDmg, shake, showAnn, waveAttack]);

  const handleBlock = useCallback(() => {
    if (!combatActive.current || waveResult || !isReady('block')) return;
    stamp('block');
    setIsBlocking(true);
    setPlayerAnimation('block');
    clearTimeout(blockTimer.current);
    blockTimer.current = setTimeout(() => {
      setIsBlocking(false);
      setPlayerAnimation('idle');
    }, 1200);
  }, [waveResult, isReady, stamp]);

  const handleDodge = useCallback(() => {
    if (!combatActive.current || waveResult || !isReady('dodge')) return;
    stamp('dodge');
    setIsDodging(true);
    playPlayerAnim('dodge');
    setPlayerPos(p => Math.max(5, p - 12));
    clearTimeout(dodgeTimer.current);
    dodgeTimer.current = setTimeout(() => {
      setIsDodging(false);
      setPlayerPos(p => Math.min(p + 12, 45));
    }, COOLDOWNS.dodge);
  }, [waveResult, isReady, stamp, playPlayerAnim]);

  const handleHeal = useCallback((potionName) => {
    if (!combatActive.current || waveResult || !potionName || !isReady('heal')) return;
    stamp('heal');
    playPlayerAnim('healing');
    const dur = getAnimDuration('kaito', 'healing');
    setTimeout(() => {
      if (!combatActive.current) return;
      craftWavePotion(potionName);
      addDmg(30, 'heal', '22%', '28%');
    }, dur * 0.5);
  }, [combatActive.current, waveResult, isReady, stamp, playPlayerAnim, craftWavePotion, addDmg]);

  const pBasic = getProgress('basicAttack');
  const pSkill = getProgress('skillAttack');
  const pBlock = getProgress('block');
  const pDodge = getProgress('dodge');
  const pHeal  = getProgress('heal');

  if (!waveState && !waveResult) {
    return (
      <View style={S.combatCard}>
        <View style={S.jpHeader}>
          <Text style={S.jpHeaderKanji}>波</Text>
          <Text style={S.jpHeaderSub}>WAVE MODE</Text>
        </View>
        <View style={[S.combatBody, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={[S.jpHeaderKanji, { fontSize: 24 }]}>待</Text>
          <Text style={S.jpHeaderSub}>Preparing for wave...</Text>
        </View>
      </View>
    );
  }

  const playerHp    = waveState?.playerHealth ?? player.health;
  const enemyHp     = waveState?.enemyHealth ?? 0;
  const enemyMaxHp  = waveState?.enemy?.max_health ?? 1;
  const enemyName   = waveState?.enemy?.name ?? 'ENEMY';

  const playerStatus = isBlocking ? { text: '🛡 BLOCKING', color: '#4169e1' }
    : isDodging ? { text: '💨 EVADING', color: '#32cd32' }
    : null;

  return (
    <Animated.View style={[S.combatCard, { transform: [{ translateX: shakeAnim }] }]}>
      <View style={S.jpHeader}>
        <View style={S.jpHeaderLeft}>
          <Icon name="gavel" size={20} color={KA_COLORS.gold} />
          <View>
            <Text style={S.jpHeaderKanji}>波</Text>
            <Text style={S.jpHeaderSub}>WAVE {waveCount}</Text>
          </View>
        </View>

        <View style={S.waveStats}>
          <Text style={S.waveStatText}>Defeated: {enemiesDefeated}</Text>
        </View>

        <TouchableOpacity
          style={S.jpFleeBtn}
          onPress={() => toggleModal('wave')}
          disabled={isBlocking || isDodging}
          activeOpacity={0.7}
        >
          <Icon name="running" size={14} color={KA_COLORS.textSecondary} />
          <Text style={S.jpFleeText}>逃</Text>
        </TouchableOpacity>
      </View>

      <View style={S.combatBody}>
        <View style={S.jpHealthBars}>
          <HealthBar
            name="KAITO"
            hp={playerHp}
            maxHp={player.max_health}
            isEnemy={false}
            statusText={playerStatus?.text}
            statusColor={playerStatus?.color}
          />
          <Text style={S.jpVsDivider}>対</Text>
          <HealthBar
            name={enemyName.toUpperCase()}
            hp={enemyHp}
            maxHp={enemyMaxHp}
            isEnemy={true}
          />
        </View>

        <View style={S.fightingStage}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={S.stageWall} />
            <View style={S.stageFloor} />
          </View>

          <View style={[StyleSheet.absoluteFill, S.jpStageOverlay]} pointerEvents="none">
            <Text style={S.jpBannerLeft}>戦</Text>
            <Text style={S.jpBannerRight}>闘</Text>
            <Text style={S.jpSigil}>波</Text>
          </View>

          <View style={[StyleSheet.absoluteFill, S.fightersContainer]} pointerEvents="none">
            <View style={[S.fighter, S.playerFighter, { left: `${playerPos}%` }]}>
              <SpriteAnimator character="kaito" animation={playerAnimation} size={160} />
            </View>
            <View style={[S.fighter, S.enemyFighter, { left: `${enemyPos}%` }]}>
              <SpriteAnimator
                character={waveState?.enemy?.name || 'bandit'}
                animation={enemyAnimation}
                size={160}
              />
            </View>
          </View>

          {damageNumbers.map(d => (
            <FloatingDamage key={d.id} {...d} />
          ))}

          {announcement && (
            <Announcement
              type={announcement}
              onComplete={() => {
                if (!['VICTORY', 'DEFEAT'].includes(announcement)) {
                  setAnnouncement(null);
                }
              }}
            />
          )}
        </View>

        <View style={S.jpActionPanel}>
          <View style={S.jpActionGrid}>
            <ActionButton
              icon="gavel"
              kanji="斬"
              label="ATTACK"
              onPress={handleAttack}
              disabled={!ready.basicAttack || !!waveResult}
              progress={pBasic}
              ready={ready.basicAttack && !waveResult}
              btnStyle={S.jpAttackBtn}
            />
            <ActionButton
              icon="shield-alt"
              kanji="守"
              label="BLOCK"
              onPress={handleBlock}
              disabled={!ready.block || !!waveResult}
              progress={pBlock}
              ready={ready.block && !waveResult}
              btnStyle={isBlocking ? S.activeBtnBlock : S.jpBlockBtn}
            />
            <ActionButton
              icon="shoe-prints"
              kanji="避"
              label="DODGE"
              onPress={handleDodge}
              disabled={!ready.dodge || !!waveResult}
              progress={pDodge}
              ready={ready.dodge && !waveResult}
              btnStyle={isDodging ? S.activeBtnDodge : S.jpDodgeBtn}
            />
            <ActionButton
              icon="bolt"
              kanji="技"
              label="SKILL"
              onPress={() => handleAttack('Power Strike')}
              disabled={!ready.skillAttack || !!waveResult}
              progress={pSkill}
              ready={ready.skillAttack && !waveResult}
              btnStyle={S.jpSkillBtn}
            />
            <ActionButton
              icon="flask"
              kanji="薬"
              label="HEAL"
              onPress={() => handleHeal('Weak Healing Potion')}
              disabled={!ready.heal || !!waveResult}
              progress={pHeal}
              ready={ready.heal && !waveResult}
              btnStyle={S.jpPotionBtn}
            />
          </View>
        </View>

        {showResult && waveResult && (
          <Modal visible transparent animationType="fade">
            <View style={[S.jpResultScreen, waveResult.type === 'win' ? S.jpResultWin : S.jpResultLose]}>
              <View style={S.jpResultCard}>
                <Text style={S.jpResultKanji}>{waveResult.type === 'win' ? '勝' : '敗'}</Text>
                <Text style={S.jpResultTitle}>{waveResult.type === 'win' ? 'WAVE COMPLETE' : 'WAVE FAILED'}</Text>
                <Text style={S.jpResultMsg}>Waves Survived: {waveCount}</Text>
                <Text style={S.jpResultMsg}>Enemies Defeated: {enemiesDefeated}</Text>

                <TouchableOpacity
                  style={[S.jpResultBtn, waveResult.type === 'win' ? S.jpResultBtnWin : S.jpResultBtnLose]}
                  onPress={() => toggleModal('wave')}
                  activeOpacity={0.8}
                >
                  <Text style={S.jpResultBtnText}>
                    {waveResult.type === 'win' ? '続 CONTINUE' : '再 RETRY'}
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
   STYLES (same as CombatModalStyles)
══════════════════════════════════════════════════════════ */
const S = StyleSheet.create({
  combatCard: {
    backgroundColor: KA_COLORS.bgCard,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    overflow: 'hidden',
  },
  jpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 6,
    backgroundColor: KA_COLORS.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  jpHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jpHeaderKanji: { fontSize: 12, color: KA_COLORS.gold, letterSpacing: 2 },
  jpHeaderSub:   { fontSize: 6,  color: KA_COLORS.textSecondary, letterSpacing: 1 },
  waveStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  waveStatText: { fontSize: 8, color: KA_COLORS.gold, letterSpacing: 1 },
  jpFleeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1, borderColor: KA_COLORS.border, borderRadius: 2,
  },
  jpFleeText: { fontSize: 8, color: KA_COLORS.textSecondary },

  combatBody: { padding: 6, gap: 6 },

  jpHealthBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jpHealthSide: { flex: 1 },
  jpHealthNameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  jpNameTag:  { fontSize: 8, color: KA_COLORS.ivory, letterSpacing: 1 },
  jpHpText:   { fontSize: 8, color: KA_COLORS.textSecondary },
  jpHpSep:    { marginHorizontal: 2 },
  jpHpTrack: {
    height: 6, backgroundColor: KA_COLORS.ink, borderRadius: 3,
    overflow: 'hidden', borderWidth: 1, borderColor: KA_COLORS.border,
  },
  jpHpDanger: { borderColor: KA_COLORS.redAccent },
  jpHpFill:       { height: '100%', backgroundColor: KA_COLORS.success },
  jpHpFillEnemy:  { height: '100%', backgroundColor: KA_COLORS.redAccent },
  jpHpShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statusBadge: { fontSize: 6, marginTop: 2, letterSpacing: 0.5 },
  jpVsDivider: { fontSize: 12, color: KA_COLORS.gold, marginHorizontal: 8 },

  fightingStage: {
    height: 180,
    backgroundColor: KA_COLORS.bgCard,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    overflow: 'hidden',
    position: 'relative',
  },
  stageFloor: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '30%',
    backgroundColor: 'rgba(139,69,19,0.3)',
  },
  stageWall: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '70%',
    backgroundColor: 'rgba(47,79,79,0.2)',
  },
  jpStageOverlay: { justifyContent: 'center', alignItems: 'center' },
  jpBannerLeft: { position: 'absolute', left: 5, top: 5, fontSize: 22, color: 'rgba(218,165,32,0.2)' },
  jpBannerRight: { position: 'absolute', right: 5, top: 5, fontSize: 22, color: 'rgba(218,165,32,0.2)' },
  jpSigil: { fontSize: 11, color: 'rgba(218,165,32,0.12)', letterSpacing: 4 },

  fightersContainer: { position: 'relative' },
  fighter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  playerFighter: { top: '20%' },
  enemyFighter:  { top: '20%', transform: [{ scaleX: -1 }] },

  floatingNumber: { position: 'absolute', zIndex: 5, },

  announcementOverlay: {
    position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 10,
  },
  announcementText: { fontSize: 16, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },

  jpActionPanel: {
    backgroundColor: KA_COLORS.bgElevated,
    borderTopWidth: 1, borderTopColor: KA_COLORS.border,
    padding: 6, borderRadius: 4,
  },
  jpActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'space-between' },

  jpActionBtn: {
    width: '23%',
    paddingVertical: 8,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 2, borderColor: KA_COLORS.border,
    borderRadius: 6, alignItems: 'center', gap: 2,
  },
  actionBtnTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  jpActionIcon: { marginRight: 2 },
  jpActionLabel: { fontSize: 10, color: KA_COLORS.ivory },
  jpActionSub:   { fontSize: 5, color: KA_COLORS.textSecondary, letterSpacing: 0.5 },
  actionReady:   { opacity: 1 },
  actionCooling: { opacity: 0.45 },

  jpAttackBtn: { borderColor: KA_COLORS.orangePrimary,  backgroundColor: 'rgba(204,85,0,0.25)' },
  jpMoveBtn:   { borderColor: KA_COLORS.orangeBright,   backgroundColor: 'rgba(255,107,53,0.2)' },
  jpBlockBtn:  { borderColor: KA_COLORS.gold,             backgroundColor: 'rgba(201,168,76,0.2)' },
  jpDodgeBtn:  { borderColor: KA_COLORS.orangeSoft,       backgroundColor: 'rgba(230,126,34,0.2)' },
  jpSkillBtn:  { borderColor: KA_COLORS.orangeBright,     backgroundColor: 'rgba(255,107,53,0.25)' },
  jpPotionBtn: { borderColor: KA_COLORS.orangeDim,        backgroundColor: 'rgba(139,69,19,0.25)' },
  activeBtnBlock: { borderColor: KA_COLORS.orangeBright, backgroundColor: 'rgba(255,107,53,0.35)' },
  activeBtnDodge: { borderColor: KA_COLORS.orangePrimary, backgroundColor: 'rgba(204,85,0,0.35)'  },

  critNumber:    { fontSize: 14, color: '#f43f5e', fontWeight: 'bold' },
  healNumber:    { fontSize: 12, color: KA_COLORS.successBright, fontWeight: 'bold' },
  blockNumber:   { fontSize: 12, color: '#4169e1', fontWeight: 'bold' },
  dodgeNumber:   { fontSize: 12, color: '#32cd32', fontWeight: 'bold' },
  damageNumber:  { fontSize: 10, color: KA_COLORS.redAccent },

  jpResultScreen: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  jpResultWin:  { backgroundColor: 'rgba(10,40,20,0.96)' },
  jpResultLose: { backgroundColor: 'rgba(40,10,10,0.96)' },
  jpResultCard: {
    backgroundColor: KA_COLORS.bgCard, padding: 20, borderRadius: 8,
    borderWidth: 1, borderColor: KA_COLORS.border, alignItems: 'center', minWidth: 200,
  },
  jpResultKanji: { fontSize: 32, color: KA_COLORS.gold, marginBottom: 8, letterSpacing: 4 },
  jpResultTitle: { fontSize: 16, color: KA_COLORS.ivory, marginBottom: 12, letterSpacing: 2 },
  jpResultMsg:  { fontSize: 12, color: KA_COLORS.textSecondary, marginBottom: 4 },
  jpResultBtn: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: 6, borderWidth: 1, borderColor: KA_COLORS.gold,
    backgroundColor: KA_COLORS.bgElevated,
  },
  jpResultBtnWin:  { backgroundColor: 'rgba(74,124,89,0.3)' },
  jpResultBtnLose: { backgroundColor: 'rgba(196,30,58,0.3)' },
  jpResultBtnText: { fontSize: 12, color: KA_COLORS.gold, letterSpacing: 2 },
});

export default WaveModal;
