// components/MangaUI.js
//
// Reusable manga / anime-novel UI kit. Only uses react-native's built-in Animated API (no new dependencies).
// Every component takes the colour palette as a prop (see getProfilePalette in styles/ProfileMangaStyles.js)
// so it works in both dark and light mode. Looping animations switch off when the OS "reduce motion" setting is on.

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Dimensions,
  AccessibilityInfo,
} from 'react-native';

const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;

// ------------------------------------------------------------------ accessibility
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      const p = AccessibilityInfo.isReduceMotionEnabled?.();
      if (p && p.then) p.then((v) => alive && setReduce(!!v)).catch(() => {});
    } catch (e) {}
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduce(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

// ------------------------------------------------------------------ press feedback
export const PressScale = ({
  onPress,
  children,
  style,
  disabled,
  scaleTo = 0.95,
  accessibilityLabel,
  accessibilityRole = 'button',
  hitSlop,
}) => {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(s, { toValue: v, friction: 5, tension: 220, useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

// ------------------------------------------------------------------ entrance
export const StaggerIn = ({ index = 0, base = 120, step = 130, from = 28, children, style, reduceMotion }) => {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      v.setValue(1);
      return undefined;
    }
    const a = Animated.spring(v, { toValue: 1, delay: base + index * step, friction: 7, tension: 55, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduceMotion]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// ------------------------------------------------------------------ manga panel (thick ink border + hard offset shadow)
export const MangaPanel = ({ palette, isDark, children, style, offset = 5, bodyStyle, tint }) => {
  const shadowColor = isDark ? palette.accentDim : palette.textPrimary;
  return (
    <View style={[{ marginRight: offset, marginBottom: offset + 20 }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: offset,
          left: offset,
          right: -offset,
          bottom: -offset,
          backgroundColor: shadowColor,
        }}
      />
      <View
        style={[
          {
            backgroundColor: tint || palette.bgCard,
            borderWidth: 3,
            borderColor: palette.textPrimary,
            overflow: 'hidden',
          },
          bodyStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

// ------------------------------------------------------------------ halftone screentone corner
export const Halftone = memo(({ color, rows = 6, cols = 9, size = 7, gap = 5, corner = 'tr', style }) => {
  const step = size + gap;
  const dots = useMemo(() => {
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const d = (r + col) / (rows + cols - 2);
        const k = Math.max(0, 1 - d * 1.15);
        if (k < 0.12) continue;
        out.push({ r, col, s: size * k, o: 0.25 + 0.55 * k });
      }
    }
    return out;
  }, [rows, cols, size]);
  const pos =
    corner === 'tr' ? { top: 0, right: 0 } : corner === 'tl' ? { top: 0, left: 0 } : corner === 'br' ? { bottom: 0, right: 0 } : { bottom: 0, left: 0 };
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: cols * step, height: rows * step }, pos, style]}>
      {dots.map((d) => (
        <View
          key={`${d.r}-${d.col}`}
          style={{
            position: 'absolute',
            left: (corner.endsWith('r') ? cols - 1 - d.col : d.col) * step + (size - d.s) / 2,
            top: (corner.startsWith('t') ? d.r : rows - 1 - d.r) * step + (size - d.s) / 2,
            width: d.s,
            height: d.s,
            borderRadius: d.s / 2,
            backgroundColor: color,
            opacity: d.o,
          }}
        />
      ))}
    </View>
  );
});

// ------------------------------------------------------------------ radiating speed lines (slowly rotating)
export const SpeedLines = memo(({ color, count = 24, radius = 280, inner = 70, reduceMotion, style }) => {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 90000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  const lines = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (360 / count) * i + ((i * 37) % 7),
        len: radius - inner - ((i * 53) % 60),
        th: 1 + (i % 3),
        op: 0.1 + ((i * 17) % 5) * 0.04,
      })),
    [count, radius, inner],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Animated.View
        style={{ width: 0, height: 0, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
      >
        {lines.map((l, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: -l.len / 2,
              top: -l.th / 2,
              width: l.len,
              height: l.th,
              backgroundColor: color,
              opacity: l.op,
              transform: [{ rotate: `${l.angle}deg` }, { translateX: inner + l.len / 2 }],
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
});

// ------------------------------------------------------------------ falling sakura petals
export const SakuraField = memo(({ palette, count = 9, reduceMotion }) => {
  const petals = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 97) % 100,
        size: 7 + ((i * 5) % 7),
        dur: 11000 + ((i * 1700) % 7000),
        delay: (i * 1300) % 6000,
        sway: 18 + ((i * 11) % 26),
        spin: i % 2 ? 1 : -1,
        color: i % 3 === 0 ? palette.gold : i % 3 === 1 ? palette.accentBright : palette.accent,
      })),
    [count, palette],
  );
  const t = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loops = t.map((v, i) => {
      v.setValue(0);
      const l = Animated.loop(
        Animated.sequence([
          Animated.delay(petals[i].delay),
          Animated.timing(v, { toValue: 1, duration: petals[i].dur, easing: Easing.linear, useNativeDriver: true }),
        ]),
      );
      l.start();
      return l;
    });
    return () => loops.forEach((l) => l.stop());
  }, [reduceMotion]);
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {petals.map((p, i) => (
        <Animated.View
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: -24,
            width: p.size,
            height: p.size * 0.7,
            backgroundColor: p.color,
            borderTopLeftRadius: p.size,
            borderBottomRightRadius: p.size,
            borderTopRightRadius: 2,
            borderBottomLeftRadius: 2,
            opacity: t[i].interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 0.85, 0.7, 0] }),
            transform: [
              { translateY: t[i].interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_H + 40] }) },
              { translateX: t[i].interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, p.sway, 0, -p.sway, 0] }) },
              { rotate: t[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 540}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
});

