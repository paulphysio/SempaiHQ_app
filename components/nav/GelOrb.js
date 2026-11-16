import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { haptics } from '../../utils/haptics';

/**
 * The SempaiHQ "gel orb": the signature button of the global chrome
 * (bottom bar, header, menu). Layers, back to front:
 *
 *   halo        soft accent glow, breathes while the orb is lit
 *   body        3-stop gradient — lit: hi → accent → deep; idle: tinted glass
 *   shade       inner bottom darkening for volume (lit only)
 *   gloss       specular highlight across the top half — the "wet" look
 *   catchlight  tiny bright ellipse, upper-left
 *   rim         1px glass edge
 *
 * Press = squish (wider + shorter) and spring back, on the native thread.
 */
const GelOrb = ({
  icon,
  size = 48,
  lit = false,
  onPress,
  label,
  hint,
  badge = 0,
  loading = false,
  disabled = false,
  iconSize,
  solid = true,
  tone, // optional override colour for the lit body (e.g. success)
  breathe = true,
  hitSlop = 6,
  style,
  children,
}) => {
  const { isDark, colors } = useTheme();
  const press = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(lit ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(badge > 0 ? 1 : 0)).current;

  // Light up / dim smoothly.
  useEffect(() => {
    Animated.timing(glow, {
      toValue: lit ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [lit, glow]);

  // Slow breathing halo, only while lit (one loop per lit orb).
  useEffect(() => {
    if (!lit || !breathe) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [lit, breathe, pulse]);

  // Badge pops in / out.
  useEffect(() => {
    Animated.spring(badgeScale, {
      toValue: badge > 0 ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 14,
    }).start();
  }, [badge, badgeScale]);

  const squish = (to) =>
    Animated.spring(press, { toValue: to, useNativeDriver: true, speed: 34, bounciness: 12 }).start();

  const body = tone || colors.accent;
  const litColors = tone ? [tone, tone, tone] : [colors.accentHi, colors.accent, colors.accentDeep];
  const idleColors = isDark
    ? ['rgba(255,255,255,0.10)', `rgba(${colors.accentRgb},0.16)`, `rgba(${colors.accentRgb},0.06)`]
    : ['rgba(255,255,255,0.95)', `rgba(${colors.accentRgb},0.14)`, `rgba(${colors.accentRgb},0.08)`];
  const iconColor = lit ? '#FFFFFF' : body;
  const r = size / 2;

  const haloSize = size * 1.5;
  const haloOpacity = Animated.add(
    glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.38] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] })
  );
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });

  return (
    <Pressable
      onPress={(e) => {
        haptics.tap();
        onPress?.(e);
      }}
      onPressIn={() => squish(1)}
      onPressOut={() => squish(0)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: lit, disabled: !!disabled }}
      style={[{ width: size + 12, height: size + 12, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {/* halo */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          backgroundColor: body,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
          shadowColor: body,
          shadowOpacity: 0.9,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
        }}
      />

      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          overflow: 'hidden',
          transform: [
            { scaleX: press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
            { scaleY: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) },
          ],
        }}
      >
        {/* idle body */}
        <LinearGradient colors={idleColors} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* lit body cross-fades over it */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow }]}>
          <LinearGradient colors={litColors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.22)']}
            start={{ x: 0.5, y: 0.45 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="small" color={iconColor} />
          ) : children || (
            <FontAwesome5 name={icon} size={iconSize || Math.round(size * 0.4)} color={iconColor} solid={solid} />
          )}
        </View>

        {/* gloss */}
        <LinearGradient
          pointerEvents="none"
          colors={[isDark ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
          style={{ position: 'absolute', top: 1.5, left: size * 0.14, right: size * 0.14, height: size * 0.46, borderRadius: r }}
        />
        {/* catchlight */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: size * 0.13,
            left: size * 0.24,
            width: size * 0.16,
            height: size * 0.08,
            borderRadius: size * 0.08,
            backgroundColor: 'rgba(255,255,255,0.75)',
            transform: [{ rotate: '-25deg' }],
          }}
        />
        {/* rim */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: r,
              borderWidth: 1,
              borderColor: lit ? 'rgba(255,255,255,0.40)' : isDark ? 'rgba(255,255,255,0.12)' : `rgba(${colors.accentRgb},0.22)`,
            },
          ]}
        />
      </Animated.View>

      {/* badge */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.badge,
          {
            backgroundColor: colors.sakura,
            borderColor: isDark ? colors.bg : '#FFFFFF',
            transform: [{ scale: badgeScale }],
            shadowColor: colors.sakura,
          },
        ]}
      >
        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge || ''}</Text>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});

export default React.memo(GelOrb);
