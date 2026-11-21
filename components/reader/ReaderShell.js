import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

/*
 * The frame around a book (PDF or EPUB): a slim top bar (back · title ·
 * position · tools), a thin progress line, and full screen — which hides the
 * bar and the phone's status bar and leaves one small button to come back.
 */
const BAR_H = 52;

function Tool({ icon, label, onPress, active, colors }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        s.tool,
        { backgroundColor: active ? colors.accentSoft : 'transparent', opacity: pressed ? 0.6 : 1 },
      ]}
    >
      {typeof icon === 'string' ? (
        <Ionicons name={icon} size={20} color={active ? colors.accent : colors.textSecondary} />
      ) : icon}
    </Pressable>
  );
}

export default function ReaderShell({
  title,
  subtitle,
  progress, // 0..1, or null when unknown
  onBack,
  fullscreen,
  onToggleFullscreen,
  tools = [], // [{ icon, label, onPress, active }]
  panel, // optional node shown under the bar (e.g. text size)
  children,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 0 : insets.top;
  const pct = progress == null ? null : Math.max(0, Math.min(1, progress));

  return (
    <View style={[s.page, { backgroundColor: colors.bg }]}>
      <StatusBar hidden={!!fullscreen} barStyle={isDark ? 'light-content' : 'dark-content'} />

      {!fullscreen ? (
        <View style={{ paddingTop: top, backgroundColor: colors.bgElevated, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
          <View style={s.bar}>
            <Tool icon="arrow-back" label="Close book" onPress={onBack} colors={colors} />
            <View style={s.titleWrap}>
              <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
              {subtitle ? (
                <Text style={[s.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>
              ) : null}
            </View>
            {tools.map((t) => (
              <Tool key={t.label} {...t} colors={colors} />
            ))}
            <Tool icon="expand-outline" label="Full screen" onPress={onToggleFullscreen} colors={colors} />
          </View>
          {pct != null ? (
            <View style={[s.track, { backgroundColor: colors.border }]}>
              <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: colors.accent }]} />
            </View>
          ) : null}
          {panel}
        </View>
      ) : null}

      <View style={s.body}>{children}</View>

      {fullscreen ? (
        <>
          <Pressable
            onPress={onToggleFullscreen}
            accessibilityRole="button"
            accessibilityLabel="Exit full screen"
            hitSlop={10}
            style={[s.exit, { top: top + 10, backgroundColor: isDark ? 'rgba(11,11,20,0.55)' : 'rgba(255,255,255,0.7)', borderColor: colors.border }]}
          >
            <Ionicons name="contract-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          {pct != null ? (
            <View style={[s.track, s.trackBottom, { backgroundColor: 'transparent' }]}>
              <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: colors.accent, opacity: 0.7 }]} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/* Text-size control shown under the bar. */
export function TextSizePanel({ size, min, max, onChange }) {
  const { colors } = useTheme();
  const btn = (label, next, disabled) => (
    <Pressable
      onPress={() => !disabled && onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === 'A−' ? 'Smaller text' : 'Bigger text'}
      style={[s.sizeBtn, { borderColor: colors.borderStrong, opacity: disabled ? 0.35 : 1 }]}
    >
      <Text style={{ color: colors.textPrimary, fontSize: label === 'A−' ? 14 : 19, fontWeight: '700' }}>{label === 'A−' ? 'A' : 'A'}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 2 }}>{label === 'A−' ? '−' : '+'}</Text>
    </Pressable>
  );
  const steps = max - min;
  return (
    <View style={[s.panel, { borderTopColor: colors.border }]}>
      {btn('A−', size - 1, size <= min)}
      <View style={s.sizeTrack}>
        <View style={[s.track, { backgroundColor: colors.border, height: 3, borderRadius: 2 }]}>
          <View style={[s.fill, { width: `${((size - min) / steps) * 100}%`, backgroundColor: colors.accent, borderRadius: 2 }]} />
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' }}>Text size {size}</Text>
      </View>
      {btn('A+', size + 1, size >= max)}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  bar: { height: BAR_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 2 },
  tool: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flex: 1, paddingHorizontal: 6, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
  track: { height: 2, width: '100%' },
  trackBottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fill: { height: '100%' },
  body: { flex: 1 },
  exit: {
    position: 'absolute', right: 12, width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth,
  },
  panel: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  sizeBtn: { width: 52, height: 38, borderRadius: 19, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  sizeTrack: { flex: 1 },
});