// ------------------------------------------------------------------ number that counts up
export const CountUp = ({ value = 0, duration = 1100, format = (n) => String(n), style, reduceMotion }) => {
  const v = useRef(new Animated.Value(0)).current;
  const target = Number(value) || 0;
  const [shown, setShown] = useState(reduceMotion ? target : 0);
  useEffect(() => {
    if (reduceMotion) {
      setShown(target);
      return undefined;
    }
    const id = v.addListener(({ value: x }) => setShown(Math.round(x)));
    v.setValue(0);
    const a = Animated.timing(v, { toValue: target, duration, delay: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => {
      a.stop();
      v.removeListener(id);
    };
  }, [target, reduceMotion]);
  return <Text style={style}>{format(shown)}</Text>;
};

// ------------------------------------------------------------------ outlined "stamp" sound-effect text
export const SfxText = ({ children, color, outline, size = 32, delay = 700, tilt = -8, reduceMotion, style }) => {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      v.setValue(1);
      return undefined;
    }
    const a = Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true })]);
    a.start();
    return () => a.stop();
  }, [reduceMotion]);
  const base = { fontSize: size, fontWeight: '900', letterSpacing: 1 };
  const offs = [[-2, -2], [2, -2], [-2, 2], [2, 2], [0, 3], [0, -3], [3, 0], [-3, 0]];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute' },
        style,
        { opacity: v, transform: [{ rotate: `${tilt}deg` }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }] },
      ]}
    >
      {offs.map(([x, y], i) => (
        <Text key={i} style={[base, { position: 'absolute', left: x, top: y, color: outline }]}>
          {children}
        </Text>
      ))}
      <Text style={[base, { color }]}>{children}</Text>
    </Animated.View>
  );
};

// ------------------------------------------------------------------ slanted section banner
export const SlashBanner = ({ title, subtitle, palette, style }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }, style]}>
    <View
      style={{
        transform: [{ skewX: '-14deg' }],
        backgroundColor: palette.accent,
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderWidth: 2,
        borderColor: palette.textPrimary,
      }}
    >
      <View style={{ transform: [{ skewX: '14deg' }] }}>
        <Text style={{ color: palette.textOnAccent, fontSize: 13, fontWeight: '900', letterSpacing: 3 }}>{title}</Text>
      </View>
    </View>
    {subtitle ? <Text style={{ marginLeft: 10, color: palette.textMuted, fontSize: 11, letterSpacing: 2 }}>{subtitle}</Text> : null}
    <View style={{ flex: 1, height: 2, marginLeft: 10, backgroundColor: palette.border }} />
  </View>
);

// ------------------------------------------------------------------ light glint that sweeps across a plate
export const ShineSweep = ({ color, reduceMotion, pause = 4200, width = 60 }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    v.setValue(0);
    const l = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(pause),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [reduceMotion]);
  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -10,
        bottom: -10,
        width,
        backgroundColor: color,
        opacity: 0.22,
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }, { skewX: '-20deg' }],
      }}
    />
  );
};

// ------------------------------------------------------------------ chunky progress bar with tick marks
export const InkBar = ({ progress = 0, palette, height = 14, reduceMotion }) => {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const v = useRef(new Animated.Value(reduceMotion ? p : 0)).current;
  useEffect(() => {
    if (reduceMotion) {
      v.setValue(p);
      return undefined;
    }
    const a = Animated.timing(v, { toValue: p, duration: 1100, delay: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [p, reduceMotion]);
  return (
    <View style={{ height, borderWidth: 2, borderColor: palette.textPrimary, backgroundColor: palette.bgCard, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          backgroundColor: palette.accent,
          width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
        }}
      />
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 25}%`, width: 2, backgroundColor: palette.textPrimary, opacity: 0.3 }}
        />
      ))}
    </View>
  );
};

// ------------------------------------------------------------------ speech bubble with a tail pointing up
export const SpeechBubble = ({ children, palette, style }) => (
  <View style={[{ alignSelf: 'stretch', marginTop: 16 }, style]}>
    <View
      style={{
        alignSelf: 'center',
        width: 14,
        height: 14,
        backgroundColor: palette.bgElevated,
        borderLeftWidth: 2,
        borderTopWidth: 2,
        borderColor: palette.textPrimary,
        transform: [{ rotate: '45deg' }],
        marginBottom: -8,
        zIndex: 2,
      }}
    />
    <View
      style={{
        backgroundColor: palette.bgElevated,
        borderWidth: 2,
        borderColor: palette.textPrimary,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      {children}
    </View>
  </View>
);

// ------------------------------------------------------------------ button with hard ink shadow
export const InkButton = ({ label, icon, onPress, palette, isDark, variant = 'primary', disabled, accessibilityLabel }) => {
  const primary = variant === 'primary';
  const shadowColor = isDark ? palette.accentDim : palette.textPrimary;
  return (
    <View style={{ marginRight: 4, marginBottom: 4, opacity: disabled ? 0.5 : 1 }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, right: -4, bottom: -4, backgroundColor: shadowColor }} />
      <PressScale onPress={onPress} disabled={disabled} accessibilityLabel={accessibilityLabel || label} scaleTo={0.96}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 14,
            backgroundColor: primary ? palette.accent : palette.bgElevated,
            borderWidth: 3,
            borderColor: palette.textPrimary,
          }}
        >
          {icon}
          <Text
            style={{
              marginLeft: icon ? 8 : 0,
              color: primary ? palette.textOnAccent : palette.textPrimary,
              fontSize: 12,
              fontWeight: '900',
              letterSpacing: 2,
            }}
          >
            {label}
          </Text>
        </View>
      </PressScale>
    </View>
  );
};

export { SCREEN_W, SCREEN_H };