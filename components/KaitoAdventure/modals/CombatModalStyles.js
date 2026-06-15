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
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Svg, { Circle } from 'react-native-svg';

/* ══════════════════════════════════════════════════════════
   COLORS
══════════════════════════════════════════════════════════ */
const KA_COLORS = {
  bgPrimary:      '#0c0c0c',
  bgCard:         '#141210',
  bgElevated:     '#1a1714',
  bgInput:        '#0f0e0d',
  orangePrimary:  '#cc5500',
  orangeBright:   '#ff6b35',
  redAccent:      '#c41e3a',
  redDeep:        '#8b0000',
  gold:           '#c9a84c',
  goldBright:     '#ffd700',
  ivory:          '#f5e6d3',
  ivoryDim:       '#c4b5a0',
  ink:            '#2a2520',
  border:         '#2d2418',
  textPrimary:    '#f5e6d3',
  textSecondary:  '#a09080',
  textMuted:      '#6b5d4f',
  success:        '#4a7c59',
  successBright:  '#6ab77a',
  danger:         '#c41e3a',
  dangerSoft:     '#8b3a3a',
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
    move_forward: { frames: 8, loop: true,  speed: 60  },
  },
  bandit: {
    idle:         { frames: 4, loop: true,  speed: 200 },
    attack:       { frames: 6, loop: false, speed: 90  },
    hit:          { frames: 4, loop: false, speed: 100 },
    defeat:       { frames: 4, loop: false, speed: 150 },
    move_forward: { frames: 8, loop: true,  speed: 50  },
  },
  golem: {
    idle:         { frames: 4, loop: true,  speed: 250 },
    attack:       { frames: 6, loop: false, speed: 80  },
    hit:          { frames: 4, loop: false, speed: 120 },
    defeat:       { frames: 4, loop: false, speed: 150 },
    move_forward: { frames: 8, loop: true,  speed: 50  },
  },
  'shadow-ninja': {
    idle:         { frames: 4, loop: true,  speed: 180 },
    attack:       { frames: 6, loop: false, speed: 85  },
    hit:          { frames: 4, loop: false, speed: 100 },
    defeat:       { frames: 4, loop: false, speed: 150 },
    move_forward: { frames: 8, loop: true,  speed: 50  },
  },
};

const SUPABASE_URL =
  'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure';

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
   SPRITE ANIMATOR — optimised
   - uses requestAnimationFrame instead of setInterval
   - memoised so parent re-renders don't recreate it
