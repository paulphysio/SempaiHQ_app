import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Palette — lifted directly from ProfileScreen's KA_COLORS so Swap, Profile,
// and anything built after this all match. Danger/success are new additions
// (Swap needs error/success banners; Profile didn't) chosen to stay inside
// the warm, low-saturation family instead of introducing stock red/green.
// ---------------------------------------------------------------------------
export const KA_COLORS = {
  bgPrimary: '#0c0c0c',
  bgCard: '#141210',
  bgElevated: '#1a1714',
  orangePrimary: '#cc5500',
  orangeBright: '#ff6b35',
  orangeSoft: '#e67e22',
  orangeDim: '#8b4513',
  gold: '#c9a84c',
  goldBright: '#ffd700',
  ivory: '#f5e6d3',
  ivoryDim: '#c4b5a0',
  border: '#2d2418',
  textPrimary: '#f5e6d3',
  textSecondary: '#a09080',
  textMuted: '#6b5d4f',
  danger: '#e2543d',
  dangerBg: 'rgba(226, 84, 61, 0.12)',
  successBg: 'rgba(201, 168, 76, 0.12)',
  warnBg: 'rgba(230, 126, 34, 0.10)',
};

export const KA_DIMENSIONS = { width, height };

// ---------------------------------------------------------------------------
// Base fragments shared by every card/button/pill across the app.
// ---------------------------------------------------------------------------
export const kaitoBase = StyleSheet.create({
  card: {
    backgroundColor: KA_COLORS.bgCard,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: KA_COLORS.orangePrimary,
  },
  cardCorner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: KA_COLORS.orangeDim,
    borderStyle: 'solid',
    opacity: 0.5,
  },
  cardCornerTL: { top: 8, left: 8, borderWidth: 2, borderBottomWidth: 0, borderRightWidth: 0 },
  cardCornerTR: { top: 8, right: 8, borderWidth: 2, borderBottomWidth: 0, borderLeftWidth: 0 },
  cardCornerBL: { bottom: 8, left: 8, borderWidth: 2, borderTopWidth: 0, borderRightWidth: 0 },
  cardCornerBR: { bottom: 8, right: 8, borderWidth: 2, borderTopWidth: 0, borderLeftWidth: 0 },

  screenTitle: {
    color: KA_COLORS.ivory,
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 3,
    textShadowColor: KA_COLORS.orangePrimary,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  screenSubtitle: {
    color: KA_COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  sectionTitle: {
    color: KA_COLORS.ivory,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 14,
    textShadowColor: KA_COLORS.orangePrimary,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: KA_COLORS.border,
  },
  dividerText: {
    color: KA_COLORS.textMuted,
    fontSize: 11,
    marginHorizontal: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  primaryButton: {
    backgroundColor: KA_COLORS.orangePrimary,
    borderWidth: 1,
    borderColor: KA_COLORS.orangeBright,
    borderRadius: 4,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: KA_COLORS.orangePrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonDisabled: {
    backgroundColor: KA_COLORS.bgElevated,
    borderColor: KA_COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: KA_COLORS.ivory,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: KA_COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KA_COLORS.bgElevated,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
  },
  input: {
    backgroundColor: KA_COLORS.bgElevated,
    color: KA_COLORS.ivory,
    borderWidth: 1,
    borderColor: KA_COLORS.border,
    borderRadius: 4,
    padding: 14,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  label: {
    color: KA_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

// Corner-bracket + top-border decoration. Drop inside any View with
// kaitoBase.card — matches the treatment ProfileScreen uses on every card.
export const CardCorners = () => (
  <>
    <View style={kaitoBase.cardTopBorder} />
    <View style={[kaitoBase.cardCorner, kaitoBase.cardCornerTL]} />
    <View style={[kaitoBase.cardCorner, kaitoBase.cardCornerTR]} />
    <View style={[kaitoBase.cardCorner, kaitoBase.cardCornerBL]} />
    <View style={[kaitoBase.cardCorner, kaitoBase.cardCornerBR]} />
  </>
);

// Drifting ember particles — identical timing/count to ProfileScreen (12
// embers, randomized delay/duration) so the ambience matches screen to screen.
export const EmberField = ({ count = 12 }) => {
  const meta = useRef(
    Array.from({ length: count }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 6 + Math.random() * 4,
    }))
  ).current;
  const anims = useRef(meta.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(meta[index].delay * 1000),
          Animated.timing(anim, {
            toValue: 1,
            duration: meta[index].duration * 1000,
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={emberStyles.container} pointerEvents="none">
      {anims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            emberStyles.ember,
            {
              left: `${meta[index].left}%`,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [KA_DIMENSIONS.height, -50],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const emberStyles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ember: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: KA_COLORS.orangePrimary,
    shadowColor: KA_COLORS.orangeBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});

// Fade + slide-up + spring-scale entrance, matching ProfileScreen's timings
// exactly (800ms fade/slide, spring friction 8 / tension 40).
export const useEntranceAnimation = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] };
};