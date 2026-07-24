import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, StyleSheet, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '../context/NavigationContext';

const { width, height } = Dimensions.get('window');
const CENTER = { x: width / 2, y: height / 2 };

// Brand accent — matches the orange used across ConnectButton/SwapScreen so
// the splash doesn't feel like a different app from the one it opens into.
const ORANGE = '#ff6200';
const ORANGE_BRIGHT = '#ff8a3d';
const NAVY_DEEP = '#070d16';
const NAVY_MID = '#0d1b2a';

// ---------------------------------------------------------------------------
// Timeline (ms) — everything below is keyed off these constants so the
// choreography stays readable instead of a wall of magic numbers.
// ---------------------------------------------------------------------------
const T_BG_IN = 500;
const T_RINGS_IN = 650;
const T_LOGO_IN = 250; // delay before logo starts its spring-in
const T_WORDMARK_IN = 550;
const T_TITLE_IN = 1150;
const T_SUBTITLE_IN = 1500;
const T_HOLD_UNTIL = 2900;
const T_EXIT = 420;
const TOTAL_DURATION = T_HOLD_UNTIL + T_EXIT + 100;

const STAR_COUNT = 46;
const PARTICLE_COUNT = 24;

const WelcomeScreen = () => {
  const { handleWelcomeComplete } = useNavigation();

  // Entrance / exit choreography
  const bgFade = useRef(new Animated.Value(0)).current;
  const wordmarkAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const exitScale = useRef(new Animated.Value(1)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  // Continuous ambient loops
  const breathe = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0.5)).current;
  const outerSpin = useRef(new Animated.Value(0)).current;
  const innerSpin = useRef(new Animated.Value(0)).current;
  const shockwaves = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0))
  ).current;

  const stars = useRef(
    Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2,
      anim: new Animated.Value(Math.random()),
      duration: 1200 + Math.random() * 1800,
    }))
  ).current;

  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      return {
        angle,
        radius: 70 + Math.random() * 55,
        translate: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.4),
      };
    })
  ).current;

  const [dots, setDots] = useState('.');

  useEffect(() => {
    let isMounted = true;

    // ---- Ambient loops (start immediately, run until exit stops them) ----
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1.08, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.5, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const outerSpinLoop = Animated.loop(
      Animated.timing(outerSpin, { toValue: 1, duration: 22000, easing: Easing.linear, useNativeDriver: true })
    );
    const innerSpinLoop = Animated.loop(
      Animated.timing(innerSpin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true })
    );
    const shockwaveLoops = shockwaves.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 900),
          Animated.timing(anim, { toValue: 1, duration: 2700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(1800 - index * 300),
        ])
      )
    );
    const starLoops = stars.map((star) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(star.anim, { toValue: 1, duration: star.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(star.anim, { toValue: 0.15, duration: star.duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
    const particleOrbitLoops = particles.map((p) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(p.translate, { toValue: 1, duration: 3000 + Math.random() * 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(p.translate, { toValue: 0.7, duration: 3000 + Math.random() * 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );

    breatheLoop.start();
    glowLoop.start();
    outerSpinLoop.start();
    innerSpinLoop.start();
    shockwaveLoops.forEach((l) => l.start());
    starLoops.forEach((l) => l.start());

    // ---- Entrance choreography ----
    Animated.timing(bgFade, { toValue: 1, duration: T_BG_IN, useNativeDriver: true }).start();

    Animated.timing(wordmarkAnim, {
      toValue: 1,
      duration: 500,
      delay: T_WORDMARK_IN,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.delay(T_LOGO_IN),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 45, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Particle burst fires once the logo has materialized.
      particles.forEach((p, i) => {
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 450, delay: i * 12, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 1, duration: 450, delay: i * 12, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        ]).start(() => {
          if (isMounted) particleOrbitLoops[i].start();
        });
      });
    });

    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 550,
      delay: T_TITLE_IN,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(subtitleAnim, {
      toValue: 1,
      duration: 550,
      delay: T_SUBTITLE_IN,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Progress bar fill spans the full hold duration — width can't use the
    // native driver, so it's isolated to this one animation.
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: T_HOLD_UNTIL,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Cycling loading dots
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
    }, 400);

    // ---- Exit choreography ----
    const exitTimer = setTimeout(() => {
      breatheLoop.stop();
      glowLoop.stop();
      outerSpinLoop.stop();
      innerSpinLoop.stop();
      shockwaveLoops.forEach((l) => l.stop());
      starLoops.forEach((l) => l.stop());
      particleOrbitLoops.forEach((l) => l.stop());
      clearInterval(dotsInterval);

      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.55, duration: 120, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(flashOpacity, { toValue: 0, duration: T_EXIT - 120, useNativeDriver: true }),
          Animated.timing(exitScale, { toValue: 1.12, duration: T_EXIT, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(exitOpacity, { toValue: 0, duration: T_EXIT, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
      ]).start(async () => {
        try {
          await AsyncStorage.setItem('hasSeenWelcome', 'true');
          handleWelcomeComplete();
        } catch (error) {
          console.error('Error saving welcome state:', error);
          handleWelcomeComplete();
        }
      });
    }, T_HOLD_UNTIL);

    return () => {
      isMounted = false;
      clearTimeout(exitTimer);
      clearInterval(dotsInterval);
      breatheLoop.stop();
      glowLoop.stop();
      outerSpinLoop.stop();
      innerSpinLoop.stop();
      shockwaveLoops.forEach((l) => l.stop());
      starLoops.forEach((l) => l.stop());
      particleOrbitLoops.forEach((l) => l.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outerSpinDeg = outerSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const innerSpinDeg = innerSpin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.root}>
      <LinearGradient colors={[NAVY_DEEP, NAVY_MID, NAVY_DEEP]} style={StyleSheet.absoluteFill} />

      {/* Flash pulse for the exit transition */}
      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]} />

      <Animated.View style={[styles.scene, { opacity: exitOpacity, transform: [{ scale: exitScale }] }]}>
        {/* Starfield */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgFade }]} pointerEvents="none">
          {stars.map((star, i) => (
            <Animated.View
              key={i}
              style={[
                styles.star,
                {
                  left: star.x,
                  top: star.y,
                  width: star.size,
                  height: star.size,
                  borderRadius: star.size,
                  opacity: star.anim,
                },
              ]}
            />
          ))}
        </Animated.View>

        <View style={styles.content}>
          {/* Wordmark */}
          <Animated.Text
            style={[
              styles.wordmark,
              {
                opacity: wordmarkAnim,
                transform: [{ translateY: wordmarkAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
          >
            SEMPAI
          </Animated.Text>

          {/* Energy field: counter-rotating dashed rings + expanding shockwave pulses */}
          <View style={styles.energyField} pointerEvents="none">
            <Animated.View style={[styles.ringLayer, { transform: [{ rotate: outerSpinDeg }] }]}>
              <View style={styles.ring1} />
            </Animated.View>
            <Animated.View style={[styles.ringLayer, { transform: [{ rotate: innerSpinDeg }] }]}>
              <View style={styles.ring2} />
            </Animated.View>
            <View style={styles.ring3} />

            {shockwaves.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.shockwave,
                  {
                    opacity: anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.5, 0] }),
                    transform: [
                      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] }) },
                    ],
                  },
                ]}
              />
            ))}

            {/* Particle burst / orbit */}
            {particles.map((p, i) => {
              const tx = p.translate.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.radius] });
              const ty = p.translate.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.radius] });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.particle,
                    {
                      opacity: p.opacity,
                      transform: [{ translateX: tx }, { translateY: ty }, { scale: p.scale }],
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Logo with breathing glow */}
          <Animated.View
            style={[
              styles.logoWrapper,
              { opacity: logoOpacity, transform: [{ scale: Animated.multiply(logoScale, breathe) }] },
            ]}
          >
            <Animated.View style={[styles.logoGlow, { opacity: glowPulse }]} />
            <Image
              source={{ uri: 'https://xqeimsncmnqsiowftdmz.supabase.co/storage/v1/object/public/covers/logo.png' }}
              style={styles.logo}
              defaultSource={{ uri: 'https://via.placeholder.com/100' }}
            />
            <View style={styles.logoRing} />
          </Animated.View>

          {/* Title + subtitle */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            Welcome to the Adventure
          </Animated.Text>

          <Animated.View
            style={{
              opacity: subtitleAnim,
              transform: [{ translateY: subtitleAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.subtitle}>Initializing Nexus{dots}</Text>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY_DEEP },
  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: ORANGE_BRIGHT,
    zIndex: 10,
  },
  scene: { flex: 1 },
  star: { position: 'absolute', backgroundColor: '#ffffff' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    position: 'absolute',
    top: height * 0.16,
    color: ORANGE_BRIGHT,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 8,
  },
  energyField: {
    position: 'absolute',
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringLayer: {
    position: 'absolute',
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring1: {
    width: 290,
    height: 290,
    borderRadius: 145,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 138, 61, 0.28)',
    borderStyle: 'dashed',
  },
  ring2: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 98, 0, 0.4)',
    borderStyle: 'dashed',
  },
  ring3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(230, 126, 34, 0.35)',
  },
  shockwave: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    borderColor: ORANGE_BRIGHT,
  },
  particle: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ORANGE_BRIGHT,
    shadowColor: ORANGE_BRIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 98, 0, 0.35)',
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  logoRing: {
    position: 'absolute',
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    color: '#f5efe8',
    letterSpacing: 0.5,
    marginBottom: 14,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: ORANGE,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  progressTrack: {
    width: 140,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
});

export default WelcomeScreen;