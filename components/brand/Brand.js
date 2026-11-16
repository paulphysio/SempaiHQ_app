import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { LOGO } from '../../theme/tokens';

const { width: W, height: H } = Dimensions.get('window');

/**
 * Full-screen brand backdrop: ink base, ember glow from the top, gold glow
 * from the bottom, two faint seal rings. Static — no per-frame work.
 */
export const BrandBackdrop = ({ children, style }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.bg }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={[`rgba(${colors.accentRgb},${isDark ? 0.30 : 0.16})`, 'rgba(0,0,0,0)']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.6, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', `rgba(${colors.goldRgb},${isDark ? 0.10 : 0.08})`]}
        start={{ x: 0.5, y: 0.6 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.ring, styles.ringA, { borderColor: `rgba(${colors.accentRgb},0.12)` }]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringB, { borderColor: `rgba(${colors.goldRgb},0.10)` }]} />
      {children}
    </View>
  );
};

/**
 * Logo in the glowing gradient ring + wordmark + tagline (the same mark as
 * the header and the menu, scaled up). `breathe` adds a slow halo pulse.
 */
export const BrandMark = ({ size = 120, breathe = true, showTagline = true, style }) => {
  const { colors, isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!breathe) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, pulse]);

  const halo = size * 1.7;
  return (
    <View style={[styles.markWrap, style]}>
      <View style={{ width: halo, height: halo, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: halo,
            height: halo,
            borderRadius: halo / 2,
            backgroundColor: colors.accent,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.22] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.04] }) }],
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size * 1.32,
            height: size * 1.32,
            borderRadius: size,
            borderWidth: 1,
            borderColor: `rgba(${colors.goldRgb},0.35)`,
          }}
        />
        <LinearGradient
          colors={[colors.accentHi, colors.gold, colors.accentDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            padding: size * 0.045,
            shadowColor: colors.accent,
            shadowOpacity: 0.9,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
            elevation: 14,
          }}
        >
          <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden', borderWidth: 3, borderColor: colors.bg, backgroundColor: colors.bgCard }}>
            <Image source={LOGO} style={{ width: '100%', height: '100%' }} />
          </View>
        </LinearGradient>
      </View>
      <Text
        style={[
          styles.wordmark,
          {
            color: colors.textPrimary,
            fontSize: Math.round(size * 0.34),
            textShadowColor: isDark ? `rgba(${colors.accentRgb},0.6)` : 'transparent',
          },
        ]}
      >
        Sempai HQ
      </Text>
      {showTagline ? <Text style={[styles.tagline, { color: colors.accent }]}>READ · EARN · OWN</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  ring: { position: 'absolute', borderWidth: 1.5 },
  ringA: { width: W * 1.3, height: W * 1.3, borderRadius: W * 0.65, top: -W * 0.55, right: -W * 0.45 },
  ringB: { width: W * 1.1, height: W * 1.1, borderRadius: W * 0.55, bottom: -W * 0.5, left: -W * 0.5 },
  markWrap: { alignItems: 'center' },
  wordmark: { fontFamily: 'Yoruka', letterSpacing: 1, marginTop: -6, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } },
  tagline: { fontSize: 11, fontWeight: '800', letterSpacing: 3.2, marginTop: 4 },
});

export { W as SCREEN_W, H as SCREEN_H };
