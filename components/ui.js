import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { GelGlass } from './gel/GelKit';
import GelOrb from './nav/GelOrb';
import { colors as darkColors, gradients as darkGradients, type as darkType, radius, space, layout, hitSlop, glow, useMangaTheme } from '../theme/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* Themed style factories — palette comes from useMangaTheme() so light mode works. */
const makeBtn = ({ colors, type }) => StyleSheet.create({
  base: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 18 },
  text: { ...type.h3, color: '#fff', letterSpacing: 0.6 },
  ghost: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: 18,
  },
  ghostText: { ...type.h3, letterSpacing: 0.4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.sakura,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});

const makeChip = ({ colors, type }) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.line,
  },
  text: { ...type.caption, color: colors.textDim, fontWeight: '600' },
});

const makeBar = ({ colors, type }) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minHeight: 56,
    backgroundColor: colors.bgElevated || colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  side: { minWidth: 44, flexShrink: 0, justifyContent: 'center', flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  title: { ...type.h2, textAlign: 'center' },
  sub: { ...type.caption, textAlign: 'center' },
});

const makePanel = ({ colors }) => StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
});

const makeInp = ({ colors }) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
});

/* ───────────── Pressable with springy scale ───────────── */
export const Tap = ({ children, style, onPress, disabled, scaleTo = 0.96, ...rest }) => {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      onPressIn={() => (s.value = withSpring(scaleTo, { damping: 18, stiffness: 320 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 14, stiffness: 260 }))}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[a, style]}
      accessibilityRole="button"
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
};

/* ───────────── Buttons ───────────── */
export const GradientButton = ({
  label,
  icon,
  onPress,
  loading,
  disabled,
  tone = 'primary',
  size = 'md',
  style,
  full = true,
  accessibilityLabel,
}) => {
  const t = useMangaTheme();
  const { gradients } = t;
  const btn = useMemo(() => makeBtn(t), [t]);
  const pad = size === 'lg' ? 16 : size === 'sm' ? 9 : 13;
  const fs = size === 'lg' ? 16 : size === 'sm' ? 13 : 15;
  const off = disabled || loading;
  return (
    <Tap
      onPress={onPress}
      disabled={off}
      accessibilityLabel={accessibilityLabel || label}
      style={[{ alignSelf: full ? 'stretch' : 'flex-start', opacity: off ? 0.55 : 1 }, style]}
    >
      <LinearGradient
        colors={gradients[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[btn.base, { paddingVertical: pad }, !off && glow(gradients[tone][1], 0.35)]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            {icon ? <Icon name={icon} size={fs} color="#fff" style={{ marginRight: 8 }} solid /> : null}
            <Text style={[btn.text, { fontSize: fs }]}>{label}</Text>
          </>
        )}
      </LinearGradient>
    </Tap>
  );
};

export const GhostButton = ({ label, icon, onPress, disabled, danger, style, size = 'md', full = true }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  const btn = useMemo(() => makeBtn(t), [t]);
  const c = danger ? colors.danger : colors.textDim;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[
        btn.ghost,
        { paddingVertical: size === 'sm' ? 8 : 12, alignSelf: full ? 'stretch' : 'flex-start', opacity: disabled ? 0.5 : 1 },
        danger && { borderColor: colors.danger + '66' },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={c} style={{ marginRight: 8 }} /> : null}
      <Text style={[btn.ghostText, { color: c }]}>{label}</Text>
    </Tap>
  );
};