══════════════════════════════════════════════════════════ */
const SpriteAnimator = memo(({ character, animation = 'idle', size = 150, freeze = false }) => {
  const charKey  = character === 'kaito' ? 'kaito' : getEnemyKey(character);
  const animKey  = animation || 'idle';
  const config   = SPRITE_CONFIG[charKey]?.[animKey] || SPRITE_CONFIG[charKey]?.idle;

  const [frame, setFrame] = useState(0);
  const rafRef   = useRef(null);
  const lastTime = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!config || freeze) return;
    frameRef.current = 0;
    setFrame(0);
    lastTime.current = 0;

    const tick = (ts) => {
      if (!lastTime.current) lastTime.current = ts;
      if (ts - lastTime.current >= config.speed) {
        lastTime.current = ts;
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

  const uri = `${SUPABASE_URL}/sprites/${charKey}/${animKey}/${animKey}_${padFrame(frame)}.png`;

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
});

/* ══════════════════════════════════════════════════════════
   COOLDOWN RING — reads a shared ref so no re-render needed
   We force a re-render only when the button switches ready/cooling.
══════════════════════════════════════════════════════════ */
const CooldownRing = memo(({ progress, ready }) => {
  const r    = 14;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;

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
   ACTION BUTTON — fully memoised so cooldown ticks don't
   cause sibling buttons to re-render
══════════════════════════════════════════════════════════ */
const ActionButton = memo(({ icon, kanji, label, onPress, disabled, progress, ready, btnStyle }) => (
  <TouchableOpacity
    style={[styles.jpActionBtn, btnStyle, ready ? styles.actionReady : styles.actionCooling]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.7}
  >
    <View style={styles.actionBtnTop}>
      <Icon name={icon} size={18} color={KA_COLORS.ivory} style={{ marginRight: 2 }} />
      <CooldownRing progress={progress} ready={ready} />
    </View>
    <Text style={styles.jpActionLabel}>{kanji}</Text>
    <Text style={styles.jpActionSub}>{label}</Text>
  </TouchableOpacity>
));

/* ══════════════════════════════════════════════════════════
   DISTANCE METER
══════════════════════════════════════════════════════════ */
const DistanceMeter = memo(({ distance, maxDistance = 100 }) => {
  const pct   = (distance / maxDistance) * 100;
  const color = distance <= 20 ? '#ffd700' : distance <= 50 ? '#ff6347' : '#90ee90';
  return (
    <View style={styles.distanceMeter}>
      <Text style={styles.distanceLabel}>DISTANCE</Text>
      <View style={styles.distanceBar}>
        <View style={[styles.distanceFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.distanceText, { color }]}>{Math.round(distance)}m</Text>
    </View>
  );
});

/* ══════════════════════════════════════════════════════════
   FLOATING DAMAGE
══════════════════════════════════════════════════════════ */
const FloatingDamage = memo(({ damage, type, x, y, isCritical }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 1400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -30, duration: 1400, useNativeDriver: true }),
    ]).start();
  }, []);

  const text = type === 'heal'  ? `+${damage}`
    : type === 'block'          ? 'BLOCK'
    : type === 'dodge'          ? 'DODGE!'
    : isCritical                ? `💥${damage}`
    : `-${damage}`;

  const color = type === 'heal'  ? KA_COLORS.successBright
    : type === 'block'           ? '#4169e1'
    : type === 'dodge'           ? '#32cd32'
    : isCritical                 ? '#f43f5e'
    : KA_COLORS.redAccent;

  const fontSize = isCritical ? 14 : 10;

  return (
    <Animated.Text
      style={[
        styles.floatingNumber,
        { left: x, top: y, opacity: fadeAnim, transform: [{ translateY: slideAnim }], color, fontSize, fontWeight: '700' },
      ]}
    >
      {text}
    </Animated.Text>
  );
});

