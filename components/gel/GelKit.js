import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView,
  ActivityIndicator, useWindowDimensions, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import GelOrb from '../nav/GelOrb';
import { haptics } from '../../utils/haptics';

/*
 * The SempaiHQ "gel" look for every pop-up, sheet and panel — the same glass
 * as the floating bottom bar and the same glossy orbs:
 *
 *   GelGlass   the glass surface: tint · brand wash · top sheen · bright top
 *              edge · rim · soft glow underneath
 *   GelButton  glossy pill button (primary / secondary / danger / ghost)
 *   GelModal   a pop-up built from those: centred card or bottom sheet,
 *              orb icon on top, close orb, title, body, action buttons
 */

const BRAND_ICONS = new Set(['google', 'twitter', 'discord', 'telegram', 'apple', 'android']);

const glassColors = (isDark, c) => ({
  tint: isDark ? 'rgba(20, 21, 30, 0.975)' : 'rgba(255, 255, 255, 0.97)',
  wash: [`rgba(${c.accentRgb},${isDark ? 0.16 : 0.10})`, 'rgba(0,0,0,0)', `rgba(${c.goldRgb},${isDark ? 0.08 : 0.07})`],
  sheen: [isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.70)', 'rgba(255,255,255,0)'],
  edge: ['rgba(255,255,255,0)', isDark ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'],
  rim: isDark ? 'rgba(255,255,255,0.14)' : `rgba(${c.accentRgb},0.18)`,
  shadow: isDark ? c.accent : '#1E293B',
});

/** The glass surface. Children sit on top of all the layers. */
export function GelGlass({ children, style, radius = 28, glow = true, padding = 0 }) {
  const { isDark, colors } = useTheme();
  const g = glassColors(isDark, colors);
  return (
    <View
      style={[
        {
          borderRadius: radius,
          shadowColor: g.shadow,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: glow ? (isDark ? 0.28 : 0.18) : 0,
          shadowRadius: 26,
          elevation: glow ? 16 : 0,
          backgroundColor: Platform.OS === 'android' ? (isDark ? '#14151E' : '#FFFFFF') : 'transparent',
        },
        style,
      ]}
    >
      <View style={{ borderRadius: radius, overflow: 'hidden', padding }}>
        {Platform.OS === 'ios' ? <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: g.tint }]} />
        <LinearGradient pointerEvents="none" colors={g.wash} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LinearGradient pointerEvents="none" colors={g.sheen} style={[StyleSheet.absoluteFill, { bottom: '55%' }]} />
        <LinearGradient
          pointerEvents="none"
          colors={g.edge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', top: 0, left: radius, right: radius, height: 1.5 }}
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1, borderColor: g.rim }]} />
        {children}
      </View>
    </View>
  );
}


/** A soft panel inside a pop-up (details, amounts, lists). */
export function GelInset({ children, style }) {
  const { isDark, colors } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 18,
          padding: 14,
          marginTop: 14,
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : `rgba(${colors.accentRgb},0.06)`,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : `rgba(${colors.accentRgb},0.12)`,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A label · value row for GelInset. */
export function GelRow({ label, value, strong }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, gap: 12 }}>
      <Text style={{ color: colors.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: strong ? colors.accent : colors.textPrimary, fontSize: 14, fontWeight: strong ? '800' : '600', flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** Text field on glass: label above, soft rounded well, accent ring when focused. */
export const GelInput = React.forwardRef(function GelInput({ label, hint, error, style, multiline, ...props }, ref) {
  const { isDark, colors } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginTop: 14 }, style]}>
      {label ? <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 6, marginLeft: 4 }}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={{
          minHeight: multiline ? 92 : 50,
          borderRadius: multiline ? 18 : 25,
          paddingHorizontal: 18,
          paddingTop: multiline ? 14 : 0,
          paddingBottom: multiline ? 14 : 0,
          fontSize: 16,
          color: colors.textPrimary,
          textAlignVertical: multiline ? 'top' : 'center',
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
          borderWidth: focus ? 1.5 : 1,
          borderColor: error ? '#E5484D' : focus ? colors.accent : isDark ? 'rgba(255,255,255,0.10)' : `rgba(${colors.accentRgb},0.18)`,
          ...Platform.select({ web: { outlineStyle: 'none' } }),
        }}
      />
      {error || hint ? (
        <Text style={{ color: error ? '#E5484D' : colors.textMuted, fontSize: 12, marginTop: 5, marginLeft: 6 }}>{error || hint}</Text>
      ) : null}
    </View>
  );
});