export const IconButton = ({ icon, onPress, label, tone, size = 40, solid = true, style, badge }) => {
  const t = useMangaTheme();
  const { colors } = t;
  const btn = useMemo(() => makeBtn(t), [t]);
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone === 'primary' ? colors.primary : colors.surfaceHi,
          borderWidth: 1,
          borderColor: colors.line,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon name={icon} size={size * 0.38} color={tone === 'primary' ? '#fff' : colors.textDim} solid={solid} />
      {badge ? (
        <View style={btn.badge}>
          <Text style={btn.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Tap>
  );
};

/* ───────────── Chips / badges ───────────── */
export const Chip = ({ label, active, onPress, icon, color, style }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  const chip = useMemo(() => makeChip(t), [t]);
  const c = color || colors.primary;
  return (
    <Tap
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.94}
      accessibilityState={{ selected: !!active }}
      style={[
        chip.base,
        active && { backgroundColor: c + '33', borderColor: c },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={11} color={active ? c : colors.textMute} style={{ marginRight: 6 }} solid /> : null}
      <Text style={[chip.text, active && { color: colors.text }]}>{label}</Text>
    </Tap>
  );
};

export const StatusBadge = ({ value = 'ongoing', style }) => {
  const t = useMangaTheme();
  const { type, status: STATUS } = t;
  const s = STATUS[value] || STATUS.ongoing;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: s.color + '22', borderWidth: 1, borderColor: s.color + '88' }, style]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color, marginRight: 6 }} />
      <Text style={{ ...type.caption, color: s.color, fontWeight: '700' }}>{s.label}</Text>
    </View>
  );
};

export const AdultBadge = () => {
  const t = useMangaTheme();
  const { colors } = t;
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.danger }}>
      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>18+</Text>
    </View>
  );
};

/* ───────────── Layout helpers ───────────── */
export const Screen = ({ children, style }) => {
  const t = useMangaTheme();
  const { colors } = t;
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {/* ambient glows */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient colors={[colors.electric + '30', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280 }} />
        <LinearGradient colors={['transparent', colors.primary + '1F']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 240 }} />
      </View>
      {children}
    </View>
  );
};

export const AppBar = ({ title, subtitle, onBack, left, right, transparent, style }) => {
  const t = useMangaTheme();
  const bar = useMemo(() => makeBar(t), [t]);
  return (
    <View style={[bar.wrap, transparent && { backgroundColor: 'transparent', borderBottomWidth: 0 }, style]}>
      <View style={bar.side}>
        {onBack ? <IconButton icon="chevron-left" onPress={onBack} label="Go back" size={38} /> : left}
      </View>
      <View style={bar.center} pointerEvents="none">
        {title ? <Text numberOfLines={1} style={bar.title}>{title}</Text> : null}
        {subtitle ? <Text numberOfLines={1} style={bar.sub}>{subtitle}</Text> : null}
      </View>
      <View style={[bar.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
};

export const SectionHeader = ({ title, icon, accent, action, onAction, style }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  const a = accent || colors.primary;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: a, marginRight: 10 }} />
        {icon ? <Icon name={icon} size={15} color={a} style={{ marginRight: 8 }} solid /> : null}
        <Text style={type.h1}>{title}</Text>
      </View>
      {action ? (
        <Tap onPress={onAction}>
          <Text style={{ ...type.caption, color: colors.primaryHi, fontWeight: '700' }}>{action}</Text>
        </Tap>
      ) : null}
    </View>
  );
};

/** Manga-panel card: thin border, subtle top gradient, soft shadow. */
export const Panel = ({ children, style, accent, onPress, entering = FadeInDown.duration(320) }) => {
  const t = useMangaTheme();
  const panel = useMemo(() => makePanel(t), [t]);
  const inner = (
    <Animated.View entering={entering} style={[panel.base, accent && { borderColor: accent + '66' }, style]}>
      {children}
    </Animated.View>
  );
  return onPress ? <Tap onPress={onPress} scaleTo={0.985}>{inner}</Tap> : inner;
};

export const StatTile = ({ icon, label, value, color, style }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  const c = color || colors.primary;
  return (
    <View style={[{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space.md }, style]}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Icon name={icon} size={13} color={c} solid />
      </View>
      <Text style={{ ...type.h1, fontSize: 20 }}>{value}</Text>
      <Text style={type.caption}>{label}</Text>
    </View>
  );
};