/* ══════════════════════════════════════════════════════════
   ANNOUNCEMENT — isolated component, not tied to main state
══════════════════════════════════════════════════════════ */
const Announcement = memo(({ type, onComplete }) => {
  const [visible, setVisible] = useState(true);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const cfg = ANNOUNCEMENT_CONFIGS[type];

  useEffect(() => {
    if (!cfg) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => { setVisible(false); onComplete?.(); }, cfg.duration);
    return () => clearTimeout(t);
  }, [type]);

  if (!visible || !cfg) return null;
  return (
    <Animated.View
      style={[styles.announcementOverlay, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      pointerEvents="none"
    >
      <Text style={[styles.announcementText, { color: cfg.color }]}>{cfg.text}</Text>
    </Animated.View>
  );
});

/* ══════════════════════════════════════════════════════════
   HEALTH BAR — isolated, only re-renders when hp changes
══════════════════════════════════════════════════════════ */
const HealthBar = memo(({ name, hp, maxHp, isEnemy, statusText, statusColor }) => {
  const pct     = Math.max(0, (hp / maxHp) * 100);
  const danger  = hp < maxHp / 3;
  return (
    <View style={styles.jpHealthSide}>
      <View style={styles.jpHealthNameRow}>
        <Text style={styles.jpNameTag}>{name}</Text>
        <Text style={styles.jpHpText}>{hp}<Text style={styles.jpHpSep}>/</Text>{maxHp}</Text>
      </View>
      <View style={[styles.jpHpTrack, danger && styles.jpHpDanger]}>
        <View style={[isEnemy ? styles.jpHpFillEnemy : styles.jpHpFill, { width: `${pct}%` }]} />
        <View style={styles.jpHpShine} />
      </View>
      {!!statusText && <Text style={[styles.statusBadge, { color: statusColor }]}>{statusText}</Text>}
    </View>
  );
});

/* ══════════════════════════════════════════════════════════
   COOLDOWN MANAGER HOOK
   All timing tracked in refs — zero setState per tick.
   Only triggers render when ready state flips.
══════════════════════════════════════════════════════════ */
function useCooldowns() {
  const lastUsed = useRef({
    basicAttack: 0,
    skillAttack: 0,
    block:       0,
    dodge:       0,
    heal:        0,
    move:        0,
  });

  // Per-action ready state — only these drive re-renders
  const [ready, setReady] = useState({
    basicAttack: true,
    skillAttack: true,
    block:       true,
    dodge:       true,
    heal:        true,
    move:        true,
  });

  const readyRef = useRef({
    basicAttack: true,
    skillAttack: true,
    block:       true,
    dodge:       true,
    heal:        true,
    move:        true,
  });

  const timersRef = useRef({});

  const getProgress = useCallback((action) => {
    const elapsed = Date.now() - lastUsed.current[action];
    return Math.min(1, elapsed / COOLDOWNS[action]);
  }, []);

  const isReady = useCallback((action) => readyRef.current[action], []);

  const stamp = useCallback((action) => {
    lastUsed.current[action] = Date.now();
    if (readyRef.current[action]) {
      readyRef.current[action] = false;
      setReady(r => ({ ...r, [action]: false }));
    }
    if (timersRef.current[action]) clearTimeout(timersRef.current[action]);
    timersRef.current[action] = setTimeout(() => {
      readyRef.current[action] = true;
      setReady(r => ({ ...r, [action]: true }));
    }, COOLDOWNS[action]);
  }, []);

  const resetAll = useCallback(() => {
    Object.keys(lastUsed.current).forEach(k => { lastUsed.current[k] = 0; });
    Object.keys(timersRef.current).forEach(k => clearTimeout(timersRef.current[k]));
    const allReady = Object.fromEntries(Object.keys(COOLDOWNS).map(k => [k, true]));
    readyRef.current = { ...allReady };
    setReady(allReady);
  }, []);

  useEffect(() => () => Object.values(timersRef.current).forEach(clearTimeout), []);

  return { ready, isReady, stamp, getProgress, resetAll };
}

/* ══════════════════════════════════════════════════════════
   COMBAT MODAL
══════════════════════════════════════════════════════════ */
const CombatModal = ({ combat, combatResult, player, enemy, combatAttack, craftCombatPotion, toggleModal }) => {
  const combatState = combat;

  /* --- visual state (grouped to reduce renders) --- */
  const [damageNumbers, setDamageNumbers]       = useState([]);
  const [announcement, setAnnouncement]         = useState(null);
  const [showResult, setShowResult]             = useState(false);
  const [victoryPose, setVictoryPose]           = useState(false);
  const [perfectWin, setPerfectWin]             = useState(false);
  const [playerAnimation, setPlayerAnimation]   = useState('idle');
  const [enemyAnimation, setEnemyAnimation]     = useState('idle');
  const [isBlocking, setIsBlocking]             = useState(false);
  const [isDodging, setIsDodging]               = useState(false);
  const [playerPos, setPlayerPos]               = useState(20);
  const [enemyPos, setEnemyPos]                 = useState(80);
  const [distance, setDistance]                 = useState(60);

  const { ready, isReady, stamp, getProgress, resetAll } = useCooldowns();

  /* refs that don't need re-renders */
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
  const dmgIdCounter   = useRef(0);

  /* Keep refs in sync with state */
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
      Animated.timing(shakeAnim, { toValue: 7,  duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 45, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const addDmg = useCallback((damage, type, x, y, isCritical = false) => {
    const id = ++dmgIdCounter.current;
    setDamageNumbers(p => [...p.slice(-5), { id, damage, type, x, y, isCritical }]);
    setTimeout(() => setDamageNumbers(p => p.filter(d => d.id !== id)), 1500);
  }, []);

  const playPlayerAnim = useCallback((anim, fallback = 'idle') => {
    setPlayerAnimation(anim);
    clearTimeout(playerAnimTmr.current);
    playerAnimTmr.current = setTimeout(
      () => setPlayerAnimation(fallback),
      getAnimDuration('kaito', anim),
    );
  }, []);

  const enemyKey = enemy ? getEnemyKey(enemy.name) : combatState ? getEnemyKey(combatState.enemy?.name) : 'bandit';

  const playEnemyAnim = useCallback((anim, fallback = 'idle') => {
    setEnemyAnimation(anim);
    clearTimeout(enemyAnimTmr.current);
    enemyAnimTmr.current = setTimeout(
      () => setEnemyAnimation(fallback),
      getAnimDuration(enemyKey, anim),
    );
  }, [enemyKey]);

  const showAnn = useCallback((type) => {
    setAnnouncement(type);
  }, []);

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
  }, [combatState, combatResult, resetAll, showAnn]);

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
      shake();
      setTimeout(() => setShowResult(true), 2500);
    } else if (combatResult.type === 'fail') {
      setPlayerAnimation('defeat');
      showAnn('DEFEAT');
      shake();
      setTimeout(() => setShowResult(true), 2000);
    }
  }, [combatResult]);

  /* ── enemy AI — only reschedule when combat becomes active ── */
  const scheduleEnemy = useCallback(() => {
    clearTimeout(enemyAITmr.current);
    if (!combatActive.current) return;

    const delay = ENEMY_ATTACK_INTERVAL_MS
      + (Math.random() * ENEMY_ATTACK_VARIANCE * 2 - ENEMY_ATTACK_VARIANCE);

    enemyAITmr.current = setTimeout(() => {
      if (!combatActive.current) return;

      const rand = Math.random();

      if (distanceRef.current > 55 && rand < 0.25) {
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
            const blocked = Math.round(finalDmg * 0.25);
            addDmg(blocked, 'block', '22%', '32%');
            showAnn('BLOCK');
            shake();
            combatAttack('__enemy_blocked__');
          } else if (isDodgingRef.current) {
            addDmg(0, 'dodge', '22%', '32%');
            showAnn('DODGE');
          } else {
            addDmg(finalDmg, 'damage', '22%', '32%', isCrit);
            playPlayerAnim('hit');
            if (isCrit) { shake(); showAnn('CRITICAL'); }
            else shake();
            combatAttack('__enemy_attack__');
          }
        }, atkDur * 0.55);
      }

      scheduleEnemy();
    }, delay);
  }, [enemyKey]);  // intentionally minimal deps — reads everything via refs

  useEffect(() => {
    if (combatActive.current && combatState && !combatResult) {
      scheduleEnemy();
    }
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

      const dist     = distanceRef.current;
      const distBonus = dist <= 30 ? 1.4 : 1.0;
      const isCrit   = Math.random() > (isSkill ? 0.65 : 0.78);
      const baseDmg  = isSkill ? 25 : 15;
      const finalDmg = Math.round(baseDmg * distBonus * (isCrit ? 1.9 : 1));

      clearTimeout(comboResetTmr.current);
      comboCount.current += 1;
      const cc = comboCount.current;
      if (cc >= 2 && cc <= 5) showAnn(`COMBO_${cc}`);
      comboResetTmr.current = setTimeout(() => { comboCount.current = 0; }, 3000);

      if (isCrit) { shake(); showAnn('CRITICAL'); }
      else shake();

      playEnemyAnim('hit');
      addDmg(finalDmg, isCrit ? 'crit' : 'damage', `${enemyPosRef.current - 5}%`, '28%', isCrit);
      if (dist <= 30 && cc === 1) showAnn('CLOSE_COMBAT');
    }, atkDur * 0.55);
  }, [combatResult, isReady, stamp, playPlayerAnim, playEnemyAnim, addDmg, shake, showAnn, combatAttack]);

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
    const dur = getAnimDuration('kaito', 'healing');
    setTimeout(() => {
      if (!combatActive.current) return;
      craftCombatPotion(potionName);
      addDmg(30, 'heal', '22%', '28%');
    }, dur * 0.5);
  }, [combatResult, isReady, stamp, playPlayerAnim, craftCombatPotion, addDmg]);

  /* ── loading state ── */
  if (!combatState && !combatResult) {
    return (
      <View style={styles.combatCard}>
        <View style={styles.jpHeader}>
          <Text style={styles.jpHeaderKanji}>決闘</Text>
          <Text style={styles.jpHeaderSub}>DOJO ARENA</Text>
        </View>
        <View style={[styles.combatBody, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={[styles.jpHeaderKanji, { fontSize: 24 }]}>待</Text>
          <Text style={styles.jpHeaderSub}>Preparing for battle...</Text>
        </View>
      </View>
    );
  }

  const playerHp    = combatState?.playerHealth ?? player.health;
  const enemyHp     = combatState?.enemyHealth ?? 0;
  const enemyMaxHp  = enemy?.max_health ?? combatState?.enemyMaxHealth ?? 1;
  const enemyName   = enemy?.name ?? combatState?.enemy?.name ?? 'ENEMY';

  const playerStatus = isBlocking ? { text: '🛡 BLOCKING', color: '#4169e1' }
    : isDodging ? { text: '💨 EVADING', color: '#32cd32' }
    : null;

  const enemyStatus = enemyHp < enemyMaxHp / 3
    ? { text: '⚠ FINISH HIM', color: '#ff0000' }
    : null;

  /* progress values — computed inline, no state */
  const pBasic = getProgress('basicAttack');
  const pSkill = getProgress('skillAttack');
  const pBlock = getProgress('block');
  const pDodge = getProgress('dodge');
  const pHeal  = getProgress('heal');
  const pMove  = getProgress('move');

  return (
    <Animated.View style={[styles.combatCard, { transform: [{ translateX: shakeAnim }] }]}>

      {/* ── Header ── */}
      <View style={styles.jpHeader}>
        <View style={styles.jpHeaderLeft}>
          <Icon name="gavel" size={20} color={KA_COLORS.gold} />
          <View>
            <Text style={styles.jpHeaderKanji}>決闘</Text>
            <Text style={styles.jpHeaderSub}>KETTO</Text>
          </View>
        </View>

        <View style={styles.realtimeIndicator}>
          <View style={styles.realtimeDot} />
          <Text style={styles.realtimeText}>REAL-TIME</Text>
        </View>

        <TouchableOpacity
          style={styles.jpFleeBtn}
          onPress={() => toggleModal('combat')}
          disabled={isBlocking || isDodging}
          activeOpacity={0.7}
        >
          <Icon name="running" size={14} color={KA_COLORS.textSecondary} />
          <Text style={styles.jpFleeText}>逃</Text>
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={styles.combatBody}>

        {/* Health Bars */}
        <View style={styles.jpHealthBars}>
          <HealthBar
            name="KAITO"
            hp={playerHp}
            maxHp={player.max_health}
            isEnemy={false}
            statusText={playerStatus?.text}
            statusColor={playerStatus?.color}
          />
          <Text style={styles.jpVsDivider}>対</Text>
          <HealthBar
            name={enemyName.toUpperCase()}
            hp={enemyHp}
            maxHp={enemyMaxHp}
            isEnemy={true}
            statusText={enemyStatus?.text}
            statusColor={enemyStatus?.color}
          />
        </View>

        {/* Distance */}
        <DistanceMeter distance={distance} />

        {/* Stage */}
        <View style={styles.fightingStage}>
          {/* BG */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.stageWall} />
            <View style={styles.stageFloor} />
          </View>

          {/* Kanji banners */}
          <View style={[StyleSheet.absoluteFill, styles.jpStageOverlay]} pointerEvents="none">
            <Text style={styles.jpBannerLeft}>戦</Text>
            <Text style={styles.jpBannerRight}>闘</Text>
            <Text style={styles.jpSigil}>道場</Text>
          </View>

          {/* Fighters */}
          <View style={[StyleSheet.absoluteFill, styles.fightersContainer]} pointerEvents="none">
            <View style={[styles.fighter, styles.playerFighter, { left: `${playerPos}%` }]}>
              <SpriteAnimator character="kaito" animation={playerAnimation} size={120} />
            </View>
            <View style={[styles.fighter, styles.enemyFighter, { left: `${enemyPos}%` }]}>
              <SpriteAnimator
                character={combatState?.enemy?.name || 'bandit'}
                animation={enemyAnimation}
                size={120}
              />
            </View>
          </View>

          {/* Damage numbers */}
          {damageNumbers.map(d => (
            <FloatingDamage key={d.id} {...d} />
          ))}

          {/* Announcement */}
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

          {/* Combat log */}
          {combatState?.log?.length > 0 && (
            <View style={styles.jpLogFloat}>
              <Text style={styles.jpLogTitle}>戦記</Text>
              <ScrollView style={{ maxHeight: 40 }}>
                {combatState.log.slice(-5).map((e, i) => (
                  <Text key={i} style={styles.jpLogEntry}>{e}</Text>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Equipment strip */}
        {(player.equipment?.weapon || player.equipment?.armor) && (
          <View style={styles.jpEquipStrip}>
            {player.equipment?.weapon && (
              <View style={styles.jpEquipSlot}>
                <Icon name="gavel" size={12} color={KA_COLORS.gold} />
                <Text style={styles.jpEquipText}>{player.equipment.weapon}</Text>
              </View>
            )}
            {player.equipment?.armor && (
              <View style={styles.jpEquipSlot}>
                <Icon name="shield-alt" size={12} color={KA_COLORS.gold} />
                <Text style={styles.jpEquipText}>{player.equipment.armor}</Text>
              </View>
            )}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.jpActionPanel}>
          <View style={styles.jpActionGrid}>
            <ActionButton
              icon="gavel"
              kanji="斬"
              label="ATTACK"
              onPress={() => handleAttack('Basic Attack')}
              disabled={!ready.basicAttack || !!combatResult}
              progress={pBasic}
              ready={ready.basicAttack && !combatResult}
              btnStyle={styles.jpAttackBtn}
            />
            <ActionButton
              icon="arrows-alt-h"
              kanji="進"
              label="ADVANCE"
              onPress={handleMove}
              disabled={!ready.move || !!combatResult || distance <= 20}
              progress={pMove}
              ready={ready.move && !combatResult && distance > 20}
              btnStyle={styles.jpMoveBtn}
            />
            <ActionButton
              icon="shield-alt"
              kanji="守"
              label="BLOCK"
              onPress={handleBlock}
              disabled={!ready.block || !!combatResult}
              progress={pBlock}
              ready={ready.block && !combatResult}
              btnStyle={isBlocking ? styles.activeBtnBlock : styles.jpBlockBtn}
            />
            <ActionButton
              icon="shoe-prints"
              kanji="避"
              label="DODGE"
              onPress={handleDodge}
              disabled={!ready.dodge || !!combatResult}
              progress={pDodge}
              ready={ready.dodge && !combatResult}
              btnStyle={isDodging ? styles.activeBtnDodge : styles.jpDodgeBtn}
            />
            <ActionButton
              icon="bolt"
              kanji="技"
              label="SKILL"
              onPress={() => handleAttack('Power Strike')}
              disabled={!ready.skillAttack || !!combatResult}
              progress={pSkill}
              ready={ready.skillAttack && !combatResult}
              btnStyle={styles.jpSkillBtn}
            />
            <ActionButton
              icon="flask"
              kanji="薬"
              label="HEAL"
              onPress={() => handleHeal('Weak Healing Potion')}
              disabled={!ready.heal || !!combatResult}
              progress={pHeal}
              ready={ready.heal && !combatResult}
              btnStyle={styles.jpPotionBtn}
            />
          </View>

          <View style={styles.hintBar}>
            <Text style={styles.hintText}>Block = 75% dmg reduction · Dodge = full evade</Text>
          </View>
        </View>

        {/* Result Modal */}
        {showResult && combatResult && (
          <Modal visible transparent animationType="fade">
            <View style={[styles.jpResultScreen, combatResult.type === 'win' ? styles.jpResultWin : styles.jpResultLose]}>
              <View style={styles.jpResultCard}>
                <Text style={styles.jpResultKanji}>{combatResult.type === 'win' ? '勝' : '敗'}</Text>
                <Text style={styles.jpResultTitle}>{combatResult.type === 'win' ? 'VICTORY' : 'DEFEAT'}</Text>
                <Text style={styles.jpResultMsg}>{combatResult.message}</Text>

                {combatResult.type === 'win' && (
                  <View style={styles.jpRewards}>
                    <View style={styles.jpRewardItem}>
                      <Icon name="coins" size={16} color={KA_COLORS.gold} />
                      <Text style={styles.jpRewardText}>+{combatState?.enemy?.gold ?? 0} Gold</Text>
                    </View>
                    <View style={styles.jpRewardItem}>
                      <Icon name="star" size={16} color={KA_COLORS.gold} />
                      <Text style={styles.jpRewardText}>+{enemyName === 'Bandit' ? 20 : 25} XP</Text>
                    </View>
                    {perfectWin && (
                      <View style={styles.jpRewardItem}>
                        <Icon name="star" size={16} color={KA_COLORS.gold} />
                        <Text style={styles.jpRewardText}>PERFECT BONUS</Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.jpResultBtn, combatResult.type === 'win' ? styles.jpResultBtnWin : styles.jpResultBtnLose]}
                  onPress={() => toggleModal('combat')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.jpResultBtnText}>
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
   STYLES
══════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
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
  jpHeaderKanji: { fontSize: 12, fontWeight: '700', color: KA_COLORS.gold, letterSpacing: 2 },
  jpHeaderSub:   { fontSize: 6,  color: KA_COLORS.textSecondary, letterSpacing: 1 },
  realtimeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  realtimeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#22c55e' },
  realtimeText: { fontSize: 6, fontWeight: '700', color: KA_COLORS.gold, letterSpacing: 1 },
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
  jpNameTag:  { fontSize: 8, fontWeight: '700', color: KA_COLORS.ivory, letterSpacing: 1 },
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
  statusBadge: { fontSize: 6, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  jpVsDivider: { fontSize: 12, fontWeight: '700', color: KA_COLORS.gold, marginHorizontal: 8 },

  distanceMeter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distanceLabel: { fontSize: 6, color: KA_COLORS.textSecondary, letterSpacing: 1 },
  distanceBar: { flex: 1, height: 3, backgroundColor: KA_COLORS.ink, borderRadius: 1.5, overflow: 'hidden' },
  distanceFill: { height: '100%' },
  distanceText: { fontSize: 6, minWidth: 20, textAlign: 'right' },

  fightingStage: {
    height: 110,
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
  jpBannerLeft: { position: 'absolute', left: 5, top: 5, fontSize: 22, fontWeight: '700', color: 'rgba(218,165,32,0.2)' },
  jpBannerRight: { position: 'absolute', right: 5, top: 5, fontSize: 22, fontWeight: '700', color: 'rgba(218,165,32,0.2)' },
  jpSigil: { fontSize: 11, fontWeight: '700', color: 'rgba(218,165,32,0.12)', letterSpacing: 4 },

  fightersContainer: { position: 'relative' },
  fighter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  playerFighter: { top: '20%' },
  enemyFighter:  { top: '20%', transform: [{ scaleX: -1 }] },

  floatingNumber: { position: 'absolute', zIndex: 5, fontWeight: '700' },

  announcementOverlay: {
    position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 10,
  },
  announcementText: { fontSize: 16, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },

  jpLogFloat: {
    position: 'absolute', top: 4, right: 4, width: 72,
    backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 4,
    borderWidth: 1, borderColor: KA_COLORS.gold, zIndex: 10, padding: 4,
  },
  jpLogTitle: { fontSize: 6, fontWeight: '700', color: KA_COLORS.gold, marginBottom: 3, letterSpacing: 1 },
  jpLogEntry: { fontSize: 5, color: KA_COLORS.ivory, marginBottom: 2 },

  jpEquipStrip: { flexDirection: 'row', gap: 6 },
  jpEquipSlot: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 5, paddingVertical: 3,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1, borderColor: KA_COLORS.border, borderRadius: 2,
  },
  jpEquipText: { fontSize: 6, color: KA_COLORS.ivory },

  jpActionPanel: {
    backgroundColor: KA_COLORS.bgElevated,
    borderTopWidth: 1, borderTopColor: KA_COLORS.border,
    padding: 6, borderRadius: 4,
  },
  jpActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },

  jpActionBtn: {
    flex: 1, minWidth: '30%', paddingVertical: 6,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1, borderColor: KA_COLORS.border,
    borderRadius: 4, alignItems: 'center', gap: 2,
  },
  actionBtnTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  jpActionLabel: { fontSize: 10, fontWeight: '700', color: KA_COLORS.ivory },
  jpActionSub:   { fontSize: 5, color: KA_COLORS.textSecondary, letterSpacing: 0.5 },
  actionReady:   { opacity: 1 },
  actionCooling: { opacity: 0.45 },

  jpAttackBtn: { borderColor: KA_COLORS.redAccent,  backgroundColor: 'rgba(196,30,58,0.15)' },
  jpMoveBtn:   { borderColor: KA_COLORS.success,    backgroundColor: 'rgba(74,124,89,0.15)' },
  jpBlockBtn:  { borderColor: KA_COLORS.gold,        backgroundColor: 'rgba(201,168,76,0.15)' },
  jpDodgeBtn:  { borderColor: '#60a5fa',             backgroundColor: 'rgba(96,165,250,0.15)' },
  jpSkillBtn:  { borderColor: '#f59e0b',             backgroundColor: 'rgba(245,158,11,0.15)' },
  jpPotionBtn: { borderColor: '#a78bfa',             backgroundColor: 'rgba(167,139,250,0.15)' },
  activeBtnBlock: { borderColor: '#4169e1', backgroundColor: 'rgba(65,105,225,0.3)' },
  activeBtnDodge: { borderColor: '#32cd32', backgroundColor: 'rgba(50,205,50,0.3)'  },

  hintBar: { marginTop: 5, alignItems: 'center' },
  hintText: { fontSize: 5, color: KA_COLORS.textSecondary },

  jpResultScreen: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  jpResultWin:  { backgroundColor: 'rgba(10,40,20,0.96)' },
  jpResultLose: { backgroundColor: 'rgba(40,10,10,0.96)' },
  jpResultCard: {
    backgroundColor: KA_COLORS.bgCard, padding: 20, borderRadius: 8,
    borderWidth: 1, borderColor: KA_COLORS.border, alignItems: 'center', minWidth: 200,
  },
  jpResultKanji: { fontSize: 40, fontWeight: '700', color: KA_COLORS.gold, marginBottom: 8 },
  jpResultTitle: { fontSize: 14, fontWeight: '700', color: KA_COLORS.ivory, marginBottom: 4 },
  jpResultMsg:   { fontSize: 7, color: KA_COLORS.textSecondary, marginBottom: 14, textAlign: 'center' },
  jpRewards: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  jpRewardItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jpRewardText:  { fontSize: 8, color: KA_COLORS.gold },
  jpResultBtn:   { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 4 },
  jpResultBtnWin:  { backgroundColor: KA_COLORS.success },
  jpResultBtnLose: { backgroundColor: KA_COLORS.redAccent },
  jpResultBtnText: { fontSize: 9, fontWeight: '700', color: KA_COLORS.ivory },
});

export { KA_COLORS };
export default CombatModal;