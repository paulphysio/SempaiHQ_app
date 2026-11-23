import { StyleSheet } from 'react-native';
import { radius } from '../theme/tokens';

/**
 * Global header — "Seal" bar. Theme colours come from useTheme().colors
 * (theme/tokens.js); everything here is layout + depth.
 */
export const HEADER_HEIGHT = 60;

export const getGlobalNavbarStyles = (colors, isDark) =>
  StyleSheet.create({
    header: {
      zIndex: 1000,
      backgroundColor: colors.bgElevated,
      shadowColor: isDark ? colors.accent : '#1E293B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.22 : 0.12,
      shadowRadius: 14,
      elevation: 10,
    },
    surface: { ...StyleSheet.absoluteFillObject },
    sealLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1.5 },
    sealGlow: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10 },
    row: {
      height: HEADER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
    },

    // ---- brand ----
    brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
    logoRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      padding: 2,
      shadowColor: colors.accent,
      shadowOpacity: 0.7,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    logoInner: {
      flex: 1,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.bgElevated,
      backgroundColor: colors.bgCard,
    },
    logo: { width: '100%', height: '100%' },
    wordmark: {
      color: colors.textPrimary,
      fontSize: 21,
      fontFamily: 'Yoruka',
      letterSpacing: 0.6,
      textShadowColor: isDark ? `rgba(${colors.accentRgb}, 0.55)` : 'transparent',
      textShadowRadius: 10,
      textShadowOffset: { width: 0, height: 0 },
    },
    eyebrow: {
      color: colors.accent,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 2.2,
      marginTop: -1,
    },

    // ---- actions ----
    actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },

    pill: {
      height: 38,
      borderRadius: 19,
      overflow: 'hidden',
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    pillFill: {
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      gap: 8,
    },
    pillGloss: { position: 'absolute', top: 1, left: 10, right: 10, height: 17, borderRadius: 19 },
    pillRim: { ...StyleSheet.absoluteFillObject, borderRadius: 19, borderWidth: 1 },
    pillText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      shadowOpacity: 1,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 0 },
    },

    // ---- wallet dropdown ----
    dropdown: {
      position: 'absolute',
      top: HEADER_HEIGHT - 4,
      right: 12,
      width: 240,
      borderRadius: 22,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.55 : 0.2,
      shadowRadius: 24,
      elevation: 16,
      zIndex: 1001,
    },
    dropdownHead: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    dropdownLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
    dropdownAddress: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 4 },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 46 },
    dropdownIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    dropdownText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    pressed: { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(' + colors.accentRgb + ',0.08)' },
  });

export default getGlobalNavbarStyles;