/** Tappable choice row: orb icon · title · description · chevron. */
export function GelOption({ icon, title, description, onPress, tone, disabled }) {
  const { isDark, colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingLeft: 8,
          paddingRight: 14,
          marginTop: 10,
          borderRadius: 22,
          backgroundColor: pressed
            ? (isDark ? 'rgba(255,255,255,0.10)' : `rgba(${colors.accentRgb},0.10)`)
            : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)'),
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : `rgba(${colors.accentRgb},0.14)`,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <GelOrb icon={icon} size={42} lit tone={tone} breathe={false} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{title}</Text>
        {description ? <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{description}</Text> : null}
      </View>
      <FontAwesome5 name="chevron-right" size={12} color={tone || colors.accent} />
    </Pressable>
  );
}

/** Glossy pill button. variant: primary | secondary | danger | ghost */
export function GelButton({ label, onPress, variant = 'primary', icon, loading = false, disabled = false, style, small = false, accessibilityLabel }) {
  const { isDark, colors } = useTheme();
  const press = useRef(new Animated.Value(0)).current;
  const squish = (to) => Animated.spring(press, { toValue: to, useNativeDriver: true, speed: 34, bounciness: 10 }).start();
  const h = small ? 40 : 50;
  const danger = '#E5484D';
  const lit = variant === 'primary' || variant === 'danger';
  const body = variant === 'danger'
    ? ['#FF6B6F', danger, '#B8262B']
    : variant === 'primary'
    ? [colors.accentHi, colors.accent, colors.accentDeep]
    : isDark
    ? ['rgba(255,255,255,0.10)', `rgba(${colors.accentRgb},0.14)`, `rgba(${colors.accentRgb},0.06)`]
    : ['rgba(255,255,255,0.98)', `rgba(${colors.accentRgb},0.10)`, `rgba(${colors.accentRgb},0.06)`];
  const textColor = lit ? '#FFFFFF' : variant === 'ghost' ? colors.textSecondary : colors.accent;
  return (
    <Pressable
      onPress={(e) => { if (disabled || loading) return; haptics.tap(); onPress?.(e); }}
      onPressIn={() => squish(1)}
      onPressOut={() => squish(0)}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Animated.View
        style={{
          height: h,
          borderRadius: h / 2,
          overflow: 'hidden',
          transform: [
            { scaleX: press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
            { scaleY: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) },
          ],
          shadowColor: variant === 'danger' ? danger : colors.accent,
          shadowOpacity: lit ? 0.35 : 0,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: lit ? 4 : 0,
        }}
      >
        {variant !== 'ghost' ? (
          <LinearGradient colors={body} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        ) : null}
        {lit ? (
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']} start={{ x: 0.5, y: 0.5 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        ) : null}
        {variant !== 'ghost' ? (
          <LinearGradient
            pointerEvents="none"
            colors={[lit ? 'rgba(255,255,255,0.45)' : isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
            style={{ position: 'absolute', top: 1.5, left: 14, right: 14, height: h * 0.46, borderRadius: h / 2 }}
          />
        ) : null}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: h / 2,
              borderWidth: variant === 'ghost' ? 0 : 1,
              borderColor: lit ? 'rgba(255,255,255,0.35)' : isDark ? 'rgba(255,255,255,0.14)' : `rgba(${colors.accentRgb},0.25)`,
            },
          ]}
        />
        <View style={s.btnInner}>
          {loading ? (
            <ActivityIndicator color={textColor} size="small" />
          ) : (
            <>
              {icon ? <FontAwesome5 name={icon} size={small ? 13 : 15} color={textColor} solid={!BRAND_ICONS.has(icon)} brand={BRAND_ICONS.has(icon)} /> : null}
              <Text style={[s.btnText, { color: textColor, fontSize: small ? 14 : 16 }]} numberOfLines={1}>{label}</Text>
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/*
 * GelModal
 *   variant  'center' (card) | 'sheet' (from the bottom)
 *   icon     FontAwesome5 name shown in a lit orb above the title
 *   tone     orb colour override (e.g. a danger red)
 *   actions  [{ label, onPress, variant }] — laid out as pill buttons
 *   onClose  shows a close orb and closes on scrim tap / back button
 *   dismissable  false = no scrim tap / back close (for "must decide" pop-ups)
 */
export function GelModal({
  visible,
  onClose,
  variant = 'center',
  title,
  subtitle,
  icon,
  tone,
  children,
  actions,
  dismissable = true,
  showClose = true,
  scroll = false,
  maxWidth = 440,
  contentStyle,
  stackActions,
}) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: variant === 'sheet' ? 4 : 9 }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;
  const close = () => (dismissable ? onClose?.() : null);
  const sheet = variant === 'sheet';
  const panelMotion = sheet
    ? { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [Math.min(500, height * 0.6), 0] }) }] }
    : {
        opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
      };
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll ? { keyboardShouldPersistTaps: 'handled', showsVerticalScrollIndicator: false, style: { maxHeight: height * (sheet ? 0.62 : 0.55) } } : {};

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(4,4,10,0.70)' : 'rgba(15,23,42,0.42)' }]} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <View
          pointerEvents="box-none"
          style={[
            { flex: 1, paddingHorizontal: sheet ? 10 : 22 },
            sheet ? { justifyContent: 'flex-end', paddingBottom: Math.max(insets.bottom, 10) } : { justifyContent: 'center' },
          ]}
        >
          <Animated.View style={[{ width: '100%', maxWidth, alignSelf: 'center' }, panelMotion]}>
            <GelGlass radius={sheet ? 30 : 28}>
              <View style={[{ paddingHorizontal: 22, paddingTop: icon ? 24 : 22, paddingBottom: 20 }, contentStyle]}>
                {sheet ? <View style={[s.grab, { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)' }]} /> : null}
                {onClose && showClose && dismissable ? (
                  <View style={s.closeOrb}>
                    <GelOrb icon="times" size={30} onPress={onClose} label="Close" breathe={false} iconSize={12} />
                  </View>
                ) : null}
                {icon ? (
                  <View style={{ alignItems: 'center', marginBottom: 10 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <GelOrb icon={icon} size={56} lit tone={tone} breathe={false} />
                  </View>
                ) : null}
                {title ? (
                  <Text style={[s.title, { color: colors.textPrimary, textAlign: icon ? 'center' : 'left', paddingRight: onClose && showClose && !icon ? 36 : 0 }]}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text style={[s.subtitle, { color: colors.textSecondary, textAlign: icon ? 'center' : 'left' }]}>{subtitle}</Text>
                ) : null}
                <Body {...bodyProps}>{children}</Body>
                {actions?.length ? (
                  <View style={[s.actions, (stackActions ?? actions.length > 2) && { flexDirection: 'column' }]}>
                    {actions.map((a, i) => (
                      <GelButton
                        key={a.label + i}
                        label={a.label}
                        icon={a.icon}
                        variant={a.variant || (i === actions.length - 1 ? 'primary' : 'secondary')}
                        onPress={a.onPress}
                        loading={a.loading}
                        disabled={a.disabled}
                        style={(stackActions ?? actions.length > 2) ? null : { flex: 1 }}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            </GelGlass>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  btnInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  btnText: { fontWeight: '800', letterSpacing: 0.2 },
  grab: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: -8, marginBottom: 12 },
  closeOrb: { position: 'absolute', top: 6, right: 6, zIndex: 5 },
  title: { fontFamily: 'Yoruka', fontSize: 22, lineHeight: 28 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
});
