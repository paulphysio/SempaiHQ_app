import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, Animated, Easing, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '../context/NavigationContext';
import { useTheme } from '../context/ThemeContext';
import { BrandBackdrop, BrandMark, SCREEN_W, SCREEN_H } from '../components/brand/Brand';

/*
 * First-launch intro. Opens on the same ink as the native splash, so the
 * hand-off is seamless; the whole sequence is < 3s and tap-to-skip.
 */
const T_MARK = 150;
const T_CHIPS = 900;
const T_EXIT = 2700;
const DURATION_EXIT = 320;
const TRACK_W = Math.min(220, SCREEN_W * 0.55);

const VALUES = [
  { icon: 'book-open', label: 'Read novels & manga' },
  { icon: 'coins', label: 'Earn SMP as you read' },
  { icon: 'award', label: 'Collect & own' },
];

const EMBERS = Array.from({ length: 9 }, (_, i) => ({
  x: (SCREEN_W / 9) * i + Math.random() * 30,
  size: 2 + Math.random() * 3,
  delay: Math.random() * 1400,
  duration: 2600 + Math.random() * 1600,
}));

const WelcomeScreen = () => {
  const { colors } = useTheme();
  const { handleWelcomeComplete } = useNavigation();

  const mark = useRef(new Animated.Value(0)).current;
  const chips = useRef(VALUES.map(() => new Animated.Value(0))).current;
  const bar = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const embers = useRef(EMBERS.map(() => new Animated.Value(0))).current;
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    Animated.timing(exit, { toValue: 1, duration: DURATION_EXIT, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(async () => {
      try {
        await AsyncStorage.setItem('hasSeenWelcome', 'true');
      } catch (e) {
        console.error('Error saving welcome state:', e);
      }
      handleWelcomeComplete();
    });
  }, [exit, handleWelcomeComplete]);

  useEffect(() => {
    Animated.spring(mark, { toValue: 1, delay: T_MARK, useNativeDriver: true, speed: 8, bounciness: 9 }).start();
    const chipTimer = setTimeout(() => {
      Animated.stagger(
        160,
        chips.map((c) => Animated.timing(c, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }))
      ).start();
    }, T_CHIPS);
    Animated.timing(bar, { toValue: 1, duration: T_EXIT, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const emberLoops = embers.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(EMBERS[i].delay),
          Animated.timing(v, { toValue: 1, duration: EMBERS[i].duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    emberLoops.forEach((l) => l.start());
    const exitTimer = setTimeout(finish, T_EXIT);
    return () => {
      clearTimeout(chipTimer);
      clearTimeout(exitTimer);
      emberLoops.forEach((l) => l.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sceneStyle = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
  };

  return (
    <Pressable style={styles.root} onPress={finish} accessibilityRole="button" accessibilityLabel="Welcome to Sempai HQ. Tap to continue">
      <BrandBackdrop>
        {/* rising embers */}
        {EMBERS.map((e, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: e.x,
              bottom: 0,
              width: e.size,
              height: e.size,
              borderRadius: e.size,
              backgroundColor: i % 3 === 0 ? colors.gold : colors.accentHi,
              opacity: embers[i].interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.9, 0.5, 0] }),
              transform: [{ translateY: embers[i].interpolate({ inputRange: [0, 1], outputRange: [0, -SCREEN_H * 0.7] }) }],
            }}
          />
        ))}

        <Animated.View style={[styles.scene, sceneStyle]}>
          <Animated.View
            style={{
              opacity: mark,
              transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
            }}
          >
            <BrandMark size={128} />
          </Animated.View>

          <View style={styles.chips}>
            {VALUES.map((v, i) => (
              <Animated.View
                key={v.label}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.borderStrong,
                    opacity: chips[i],
                    transform: [{ translateY: chips[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                  },
                ]}
              >
                <View style={[styles.chipIcon, { backgroundColor: colors.accentSoft }]}>
                  <FontAwesome5 name={v.icon} size={12} color={colors.accent} solid />
                </View>
                <Text style={[styles.chipText, { color: colors.textPrimary }]}>{v.label}</Text>
              </Animated.View>
            ))}
          </View>

          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-TRACK_W, 0] }) }] },
              ]}
            >
              <LinearGradient colors={[colors.gold, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>Tap to skip</Text>
        </Animated.View>
      </BrandBackdrop>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  chips: { marginTop: 34, gap: 10, alignItems: 'stretch', width: '100%', maxWidth: 300 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 23,
    borderWidth: 1,
  },
  chipIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '700' },
  track: { width: TRACK_W, height: 3, borderRadius: 2, overflow: 'hidden', marginTop: 40 },
  hint: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, marginTop: 12, textTransform: 'uppercase' },
});

export default WelcomeScreen;