/* ───────────── Inputs ───────────── */
export const Field = ({ label, hint, error, right, children, style }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      {label ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={type.label}>{label}</Text>
          {right ? <Text style={type.caption}>{right}</Text> : null}
        </View>
      ) : null}
      {children}
      {error ? <Text style={{ ...type.caption, color: colors.danger, marginTop: 4 }}>{error}</Text> : hint ? <Text style={{ ...type.caption, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
};

export const Input = React.forwardRef(({ multiline, style, onFocus, onBlur, icon, ...props }, ref) => {
  const t = useMangaTheme();
  const { colors } = t;
  const inp = useMemo(() => makeInp(t), [t]);
  const [focus, setFocus] = useState(false);
  return (
    <View
      style={[
        inp.wrap,
        multiline && { alignItems: 'flex-start' },
        focus && { borderColor: colors.primary, backgroundColor: colors.surfaceTop },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={focus ? colors.primary : colors.textMute} style={{ marginRight: 10, marginTop: multiline ? 4 : 0 }} /> : null}
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.primary}
        onFocus={(e) => { setFocus(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocus(false); onBlur && onBlur(e); }}
        style={[inp.input, multiline && { minHeight: 96, textAlignVertical: 'top' }, style]}
        {...props}
      />
    </View>
  );
});

export const Segmented = ({ options, value, onChange }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceHi, borderRadius: radius.md, padding: 4, borderWidth: 1, borderColor: colors.line }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Tap
            key={o.value}
            onPress={() => onChange(o.value)}
            scaleTo={0.97}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.sm, alignItems: 'center', backgroundColor: on ? colors.primary : 'transparent' }}
          >
            <Text style={{ ...type.caption, color: on ? '#fff' : colors.textMute, fontWeight: '700' }}>{o.label}</Text>
          </Tap>
        );
      })}
    </View>
  );
};

export const Switch = ({ value, onChange, label, sub }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  return (
    <Tap onPress={() => onChange(!value)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={type.bodyStrong}>{label}</Text>
        {sub ? <Text style={type.caption}>{sub}</Text> : null}
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? colors.primary : colors.surfaceTop, justifyContent: 'center' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: value ? 'flex-end' : 'flex-start' }} />
      </View>
    </Tap>
  );
};

/* ───────────── Feedback ───────────── */
export const Toast = ({ message, type: kind = 'error', style }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  if (!message) return null;
  const c = kind === 'success' ? colors.mint : kind === 'info' ? colors.info : colors.danger;
  const ic = kind === 'success' ? 'check-circle' : kind === 'info' ? 'info-circle' : 'exclamation-triangle';
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16)}
      exiting={FadeOut.duration(200)}
      style={[{ flexDirection: 'row', alignItems: 'center', marginHorizontal: space.lg, marginVertical: space.sm, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: c + '88', borderLeftWidth: 4, borderLeftColor: c }, style]}
      accessibilityLiveRegion="polite"
    >
      <Icon name={ic} size={15} color={c} solid />
      <Text style={{ ...type.body, color: colors.text, marginLeft: 10, flex: 1 }}>{message}</Text>
    </Animated.View>
  );
};

export const Skeleton = ({ width = '100%', height = 16, r = 8, style }) => {
  const t = useMangaTheme();
  const { colors } = t;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.35, 0.8]) }));
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.surfaceTop }, a, style]} />;
};

export const PosterGridSkeleton = () => {
  const t = useMangaTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.gridGap, paddingHorizontal: layout.gutter }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ width: layout.posterW }}>
          <Skeleton height={layout.posterH} r={radius.lg} />
          <Skeleton width="70%" height={14} style={{ marginTop: 10 }} />
          <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
};

export const EmptyState = ({ icon = 'book-open', title, subtitle, action, onAction, style }) => {
  const t = useMangaTheme();
  const { colors, gradients, type } = t;
  return (
    <Animated.View entering={FadeIn.duration(350)} style={[{ alignItems: 'center', padding: space.xxl }, style]}>
      <LinearGradient colors={[colors.primary + '40', colors.electric + '40']} style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}>
        <Icon name={icon} size={32} color="#fff" solid />
      </LinearGradient>
      <Text style={{ ...type.h1, textAlign: 'center' }}>{title}</Text>
      {subtitle ? <Text style={{ ...type.body, textAlign: 'center', marginTop: 6, maxWidth: 300 }}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: space.lg, minWidth: 200 }}><GradientButton label={action} onPress={onAction} /></View> : null}
    </Animated.View>
  );
};

