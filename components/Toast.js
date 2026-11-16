import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Text, View, StyleSheet, Pressable, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { radius, space } from '../theme/tokens';

/**
 * App-wide, non-blocking feedback.
 *
 *   import { toast } from '../components/Toast';
 *   toast.success('Address copied');
 *   toast.error('Could not load chapters');
 *   toast.info('Saved for offline reading');
 *
 * Use this for confirmations and errors that need no decision. Keep
 * Alert.alert only for questions that need an answer (confirm/cancel).
 */
let hostShow = null;
const queue = [];

const show = (message, type = 'info', duration) => {
  if (!message) return;
  const item = { id: Date.now() + Math.random(), message: String(message), type, duration };
  if (hostShow) hostShow(item);
  else queue.push(item);
};

export const toast = {
  show: (message, opts = {}) => show(message, opts.type || 'info', opts.duration),
  success: (message, opts = {}) => show(message, 'success', opts.duration),
  error: (message, opts = {}) => show(message, 'error', opts.duration),
  info: (message, opts = {}) => show(message, 'info', opts.duration),
};

const ICONS = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };

/** Mount once near the root (App.js). */
export const ToastHost = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const pending = useRef([]);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      const next = pending.current.shift();
      setCurrent(next || null);
    });
  }, [anim]);

  useEffect(() => {
    hostShow = (item) => {
      setCurrent((cur) => {
        if (cur) {
          // Same message twice in a row (double tap etc.) — don't stack it.
          if (cur.message !== item.message) pending.current.push(item);
          return cur;
        }
        return item;
      });
    };
    while (queue.length) hostShow(queue.shift());
    return () => { hostShow = null; };
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 5 }).start();
    AccessibilityInfo.announceForAccessibility?.(current.message);
    const ms = current.duration ?? Math.min(6000, 2200 + current.message.length * 35);
    timer.current = setTimeout(hide, ms);
    return () => clearTimeout(timer.current);
  }, [current, anim, hide]);

  if (!current) return null;

  const tint = current.type === 'success' ? colors.success : current.type === 'error' ? colors.danger : colors.info;

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer]}>
      <Animated.View
        style={[
          styles.toast,
          {
            top: insets.top + 10,
            backgroundColor: colors.bgCardAlt,
            borderColor: colors.borderStrong,
            borderLeftColor: tint,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
          },
        ]}
        accessibilityLiveRegion="polite"
      >
        <Pressable onPress={hide} style={styles.row} accessibilityRole="alert" accessibilityHint="Tap to dismiss">
          <FontAwesome5 name={ICONS[current.type] || ICONS.info} size={16} color={tint} solid />
          <Text style={[styles.text, { color: colors.textPrimary }]} numberOfLines={4}>
            {current.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: { zIndex: 10000, elevation: 10000 },
  toast: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  text: { flex: 1, fontSize: 15, lineHeight: 20 },
});
