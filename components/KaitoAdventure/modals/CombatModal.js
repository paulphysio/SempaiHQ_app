import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Animated, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Svg, { Circle } from 'react-native-svg';
import { styles, KA_COLORS } from '../../../styles/KaitoAdventureStyles';

/* ══════════════════════════════════════════════════════════
   SPRITE CONFIGURATION
══════════════════════════════════════════════════════════ */
const SPRITE_CONFIG = {
  kaito: {
    idle: { frames: 6, loop: true, speed: 180 },
    basic_attack: { frames: 9, loop: false, speed: 80 },
    skill_attack: { frames: 7, loop: false, speed: 90 },
    healing: { frames: 6, loop: false, speed: 120 },
    hit: { frames: 4, loop: false, speed: 100 },
    victory: { frames: 5, loop: true, speed: 150 },
    defeat: { frames: 4, loop: false, speed: 150 },
    block: { frames: 3, loop: false, speed: 100 },
    dodge: { frames: 4, loop: false, speed: 80 },
    move_forward: { frames: 8, loop: true, speed: 60 },
  },
  bandit: {
    idle: { frames: 4, loop: true, speed: 200 },
    attack: { frames: 6, loop: false, speed: 90 },
    hit: { frames: 4, loop: false, speed: 100 },
    defeat: { frames: 4, loop: false, speed: 150 },
    move_forward: { frames: 8, loop: true, speed: 50 },
  },
  golem: {
    idle: { frames: 4, loop: true, speed: 250 },
    attack: { frames: 6, loop: false, speed: 80 },
    hit: { frames: 4, loop: false, speed: 120 },
    defeat: { frames: 4, loop: false, speed: 150 },
    move_forward: { frames: 8, loop: true, speed: 50 },
  },
  'shadow-ninja': {
    idle: { frames: 4, loop: true, speed: 180 },
    attack: { frames: 6, loop: false, speed: 85 },
    hit: { frames: 4, loop: false, speed: 100 },
    defeat: { frames: 4, loop: false, speed: 150 },
    move_forward: { frames: 8, loop: true, speed: 50 },
  },
};

const SUPABASE_URL = 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/kaito-adventure';

/* ══════════════════════════════════════════════════════════
   COMBAT CONSTANTS
══════════════════════════════════════════════════════════ */
const COOLDOWNS = {
  basicAttack: 1200,
  skillAttack: 2500,
  block: 800,
  dodge: 1000,
  heal: 3000,
  move: 600,
};

const ENEMY_ATTACK_INTERVAL_MS = 2800;
const ENEMY_ATTACK_VARIANCE = 800;