/* ───────────── Bottom sheet ───────────── */
export const Sheet = ({ visible, onClose, title, children, footer, tall }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  // The backdrop is its own layer *behind* the panel. (The panel used to sit
  // inside a TouchableWithoutFeedback to stop taps closing it — on Android
  // that wrapper also swallowed drag gestures, so lists inside sheets could
  // not scroll.)
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          entering={FadeInDown.springify().damping(18)}
          style={{ maxHeight: tall ? '90%' : '80%', marginHorizontal: 10, marginBottom: 10 }}
        >
          <GelGlass radius={30} style={{ flexShrink: 1 }} innerStyle={{ flexShrink: 1, paddingTop: 10 }}>
          <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: 10 }} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, paddingBottom: space.md }}>
              <Text style={type.h1}>{title}</Text>
              <GelOrb icon="times" size={30} iconSize={12} onPress={onClose} label="Close" breathe={false} />
            </View>
          ) : null}
          {/* flexShrink lets a ScrollView child take the remaining height and scroll */}
          <View style={{ paddingHorizontal: space.xl, flexShrink: 1 }}>{children}</View>
          {footer ? <View style={{ padding: space.xl, paddingTop: space.md }}>{footer}</View> : <View style={{ height: space.lg }} />}
          </GelGlass>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* ───────────── Poster card (library grid) ───────────── */
export const PosterCard = ({ cover, title, author, views, adult, onPress, onAuthor, index = 0, badge, progress }) => {
  const t = useMangaTheme();
  const { colors, gradients, type } = t;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(380)} style={{ width: layout.posterW }}>
      <Tap onPress={onPress} scaleTo={0.97} accessibilityLabel={`Open ${title}`}>
        <View style={[{ width: layout.posterW, height: layout.posterH, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceHi, borderWidth: 1, borderColor: colors.line }, glow('#000', 0.5)]}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <LinearGradient colors={gradients.card} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }} />
          <View style={{ position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
            {badge || <View />}
            {adult ? <AdultBadge /> : null}
          </View>
          <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10 }}>
            <Text numberOfLines={2} style={{ ...type.h3, fontSize: 14, lineHeight: 18 }}>{title}</Text>
          </View>
          {typeof progress === 'number' ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.18)' }}>
              <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: colors.primaryHi }} />
            </View>
          ) : null}
        </View>
      </Tap>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 }}>
        <Tap onPress={onAuthor} style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
          <Icon name="paint-brush" size={10} color={colors.primaryHi} />
          <Text numberOfLines={1} style={{ ...type.caption, marginLeft: 6, flex: 1 }}>{author || 'Unknown'}</Text>
        </Tap>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="eye" size={10} color={colors.textMute} />
          <Text style={{ ...type.caption, marginLeft: 4 }}>{views}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

/* ───────────── Wallet pill (collapsed summary) ───────────── */
export const WalletPill = ({ smp, points, onPress, open }) => {
  const t = useMangaTheme();
  const { colors, type } = t;
  return (
    <Tap onPress={onPress} accessibilityLabel="Toggle wallet panel" style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceTop, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.primary + '66' }}>
      <Icon name="wallet" size={14} color={colors.primaryHi} solid />
      <Text style={{ ...type.bodyStrong, marginLeft: 8, flex: 1 }}>{smp} SMP</Text>
      <Icon name="star" size={11} color={colors.gold} solid />
      <Text style={{ ...type.bodyStrong, marginLeft: 6, marginRight: 10 }}>{points} Pts</Text>
      <Icon name={open ? 'chevron-down' : 'chevron-up'} size={12} color={colors.textMute} />
    </Tap>
  );
};

export const Divider = ({ style }) => {
  const t = useMangaTheme();
  const { colors } = t;
  return <View style={[{ height: 1, backgroundColor: colors.line, marginVertical: space.lg }, style]} />;
};

export { radius, space, layout, glow };
// Legacy token exports (dark defaults) — prefer useMangaTheme() for themed values.
export const colors = darkColors;
export const gradients = darkGradients;
export const type = darkType;
