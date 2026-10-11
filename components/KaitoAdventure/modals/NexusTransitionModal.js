import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  Image,
} from 'react-native';

/* ══════════════════════════════════════════════════════════
   COLORS (same as CombatModal)
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
   KAITO COMBAT SPRITE ASSETS
══════════════════════════════════════════════════════════ */
const KAITO_SPRITES = {
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
  victory: [
    require('../../../assets/sprites/kaito/victory/victory_001.png'),
    require('../../../assets/sprites/kaito/victory/victory_002.png'),
    require('../../../assets/sprites/kaito/victory/victory_003.png'),
    require('../../../assets/sprites/kaito/victory/victory_004.png'),
    require('../../../assets/sprites/kaito/victory/victory_005.png'),
  ],
};

/* ══════════════════════════════════════════════════════════
   SPRITE ANIMATOR
══════════════════════════════════════════════════════════ */
const SpriteAnimator = memo(({ animation = 'idle', size = 200, freeze = false, onAnimationComplete }) => {
  const spriteArray = KAITO_SPRITES[animation] || KAITO_SPRITES.idle;
  const [frame, setFrame] = useState(0);
  const rafRef = useRef(null);
  const lastTs = useRef(0);
  const frameRef = useRef(0);
  const speed = animation === 'idle' ? 180 : animation === 'basic_attack' ? 80 : 150;
  const loop = animation === 'idle' || animation === 'victory';

  useEffect(() => {
    if (freeze) return;
    frameRef.current = 0;
    lastTs.current = 0;
    setFrame(0);

    const tick = (ts) => {
      if (!lastTs.current) lastTs.current = ts;
      if (ts - lastTs.current >= speed) {
        lastTs.current = ts;
        frameRef.current += 1;
        
        if (loop) {
          frameRef.current = frameRef.current % spriteArray.length;
        } else if (frameRef.current >= spriteArray.length) {
          cancelAnimationFrame(rafRef.current);
          onAnimationComplete?.();
          return;
        }
        
        setFrame(frameRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animation, freeze, speed, spriteArray.length, loop, onAnimationComplete]);

  const source = spriteArray[frame] || spriteArray[0];

  return (
    <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
  );
});

/* ══════════════════════════════════════════════════════════
   NEXUS TRANSITION MODAL
══════════════════════════════════════════════════════════ */
const NexusTransitionModal = ({ visible, mode, onComplete }) => {
  const [phase, setPhase] = useState('enter');
  const [animation, setAnimation] = useState('idle');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      resetAnimations();
      return;
    }

    // Phase 1: Fade in with scale
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
    ]).start(() => {
      setPhase('animate');
      setAnimation('basic_attack');
    });
  }, [visible]);

  useEffect(() => {
    if (phase === 'animate') {
      // Rotate and glow effect
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();

      // Fade in text
      Animated.timing(textAnim, { toValue: 1, duration: 800, useNativeDriver: true, delay: 400 }).start();
    }
  }, [phase]);

  const resetAnimations = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    rotateAnim.setValue(0);
    glowAnim.setValue(0);
    textAnim.setValue(0);
    setPhase('enter');
    setAnimation('idle');
  };

  const handleAnimationComplete = () => {
    if (phase === 'animate') {
      setAnimation('victory');
      setPhase('exit');
      
      // Exit animation
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        ]).start(() => {
          onComplete?.();
        });
      }, 1500);
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowInterpolate = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const modeText = mode === 'wave' ? 'WAVE MODE' : 'COMBAT MODE';
  const modeKanji = mode === 'wave' ? '波' : '闘';

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={S.overlay}>
        <Animated.View style={[S.container, { opacity: fadeAnim }]}>
          {/* Background effects */}
          <Animated.View
            style={[
              S.bgGlow,
              {
                opacity: Animated.multiply(fadeAnim, glowInterpolate),
                transform: [{ scale: Animated.multiply(scaleAnim, 1.5) }],
              },
            ]}
          />
          
          <Animated.View
            style={[
             S.bgRing,
              {
                opacity: Animated.multiply(fadeAnim, glowInterpolate),
                transform: [{ rotate: rotateInterpolate }],
              },
            ]}
          />

          {/* Kaito sprite */}
          <Animated.View style={[S.spriteContainer, { transform: [{ scale: scaleAnim }] }]}>
            <SpriteAnimator
              animation={animation}
              size={200}
              freeze={false}
              onAnimationComplete={handleAnimationComplete}
            />
          </Animated.View>

          {/* Mode text */}
          <Animated.View style={[S.textContainer, { opacity: textAnim }]}>
            <Text style={S.modeKanji}>{modeKanji}</Text>
            <Text style={S.modeText}>{modeText}</Text>
            <Text style={S.subText}>INITIALIZING...</Text>
          </Animated.View>

          {/* Decorative elements */}
          <View style={S.decorativeLineTop} />
          <View style={S.decorativeLineBottom} />
          <View style={S.cornerTL} />
          <View style={S.cornerTR} />
          <View style={S.cornerBL} />
          <View style={S.cornerBR} />
        </Animated.View>
      </View>
    </Modal>
  );
};

/* ══════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════ */
const S = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bgGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: KA_COLORS.orangePrimary,
    filter: 'blur(60px)',
  },
  bgRing: {
    position: 'absolute',
    width: 350,
    height: 350,
    borderRadius: 175,
    borderWidth: 3,
    borderColor: KA_COLORS.goldBright,
    borderStyle: 'dashed',
  },
  spriteContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  textContainer: {
    marginTop: 40,
    alignItems: 'center',
    zIndex: 10,
  },
  modeKanji: {
    fontSize: 64,
    color: KA_COLORS.goldBright,
    letterSpacing: 8,
    textShadowColor: KA_COLORS.orangePrimary,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
    marginBottom: 8,
  },
  modeText: {
    fontSize: 24,
    color: KA_COLORS.ivory,
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 12,
  },
  subText: {
    fontSize: 14,
    color: KA_COLORS.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  decorativeLineTop: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(201, 168, 76, 0.3)',
  },
  decorativeLineBottom: {
    position: 'absolute',
    bottom: '25%',
    left: '10%',
    right: '10%',
    height: 1,
    backgroundColor: 'rgba(201, 168, 76, 0.3)',
  },
  cornerTL: {
    position: 'absolute',
    top: 40,
    left: 40,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: KA_COLORS.orangePrimary,
  },
  cornerTR: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 30,
    height: 30,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: KA_COLORS.orangePrimary,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: KA_COLORS.orangePrimary,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 40,
    right: 40,
    width: 30,
    height: 30,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: KA_COLORS.orangePrimary,
  },
});

export default NexusTransitionModal;