/* ══════════════════════════════════════════════════════════
   ANNOUNCEMENTS
══════════════════════════════════════════════════════════ */
const ANNOUNCEMENTS = {
  FIGHT: { text: 'FIGHT!', color: '#ffd700', duration: 1800 },
  FINISH_HIM: { text: 'FINISH HIM!', color: '#ff0000', duration: 3000 },
  FATALITY: { text: 'FATALITY', color: '#dc143c', duration: 4000 },
  VICTORY: { text: 'VICTORY', color: '#ffd700', duration: 3000 },
  DEFEAT: { text: 'DEFEAT', color: '#8b0000', duration: 3000 },
  FLAWLESS: { text: 'FLAWLESS VICTORY', color: '#ffd700', duration: 4000 },
  CRITICAL: { text: 'CRITICAL HIT!', color: '#ff6347', duration: 1200 },
  BLOCK: { text: 'BLOCK!', color: '#4169e1', duration: 900 },
  DODGE: { text: 'DODGE!', color: '#32cd32', duration: 900 },
  CLOSE_COMBAT: { text: 'CLOSE COMBAT!', color: '#ff8c00', duration: 1000 },
  COMBO_2: { text: '2 HITS', color: '#ff8c00', duration: 1000 },
  COMBO_3: { text: '3 HITS', color: '#ff6347', duration: 1000 },
  COMBO_4: { text: '4 HITS', color: '#ff0000', duration: 1000 },
  COMBO_5: { text: '5 HITS', color: '#dc143c', duration: 1200 },
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
   SPRITE ANIMATOR
══════════════════════════════════════════════════════════ */
const SpriteAnimator = ({ character, animation = 'idle', size = 150, freeze = false }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [imgSrc, setImgSrc] = useState('');
  const animRef = useRef(null);

  const charKey = character === 'kaito' ? 'kaito' : getEnemyKey(character);
  const animKey = animation || 'idle';
  const config = SPRITE_CONFIG[charKey]?.[animKey] || SPRITE_CONFIG[charKey]?.idle;

  useEffect(() => {
    if (!config) return;
    setCurrentFrame(0);
    if (animRef.current) clearInterval(animRef.current);
    if (freeze) return;

    if (config.loop) {
      animRef.current = setInterval(() => {
        setCurrentFrame(p => (p + 1) % config.frames);
      }, config.speed);
    } else {
      let frame = 0;
      animRef.current = setInterval(() => {
        frame++;
        if (frame >= config.frames) { clearInterval(animRef.current); return; }
        setCurrentFrame(frame);
      }, config.speed);
    }
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [animation, charKey, freeze]);

  useEffect(() => {
    if (!config) return;
    const frameNum = String(currentFrame + 1).padStart(3, '0');
    setImgSrc(`${SUPABASE_URL}/sprites/${charKey}/${animKey}/${animKey}_${frameNum}.png`);
  }, [currentFrame, config, charKey, animKey]);

  return (
    <Image
      source={{ uri: imgSrc || `${SUPABASE_URL}/sprites/${charKey}/${animKey}/${animKey}_001.png` }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
};

/* ══════════════════════════════════════════════════════════
   COOLDOWN RING
══════════════════════════════════════════════════════════ */
const CooldownRing = ({ cooldownMs, totalMs, ready }) => {
  const progress = ready ? 1 : Math.max(0, 1 - cooldownMs / totalMs);
  const r = 14, circ = 2 * Math.PI * r;
  const dash = circ * progress;

  return (
    <Svg width={32} height={32}>
      <Circle cx={16} cy={16} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={2.5} />
      <Circle
        cx={16}
        cy={16}
        r={r}
        fill="none"
        stroke={ready ? '#ffd700' : '#ff6347'}
        strokeWidth={2.5}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
      />
    </Svg>
  );
};

/* ══════════════════════════════════════════════════════════
   DISTANCE METER
══════════════════════════════════════════════════════════ */
const DistanceMeter = ({ distance, maxDistance = 100 }) => {
  const pct = (distance / maxDistance) * 100;
  const color = distance <= 20 ? '#ffd700' : distance <= 50 ? '#ff6347' : '#90ee90';

  return (
    <View style={combatModalStyles.distanceMeter}>
      <Text style={combatModalStyles.distanceLabel}>DISTANCE</Text>
      <View style={combatModalStyles.distanceBar}>
        <View style={[combatModalStyles.distanceFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[combatModalStyles.distanceText, { color }]}>{Math.round(distance)}m</Text>
    </View>
  );
};

/* ══════════════════════════════════════════════════════════
   ANNOUNCEMENT
══════════════════════════════════════════════════════════ */
const Announcement = ({ type, onComplete }) => {
  const [visible, setVisible] = useState(true);
  const config = ANNOUNCEMENTS[type];

  useEffect(() => {
    if (!config) return;
    const t = setTimeout(() => { setVisible(false); onComplete?.(); }, config.duration);
    return () => clearTimeout(t);
  }, [type, config, onComplete]);

  if (!visible || !config) return null;
  return (
    <View style={combatModalStyles.announcementOverlay}>
      <Text style={[combatModalStyles.announcementText, { color: config.color }]}>
        {config.text}
      </Text>
    </View>
  );
};

/* ══════════════════════════════════════════════════════════
   SCREEN FLASH
══════════════════════════════════════════════════════════ */
const ScreenFlash = ({ color = '#ffffff', duration = 200 }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => setVisible(false), duration); return () => clearTimeout(t); }, [duration]);
  if (!visible) return null;
  return <View style={[combatModalStyles.screenFlash, { backgroundColor: color, opacity: 0.35 }]} />;
};

/* ══════════════════════════════════════════════════════════
   FLOATING DAMAGE NUMBER
══════════════════════════════════════════════════════════ */
const FloatingDamage = ({ damage, type = 'damage', x, y, isCritical = false }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const textStyle = isCritical ? combatModalStyles.critNumber
    : type === 'heal' ? combatModalStyles.healNumber
    : type === 'block' ? combatModalStyles.blockNumber
    : type === 'dodge' ? combatModalStyles.dodgeNumber
    : combatModalStyles.damageNumber;

  const text = type === 'heal' ? `+${damage}`
    : type === 'block' ? `BLOCK`
    : type === 'dodge' ? 'DODGE!'
    : isCritical ? `💥${damage}`
    : `-${damage}`;

  return (
    <View style={[combatModalStyles.floatingNumber, textStyle, { left: x, top: y }]}>
      <Text>{text}</Text>
    </View>
  );
};

/* ══════════════════════════════════════════════════════════
   MAIN COMBAT MODAL
══════════════════════════════════════════════════════════ */
const CombatModal = ({ combat, combatResult, player, enemy, combatAttack, craftCombatPotion, toggleModal }) => {
  // Map combat prop to combatState for consistency
  const combatState = combat;
  // Visuals
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [screenShake, setScreenShake] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [flashColor, setFlashColor] = useState(null);
  const [showResultScreen, setShowResultScreen] = useState(false);
  const [victoryPose, setVictoryPose] = useState(false);
  const [perfectWin, setPerfectWin] = useState(false);
  const [roundStart, setRoundStart] = useState(true);

  // Animations
  const [playerAnimation, setPlayerAnimation] = useState('idle');
  const [enemyAnimation, setEnemyAnimation] = useState('idle');
  const playerAnimTimer = useRef(null);
  const enemyAnimTimer = useRef(null);

  // Real-time cooldown tracking
  const lastUsed = useRef({
    basicAttack: 0,
    skillAttack: 0,
    block: 0,
    dodge: 0,
    heal: 0,
    move: 0,
  });
  const [tick, setTick] = useState(0);
  const tickRef = useRef(null);

  // Block / Dodge state
  const [isBlocking, setIsBlocking] = useState(false);
  const [isDodging, setIsDodging] = useState(false);
  const blockTimer = useRef(null);
  const dodgeTimer = useRef(null);

  // Combat active flag
  const combatActive = useRef(false);

  // Positioning
  const [playerPosition, setPlayerPosition] = useState(20);
  const [enemyPosition, setEnemyPosition] = useState(80);
  const [distance, setDistance] = useState(60);

  // Combo
  const comboCount = useRef(0);
  const comboResetRef = useRef(null);

  // Enemy AI timer
  const enemyAITimer = useRef(null);

  // Shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current;

  /* Helpers */
  const now = () => Date.now();

  const isCooledDown = useCallback((action) => {
    return now() - lastUsed.current[action] >= COOLDOWNS[action];
  }, []);

  const getCooldownRemaining = useCallback((action) => {
    return Math.max(0, COOLDOWNS[action] - (now() - lastUsed.current[action]));
  }, []);

  const stamp = useCallback((action) => {
    lastUsed.current[action] = now();
  }, []);

  const addDamageNumber = useCallback((damage, type, x, y, isCritical = false) => {
    const id = now() + Math.random();
    setDamageNumbers(p => [...p, { id, damage, type, x, y, isCritical }]);
    setTimeout(() => setDamageNumbers(p => p.filter(d => d.id !== id)), 1900);
  }, []);

  const shake = useCallback((intensity = 'normal') => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const flash = useCallback((color, duration = 200) => {
    setFlashColor(color);
    setTimeout(() => setFlashColor(null), duration);
  }, []);

  const playPlayerAnim = useCallback((anim, fallback = 'idle') => {
    setPlayerAnimation(anim);
    if (playerAnimTimer.current) clearTimeout(playerAnimTimer.current);
    const dur = getAnimDuration('kaito', anim);
    playerAnimTimer.current = setTimeout(() => setPlayerAnimation(fallback), dur);
  }, []);

  const playEnemyAnim = useCallback((anim, enemyKey, fallback = 'idle') => {
    setEnemyAnimation(anim);
    if (enemyAnimTimer.current) clearTimeout(enemyAnimTimer.current);
    const dur = getAnimDuration(enemyKey, anim);
    enemyAnimTimer.current = setTimeout(() => setEnemyAnimation(fallback), dur);
  }, []);

  // Distance tracking
  useEffect(() => {
    setDistance(Math.abs(enemyPosition - playerPosition));
  }, [playerPosition, enemyPosition]);

  // Ticker for cooldown UI
  useEffect(() => {
    tickRef.current = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(tickRef.current);
  }, []);

  // Round Start
  useEffect(() => {
    if (combatState && !combatResult && roundStart) {
      setRoundStart(false);
      combatActive.current = true;
      setAnnouncement('FIGHT');
      setShowResultScreen(false);
      setVictoryPose(false);
      setPerfectWin(false);
      comboCount.current = 0;
      setPlayerPosition(20);
      setEnemyPosition(80);
      Object.keys(lastUsed.current).forEach(k => { lastUsed.current[k] = 0; });
    }
  }, [combatState, combatResult, roundStart]);

  // Combat Result Handler
  useEffect(() => {
    if (!combatResult) return;
    combatActive.current = false;
    if (enemyAITimer.current) clearTimeout(enemyAITimer.current);

    if (combatResult.type === 'win') {
      setEnemyAnimation('defeat');
      setPlayerAnimation('victory');
      setVictoryPose(true);
      const isFlawless = combatState?.playerHealth >= (player?.max_health || 100);
      if (isFlawless) { setPerfectWin(true); setAnnouncement('FLAWLESS'); }
      else setAnnouncement('VICTORY');
      flash('#ffd700', 300);
      shake('heavy');
      setTimeout(() => setShowResultScreen(true), 2500);
    }

    if (combatResult.type === 'fail') {
      setPlayerAnimation('defeat');
      setEnemyAnimation('idle');
      setAnnouncement('DEFEAT');
      flash('#8b0000', 300);
      shake('critical');
      setTimeout(() => setShowResultScreen(true), 2000);
    }
  }, [combatResult, player, flash, shake]);

  // Enemy AI
  const scheduleEnemyAttack = useCallback(() => {
    if (enemyAITimer.current) clearTimeout(enemyAITimer.current);
    if (!combatActive.current) return;

    const delay = ENEMY_ATTACK_INTERVAL_MS + (Math.random() * ENEMY_ATTACK_VARIANCE * 2 - ENEMY_ATTACK_VARIANCE);

    enemyAITimer.current = setTimeout(() => {
      if (!combatActive.current || combatResult) return;

      const cs = combatState;
      if (!cs) { scheduleEnemyAttack(); return; }

      const enemyKey = getEnemyKey(enemy?.name || cs.enemy?.name);
      const rand = Math.random();

      if (distance > 55 && rand < 0.25) {
        setEnemyAnimation('move_forward');
        setEnemyPosition(p => Math.max(p - 12, playerPosition + 10));
        setTimeout(() => setEnemyAnimation('idle'), getAnimDuration(enemyKey, 'move_forward'));
      } else {
        playEnemyAnim('attack', enemyKey);
        const atkDur = getAnimDuration(enemyKey, 'attack');

        setTimeout(() => {
          if (!combatActive.current) return;

          const isCrit = Math.random() > 0.85;
          const baseDmg = enemy?.damage || cs.enemy?.damage || 10;
          const finalDmg = isCrit ? Math.round(baseDmg * 1.8) : baseDmg;

          if (isBlocking) {
            const blocked = Math.round(finalDmg * 0.25);
            addDamageNumber(blocked, 'block', '22%', '32%');
            setAnnouncement('BLOCK');
            shake('normal');
            combatAttack('__enemy_blocked__');
          } else if (isDodging) {
            addDamageNumber(0, 'dodge', '22%', '32%');
            setAnnouncement('DODGE');
          } else {
            addDamageNumber(finalDmg, 'damage', '22%', '32%', isCrit);
            playPlayerAnim('hit');
            if (isCrit) { flash('#ff0000', 250); shake('critical'); setAnnouncement('CRITICAL'); }
            else shake('normal');
            combatAttack('__enemy_attack__');
          }
        }, atkDur * 0.55);
      }

      scheduleEnemyAttack();
    }, delay);
  }, [combatState, combatResult, distance, isBlocking, isDodging, playerPosition, enemy, playEnemyAnim, playPlayerAnim, addDamageNumber, shake, flash, combatAttack]);

  useEffect(() => {
    if (combatActive.current && combatState && !combatResult) {
      scheduleEnemyAttack();
    }
    return () => {
      if (enemyAITimer.current) clearTimeout(enemyAITimer.current);
    };
  }, [combatState, combatResult, scheduleEnemyAttack]);

  // Player Actions
  const handleAttack = useCallback((skillName = 'Basic Attack') => {
    if (!combatState || combatResult || !combatActive.current) return;
    const isSkill = skillName !== 'Basic Attack';
    const cdKey = isSkill ? 'skillAttack' : 'basicAttack';
    if (!isCooledDown(cdKey)) return;

    stamp(cdKey);
    const animKey = isSkill ? 'skill_attack' : 'basic_attack';
    playPlayerAnim(animKey);

    const atkDur = getAnimDuration('kaito', animKey);

    setTimeout(() => {
      if (!combatActive.current) return;

      combatAttack(skillName);

      const distBonus = distance <= 30 ? 1.4 : 1.0;
      const isCrit = Math.random() > (isSkill ? 0.65 : 0.78);
      const baseDmg = isSkill ? 25 : 15;
      const finalDmg = Math.round(baseDmg * distBonus * (isCrit ? 1.9 : 1));

      if (comboResetRef.current) clearTimeout(comboResetRef.current);
      comboCount.current += 1;
      const cc = comboCount.current;
      if (cc >= 2 && cc <= 5) setAnnouncement(`COMBO_${cc}`);
      comboResetRef.current = setTimeout(() => { comboCount.current = 0; }, 3000);

      if (isCrit) { flash('#ffd700', 200); shake('heavy'); setAnnouncement('CRITICAL'); }
      else shake('normal');

      const enemyKey = getEnemyKey(enemy?.name || combatState.enemy?.name);
      playEnemyAnim('hit', enemyKey);
      addDamageNumber(finalDmg, isCrit ? 'crit' : 'damage', `${enemyPosition - 5}%`, '28%', isCrit);

      if (distance <= 30 && cc === 1) setAnnouncement('CLOSE_COMBAT');
    }, atkDur * 0.55);
  }, [combatState, combatResult, distance, isCooledDown, stamp, playPlayerAnim, playEnemyAnim, addDamageNumber, shake, flash, combatAttack, enemy]);

  const handleBlock = useCallback(() => {
    if (!combatState || combatResult || !isCooledDown('block')) return;
    stamp('block');

    setIsBlocking(true);
    playPlayerAnim('block', 'block');
    setPlayerAnimation('block');

    if (blockTimer.current) clearTimeout(blockTimer.current);
    blockTimer.current = setTimeout(() => {
      setIsBlocking(false);
      setPlayerAnimation('idle');
    }, 1200);
  }, [combatState, combatResult, isCooledDown, stamp, playPlayerAnim]);

  const handleDodge = useCallback(() => {
    if (!combatState || combatResult || !isCooledDown('dodge')) return;
    stamp('dodge');

    setIsDodging(true);
    playPlayerAnim('dodge');

    setPlayerPosition(p => Math.max(5, p - 12));

    if (dodgeTimer.current) clearTimeout(dodgeTimer.current);
    dodgeTimer.current = setTimeout(() => {
      setIsDodging(false);
      setPlayerPosition(p => Math.min(p + 12, 45));
    }, COOLDOWNS.dodge);
  }, [combatState, combatResult, isCooledDown, stamp, playPlayerAnim]);

  const handleMoveForward = useCallback(() => {
    if (!combatState || combatResult || !isCooledDown('move')) return;
    stamp('move');

    playPlayerAnim('move_forward');
    setPlayerPosition(p => Math.min(p + 14, enemyPosition - 12));

    setTimeout(() => {
      const newDist = Math.abs(enemyPosition - playerPosition - 14);
      if (newDist <= 30) setAnnouncement('CLOSE_COMBAT');
    }, 600);
  }, [combatState, combatResult, isCooledDown, stamp, playPlayerAnim, enemyPosition, playerPosition]);

  const handleHeal = useCallback((potionName) => {
    if (!combatState || combatResult || !potionName || !isCooledDown('heal')) return;
    stamp('heal');

    playPlayerAnim('healing');
    const healDur = getAnimDuration('kaito', 'healing');

    setTimeout(() => {
      if (!combatActive.current) return;
      craftCombatPotion(potionName);
      addDamageNumber(30, 'heal', '22%', '28%');
    }, healDur * 0.5);
  }, [combatState, combatResult, isCooledDown, stamp, playPlayerAnim, craftCombatPotion, addDamageNumber]);

  // Loading state
  if (!combatState && !combatResult) {
    return (
      <View style={combatModalStyles.combatCard}>
        <View style={combatModalStyles.jpHeader}>
          <Text style={combatModalStyles.jpHeaderKanji}>決闘</Text>
          <Text style={combatModalStyles.jpHeaderSub}>DOJO ARENA</Text>
        </View>
        <View style={combatModalStyles.combatBody}>
          <View style={combatModalStyles.jpLoading}>
            <Text style={combatModalStyles.jpLoadingKanji}>待</Text>
            <Text style={combatModalStyles.jpLoadingText}>Preparing for battle...</Text>
          </View>
        </View>
      </View>
    );
  }

  // Cooldown values for UI
  const _ = tick;
  const cdBasic = getCooldownRemaining('basicAttack');
  const cdSkill = getCooldownRemaining('skillAttack');
  const cdBlock = getCooldownRemaining('block');
  const cdDodge = getCooldownRemaining('dodge');
  const cdHeal = getCooldownRemaining('heal');
  const cdMove = getCooldownRemaining('move');

  const canBasic = isCooledDown('basicAttack') && !combatResult;
  const canSkill = isCooledDown('skillAttack') && !combatResult;
  const canBlock = isCooledDown('block') && !combatResult;
  const canDodge = isCooledDown('dodge') && !combatResult;
  const canHeal = isCooledDown('heal') && !combatResult;
  const canMove = isCooledDown('move') && !combatResult && distance > 20;

  const enemyKey = enemy ? getEnemyKey(enemy.name) : combatState ? getEnemyKey(combatState.enemy?.name) : 'bandit';

  return (
    <Animated.View style={[combatModalStyles.combatCard, { transform: [{ translateX: shakeAnim }] }]}>
      {/* Header */}
      <View style={combatModalStyles.jpHeader}>
        <View style={combatModalStyles.jpHeaderLeft}>
          <Icon name="gavel" size={24} color={KA_COLORS.gold} />
          <View>
            <Text style={combatModalStyles.jpHeaderKanji}>決闘</Text>
            <Text style={combatModalStyles.jpHeaderSub}>KETTO</Text>
          </View>
        </View>

        <View style={combatModalStyles.jpHeaderCenter}>
          <View style={combatModalStyles.realtimeIndicator}>
            <View style={combatModalStyles.realtimeDot} />
            <Text style={combatModalStyles.realtimeText}>REAL-TIME</Text>
          </View>
        </View>

        <TouchableOpacity
          style={combatModalStyles.jpFleeBtn}
          onPress={() => toggleModal('combat')}
          disabled={isBlocking || isDodging}
        >
          <Icon name="running" size={16} color={KA_COLORS.textSecondary} />
          <Text style={combatModalStyles.jpFleeText}>逃</Text>
        </TouchableOpacity>
      </View>

      {/* Combat Body */}
      <View style={combatModalStyles.combatBody}>
        <View style={combatModalStyles.fightingGame}>
          {/* Health Bars */}
          <View style={combatModalStyles.jpHealthBars}>
            <View style={combatModalStyles.jpHealthSide}>
              <View style={combatModalStyles.jpHealthNameRow}>
                <Text style={combatModalStyles.jpNameTag}>KAITO</Text>
                <Text style={combatModalStyles.jpHpText}>
                  {combatState?.playerHealth ?? player.health}
                  <Text style={combatModalStyles.jpHpSep}>/</Text>
                  {player.max_health}
                </Text>
              </View>
              <View style={[combatModalStyles.jpHpTrack, (combatState?.playerHealth ?? player.health) < player.max_health / 3 && combatModalStyles.jpHpDanger]}>
                <View style={[combatModalStyles.jpHpFill, { width: `${Math.max(0, ((combatState?.playerHealth ?? player.health) / player.max_health) * 100)}%` }]} />
                <View style={combatModalStyles.jpHpShine} />
              </View>
              {isBlocking && <Text style={[combatModalStyles.statusBadge, { color: '#4169e1' }]}>🛡 BLOCKING</Text>}
              {isDodging && <Text style={[combatModalStyles.statusBadge, { color: '#32cd32' }]}>💨 EVADING</Text>}
            </View>

            <Text style={combatModalStyles.jpVsDivider}>対</Text>

            <View style={combatModalStyles.jpHealthSide}>
              <View style={combatModalStyles.jpHealthNameRow}>
                <Text style={combatModalStyles.jpNameTag}>{enemy?.name?.toUpperCase() || combatState?.enemy?.name?.toUpperCase() || 'ENEMY'}</Text>
                <Text style={combatModalStyles.jpHpText}>
                  {combatState?.enemyHealth ?? 0}
                  <Text style={combatModalStyles.jpHpSep}>/</Text>
                  {enemy?.max_health ?? combatState?.enemyMaxHealth ?? 0}
                </Text>
              </View>
              <View style={[combatModalStyles.jpHpTrack, (combatState?.enemyHealth ?? 0) < (enemy?.max_health ?? combatState?.enemyMaxHealth ?? 1) / 3 && combatModalStyles.jpHpDanger]}>
                <View style={[combatModalStyles.jpHpFillEnemy, { width: `${Math.max(0, ((combatState?.enemyHealth ?? 0) / (enemy?.max_health ?? combatState?.enemyMaxHealth ?? 1)) * 100)}%` }]} />
                <View style={combatModalStyles.jpHpShine} />
              </View>
              {(combatState?.enemyHealth ?? 0) < (enemy?.max_health ?? combatState?.enemyMaxHealth ?? 1) / 3 && (
                <Text style={[combatModalStyles.statusBadge, { color: '#ff0000' }]}>⚠ FINISH HIM</Text>
              )}
            </View>
          </View>

          {/* Distance */}
          <View style={combatModalStyles.distanceMeterContainer}>
            <DistanceMeter distance={distance} maxDistance={100} />
          </View>

          {/* Announcements / Flash */}
          {announcement && (
            <Announcement type={announcement} onComplete={() => {
              if (!['VICTORY', 'DEFEAT', 'FLAWLESS'].includes(announcement)) setAnnouncement(null);
            }} />
          )}
          {flashColor && <ScreenFlash color={flashColor} duration={250} />}

          {/* Fighting Stage */}
          <View style={[combatModalStyles.fightingStage, combatModalStyles.jpDojoStage]}>
            <View style={combatModalStyles.stageBackground}>
              <View style={combatModalStyles.stageFloor} />
              <View style={combatModalStyles.stageWall} />
            </View>

            <View style={combatModalStyles.jpStageOverlay}>
              <Text style={combatModalStyles.jpBannerLeft}>戦</Text>
              <Text style={combatModalStyles.jpBannerRight}>闘</Text>
              <Text style={combatModalStyles.jpSigil}>道場</Text>
            </View>

            <View style={combatModalStyles.fightersContainer}>
              {/* Player */}
              <Animated.View
                style={[
                  combatModalStyles.fighter,
                  combatModalStyles.playerFighter,
                  victoryPose && combatModalStyles.victoryPose,
                  isBlocking && combatModalStyles.blocking,
                  isDodging && combatModalStyles.dodging,
                  { left: `${playerPosition}%` }
                ]}
              >
                <SpriteAnimator character="kaito" animation={playerAnimation} size={150} />
              </Animated.View>

              {/* Enemy */}
              <View
                style={[
                  combatModalStyles.fighter,
                  combatModalStyles.enemyFighter,
                  { left: `${enemyPosition}%` }
                ]}
              >
                <SpriteAnimator character={combatState?.enemy?.name || 'bandit'} animation={enemyAnimation} size={150} />
              </View>
            </View>

            {/* Damage Numbers */}
            {damageNumbers.map(d => (
              <FloatingDamage key={d.id} damage={d.damage} type={d.type} x={d.x} y={d.y} isCritical={d.isCritical} />
            ))}

            {/* Combat Log */}
            {combatState?.log?.length > 0 && (
              <View style={combatModalStyles.jpLogFloat}>
                <View style={combatModalStyles.jpLogFloatHeader}>
                  <Icon name="magic" size={16} color={KA_COLORS.gold} />
                  <Text style={combatModalStyles.jpLogFloatTitle}>戦記</Text>
                </View>
                <ScrollView style={combatModalStyles.jpLogFloatScroll}>
                  {combatState?.log?.slice(-6).map((entry, idx) => (
                    <Text key={idx} style={combatModalStyles.jpLogFloatEntry}>{entry}</Text>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Equipment Strip */}
          <View style={combatModalStyles.jpEquipStrip}>
            {player.equipment?.weapon && (
              <View style={combatModalStyles.jpEquipSlot}>
                <Icon name="gavel" size={16} color={KA_COLORS.gold} />
                <Text style={combatModalStyles.jpEquipText}>{player.equipment.weapon}</Text>
              </View>
            )}
            {player.equipment?.armor && (
              <View style={combatModalStyles.jpEquipSlot}>
                <Icon name="shield-alt" size={16} color={KA_COLORS.gold} />
                <Text style={combatModalStyles.jpEquipText}>{player.equipment.armor}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Panel */}
        <View style={combatModalStyles.jpActionPanel}>
          <View style={combatModalStyles.jpActionGrid}>
            {/* ATTACK */}
            <TouchableOpacity
              style={[combatModalStyles.jpActionBtn, combatModalStyles.jpAttackBtn, canBasic ? combatModalStyles.actionReady : combatModalStyles.actionCooling]}
              onPress={() => handleAttack('Basic Attack')}
              disabled={!canBasic}
            >
              <View style={combatModalStyles.actionBtnTop}>
                <Icon name="gavel" size={20} color={KA_COLORS.ivory} style={combatModalStyles.jpActionIcon} />
                <CooldownRing cooldownMs={cdBasic} totalMs={COOLDOWNS.basicAttack} ready={canBasic} />
              </View>
              <Text style={combatModalStyles.jpActionLabel}>斬</Text>
              <Text style={combatModalStyles.jpActionSub}>ATTACK</Text>
            </TouchableOpacity>

            {/* MOVE */}
            <TouchableOpacity
              style={[combatModalStyles.jpActionBtn, combatModalStyles.jpMoveBtn, canMove ? combatModalStyles.actionReady : combatModalStyles.actionCooling]}
              onPress={handleMoveForward}
              disabled={!canMove}
            >
              <View style={combatModalStyles.actionBtnTop}>
                <Icon name="arrows-alt-h" size={20} color={KA_COLORS.ivory} style={combatModalStyles.jpActionIcon} />
                <CooldownRing cooldownMs={cdMove} totalMs={COOLDOWNS.move} ready={canMove} />
              </View>
              <Text style={combatModalStyles.jpActionLabel}>進</Text>
              <Text style={combatModalStyles.jpActionSub}>ADVANCE</Text>
            </TouchableOpacity>

            {/* BLOCK */}
            <TouchableOpacity
              style={[combatModalStyles.jpActionBtn, combatModalStyles.jpBlockBtn, canBlock ? combatModalStyles.actionReady : combatModalStyles.actionCooling, isBlocking && combatModalStyles.activeBtn]}
              onPress={handleBlock}
              disabled={!canBlock}
            >
              <View style={combatModalStyles.actionBtnTop}>
                <Icon name="shield-alt" size={20} color={KA_COLORS.ivory} style={combatModalStyles.jpActionIcon} />
                <CooldownRing cooldownMs={cdBlock} totalMs={COOLDOWNS.block} ready={canBlock} />
              </View>
              <Text style={combatModalStyles.jpActionLabel}>守</Text>
              <Text style={combatModalStyles.jpActionSub}>BLOCK</Text>
            </TouchableOpacity>

            {/* DODGE */}
            <TouchableOpacity
              style={[combatModalStyles.jpActionBtn, combatModalStyles.jpDodgeBtn, canDodge ? combatModalStyles.actionReady : combatModalStyles.actionCooling, isDodging && combatModalStyles.activeBtn]}
              onPress={handleDodge}
              disabled={!canDodge}
            >
              <View style={combatModalStyles.actionBtnTop}>
                <Icon name="shoe-prints" size={20} color={KA_COLORS.ivory} style={combatModalStyles.jpActionIcon} />
                <CooldownRing cooldownMs={cdDodge} totalMs={COOLDOWNS.dodge} ready={canDodge} />
              </View>
              <Text style={combatModalStyles.jpActionLabel}>避</Text>
              <Text style={combatModalStyles.jpActionSub}>DODGE</Text>
            </TouchableOpacity>

            {/* SKILLS - Simplified for mobile */}
            <TouchableOpacity
              style={[combatModalStyles.jpActionBtn, combatModalStyles.jpSkillBtn, canSkill ? combatModalStyles.actionReady : combatModalStyles.actionCooling]}
              onPress={() => handleAttack('Power Strike')}
              disabled={!canSkill}
            >
              <View style={combatModalStyles.actionBtnTop}>
                <Icon name="bolt" size={20} color={KA_COLORS.ivory} style={combatModalStyles.jpActionIcon} />
                <CooldownRing cooldownMs={cdSkill} totalMs={COOLDOWNS.skillAttack} ready={canSkill} />
              </View>
              <Text style={combatModalStyles.jpActionLabel}>技</Text>
              <Text style={combatModalStyles.jpActionSub}>SKILL</Text>
            </TouchableOpacity>

            {/* POTIONS - Simplified for mobile */}
            <TouchableOpacity
              style={[combatModalStyles.jpActionBtn, combatModalStyles.jpPotionBtn, canHeal ? combatModalStyles.actionReady : combatModalStyles.actionCooling]}
              onPress={() => handleHeal('Weak Healing Potion')}
              disabled={!canHeal}
            >
              <View style={combatModalStyles.actionBtnTop}>
                <Icon name="flask" size={20} color={KA_COLORS.ivory} style={combatModalStyles.jpActionIcon} />
                <CooldownRing cooldownMs={cdHeal} totalMs={COOLDOWNS.heal} ready={canHeal} />
              </View>
              <Text style={combatModalStyles.jpActionLabel}>薬</Text>
              <Text style={combatModalStyles.jpActionSub}>HEAL</Text>
            </TouchableOpacity>
          </View>

          {/* Hint bar */}
          <View style={combatModalStyles.hintBar}>
            <Text style={combatModalStyles.hintText}>Attack freely — enemy acts on its own timer.</Text>
            <Text style={combatModalStyles.hintText}>Block = 75% damage reduction · Dodge = full evade</Text>
          </View>
        </View>

        {/* Result Screen */}
        {showResultScreen && combatResult && (
          <Modal visible={showResultScreen} transparent animationType="fade">
            <View style={[combatModalStyles.jpResultScreen, combatResult.type === 'win' ? combatModalStyles.jpResultWin : combatModalStyles.jpResultLose]}>
              <View style={combatModalStyles.jpResultCard}>
                <Text style={combatModalStyles.jpResultKanji}>
                  {combatResult.type === 'win' ? '勝' : '敗'}
                </Text>
                <Text style={combatModalStyles.jpResultTitle}>
                  {combatResult.type === 'win' ? 'VICTORY' : 'DEFEAT'}
                </Text>
                <Text style={combatModalStyles.jpResultMsg}>{combatResult.message}</Text>

                {combatResult.type === 'win' && combatState?.enemy && (
                  <View style={combatModalStyles.jpRewards}>
                    <View style={combatModalStyles.jpRewardItem}>
                      <Icon name="coins" size={18} color={KA_COLORS.gold} />
                      <Text style={combatModalStyles.jpRewardText}>+{combatState?.enemy?.gold ?? 0} Gold</Text>
                    </View>
                    <View style={combatModalStyles.jpRewardItem}>
                      <Icon name="star" size={18} color={KA_COLORS.gold} />
                      <Text style={combatModalStyles.jpRewardText}>+{combatState?.enemy?.name === 'Bandit' ? 20 : 25} XP</Text>
                    </View>
                    {perfectWin && (
                      <View style={combatModalStyles.jpRewardItem}>
                        <Icon name="star" size={18} color={KA_COLORS.gold} />
                        <Text style={combatModalStyles.jpRewardText}>PERFECT BONUS</Text>
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[combatModalStyles.jpResultBtn, combatResult.type === 'win' ? combatModalStyles.jpResultBtnWin : combatModalStyles.jpResultBtnLose]}
                  onPress={() => toggleModal('combat')}
                >
                  <Text style={combatModalStyles.jpResultBtnText}>
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
const combatModalStyles = StyleSheet.create({
  combatCard: {
    backgroundColor: KA_COLORS.bgCard,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: KA_COLORS.border,
    overflow: 'hidden',
  },
  jpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: KA_COLORS.bgElevated,
    borderBottomWidth: 2,
    borderBottomColor: KA_COLORS.border,
  },
  jpHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  jpHeaderKanji: {
    fontSize: 24,
    fontWeight: '700',
    color: KA_COLORS.gold,
    letterSpacing: 4,
  },
  jpHeaderSub: {
    fontSize: 10,
    color: KA_COLORS.textSecondary,
    letterSpacing: 2,
  },
  jpHeaderCenter: {
    flex: 1,
    alignItems: 'center',
  },
  realtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  realtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  realtimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },
  jpFleeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
  },
  jpFleeText: {
    fontSize: 16,
    color: KA_COLORS.textSecondary,
  },
  combatBody: {
    padding: 16,
  },
  fightingGame: {
    gap: 16,
  },
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
    marginBottom: 6,
  },
  jpNameTag: {
    fontSize: 12,
    fontWeight: '700',
    color: KA_COLORS.ivory,
    letterSpacing: 2,
  },
  jpHpText: {
    fontSize: 12,
    color: KA_COLORS.textSecondary,
  },
  jpHpSep: {
    marginHorizontal: 4,
  },
  jpHpTrack: {
    height: 12,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 6,
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
    backgroundColor: KA_COLORS.redAccent,
  },
  jpHpShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 1,
  },
  jpVsDivider: {
    fontSize: 24,
    fontWeight: '700',
    color: KA_COLORS.gold,
    marginHorizontal: 16,
  },
  distanceMeterContainer: {
    marginBottom: 16,
  },
  distanceMeter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distanceLabel: {
    fontSize: 10,
    color: KA_COLORS.textSecondary,
    letterSpacing: 2,
  },
  distanceBar: {
    flex: 1,
    height: 6,
    backgroundColor: KA_COLORS.ink,
    borderRadius: 3,
    overflow: 'hidden',
  },
  distanceFill: {
    height: '100%',
  },
  distanceText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'right',
  },
  announcementOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    zIndex: 10,
  },
  announcementText: {
    fontSize: 32,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  screenFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
  },
  fightingStage: {
    height: 200,
    backgroundColor: KA_COLORS.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  jpDojoStage: {
    backgroundColor: 'rgba(47, 79, 79, 0.1)',
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
    backgroundColor: 'rgba(139, 69, 19, 0.3)',
  },
  stageWall: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '70%',
    backgroundColor: 'rgba(47, 79, 79, 0.2)',
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
    left: 10,
    top: 10,
    fontSize: 48,
    fontWeight: '700',
    color: 'rgba(218, 165, 32, 0.2)',
  },
  jpBannerRight: {
    position: 'absolute',
    right: 10,
    top: 10,
    fontSize: 48,
    fontWeight: '700',
    color: 'rgba(218, 165, 32, 0.2)',
  },
  jpSigil: {
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(218, 165, 32, 0.15)',
    letterSpacing: 8,
  },
  fightersContainer: {
    position: 'relative',
    height: '100%',
  },
  fighter: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerFighter: {
    top: '30%',
  },
  enemyFighter: {
    top: '30%',
    transform: [{ scaleX: -1 }],
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
  floatingNumber: {
    position: 'absolute',
    zIndex: 5,
  },
  damageNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: KA_COLORS.redAccent,
  },
  critNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f43f5e',
  },
  healNumber: {
    color: KA_COLORS.success,
  },
  blockNumber: {
    color: '#4169e1',
  },
  dodgeNumber: {
    color: '#32cd32',
  },
  jpLogFloat: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 150,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: KA_COLORS.gold,
    zIndex: 10,
  },
  jpLogFloatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: KA_COLORS.border,
  },
  jpLogFloatTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: KA_COLORS.gold,
    letterSpacing: 2,
  },
  jpLogFloatScroll: {
    maxHeight: 80,
    padding: 8,
  },
  jpLogFloatEntry: {
    fontSize: 10,
    color: KA_COLORS.ivory,
    marginBottom: 4,
  },
  jpEquipStrip: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  jpEquipSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
  },
  jpEquipText: {
    fontSize: 11,
    color: KA_COLORS.ivory,
  },
  jpActionPanel: {
    backgroundColor: KA_COLORS.bgElevated,
    borderTopWidth: 2,
    borderTopColor: KA_COLORS.border,
    padding: 16,
  },
  jpActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  jpActionBtn: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    backgroundColor: KA_COLORS.bgInput,
    borderWidth: 2,
    borderColor: KA_COLORS.border,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  jpAttackBtn: {
    borderColor: KA_COLORS.redAccent,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  jpMoveBtn: {
    borderColor: KA_COLORS.success,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  jpBlockBtn: {
    borderColor: KA_COLORS.gold,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  jpDodgeBtn: {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
  },
  jpSkillBtn: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  jpPotionBtn: {
    borderColor: '#a78bfa',
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
  },
  actionBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  jpActionIcon: {
    marginRight: 4,
  },
  jpActionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: KA_COLORS.ivory,
  },
  jpActionSub: {
    fontSize: 10,
    color: KA_COLORS.textSecondary,
    letterSpacing: 1,
  },
  actionReady: {
    opacity: 1,
  },
  actionCooling: {
    opacity: 0.5,
  },
  activeBtn: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
  },
  hintBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  hintText: {
    fontSize: 10,
    color: KA_COLORS.textSecondary,
    flex: 1,
  },
  jpResultScreen: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jpResultWin: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
  },
  jpResultLose: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },
  jpResultCard: {
    backgroundColor: KA_COLORS.bgCard,
    padding: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: KA_COLORS.border,
    alignItems: 'center',
  },
  jpResultKanji: {
    fontSize: 64,
    fontWeight: '700',
    color: KA_COLORS.gold,
    marginBottom: 16,
  },
  jpResultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: KA_COLORS.ivory,
    marginBottom: 8,
  },
  jpResultMsg: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
    marginBottom: 24,
  },
  jpRewards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  jpRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jpRewardText: {
    fontSize: 14,
    color: KA_COLORS.gold,
  },
  jpResultBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  jpResultBtnWin: {
    backgroundColor: KA_COLORS.success,
  },
  jpResultBtnLose: {
    backgroundColor: KA_COLORS.redAccent,
  },
  jpResultBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: KA_COLORS.ivory,
  },
  jpLoading: {
    alignItems: 'center',
    padding: 32,
  },
  jpLoadingKanji: {
    fontSize: 48,
    fontWeight: '700',
    color: KA_COLORS.gold,
    marginBottom: 16,
  },
  jpLoadingText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
  },
});

export default CombatModal;
