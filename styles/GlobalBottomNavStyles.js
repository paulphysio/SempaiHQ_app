// ./styles/GlobalBottomNavStyles.js
//
// Kaito Adventure design system — Global bottom navigation.
// Floating glass pill. Theme-aware, orange (dark) / blue (light).

import { StyleSheet, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Design tokens (palette unchanged, glass tokens added)
// ---------------------------------------------------------------------------
const PALETTE = {
  dark: {
    bg: '#111218',
    bgElevated: '#1a1a2e',
    bgModal: '#1a1a2e',

    accent: '#FF5733',
    accentDeep: '#F36316',
    accentBright: '#FF6B35',
    accentSoft: 'rgba(255, 87, 51, 0.12)',
    accentGlow: 'rgba(255, 87, 51, 0.02)',

    textPrimary: '#FFFFFF',
    textSecondary: '#CCCCCC',
    textMuted: '#888888',

    border: 'rgba(255, 255, 255, 0.1)',
    borderAccent: 'rgba(243, 99, 22, 0.3)',

    overlay: 'rgba(0, 0, 0, 0.7)',
    shadow: '#000000',

    // glass
    glassTint: 'rgba(17, 18, 24, 0.50)',
    glassSheen: 'rgba(255, 255, 255, 0.14)',
    glassRim: 'rgba(255, 255, 255, 0.16)',
    glassSpecular: 'rgba(255, 255, 255, 0.55)',
    gloss: 'rgba(255, 255, 255, 0.38)',
  },
  light: {
    bg: '#ffffff',
    bgElevated: '#f8f8e8',
    bgModal: '#ffffff',

    accent: '#3b82f6',
    accentDeep: '#2563eb',
    accentBright: '#60a5fa',
    accentSoft: 'rgba(59, 130, 246, 0.12)',
    accentGlow: 'rgba(59, 130, 246, 0.02)',

    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#64748b',

    border: 'rgba(59, 130, 246, 0.15)',
    borderAccent: 'rgba(59, 130, 246, 0.3)',

    overlay: 'rgba(38, 30, 18, 0.55)',
    shadow: 'rgba(0, 0, 0, 0.1)',

    // glass
    glassTint: 'rgba(255, 255, 255, 0.55)',
    glassSheen: 'rgba(255, 255, 255, 0.60)',
    glassRim: 'rgba(255, 255, 255, 0.85)',
    glassSpecular: 'rgba(255, 255, 255, 1)',
    gloss: 'rgba(255, 255, 255, 0.55)',
  },
};

const RADIUS = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28 };
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16 };
const FONT = Platform.select({ ios: 'Yoruka', android: 'Yoruka', default: 'Yoruka' });

// Layout constants (exported so the component can size things consistently)
export const NAV = {
  height: 68,
  radius: 34,
  buttonSize: 48,
  sideMargin: 20,
  bottomGap: 12,
};

// ---------------------------------------------------------------------------

export const getGlobalBottomNavStyles = (isDark = true) => {
  const c = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    // Full-width, non-blocking layer that positions the floating bar
    navWrapper: {
      position: 'absolute',
      left: NAV.sideMargin,
      right: NAV.sideMargin,
      zIndex: 1000,
    },

    // Carries the shadow (can't live on the clipped glass view on iOS)
    navShadow: {
      borderRadius: NAV.radius,
      shadowColor: isDark ? c.accent : '#1e293b',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.22 : 0.18,
      shadowRadius: 22,
      elevation: 14,
      backgroundColor: Platform.OS === 'android' ? c.bg : 'transparent',
    },

    // The clipped glass pill
    navGlass: {
      height: NAV.height,
      borderRadius: NAV.radius,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    glassTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.glassTint,
    },
    glassSheen: {
      ...StyleSheet.absoluteFillObject,
    },
    glassRim: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: NAV.radius,
      borderWidth: 1,
      borderColor: c.glassRim,
    },
    glassSpecular: {
      position: 'absolute',
      top: 0,
      left: NAV.radius,
      right: NAV.radius,
      height: 1.5,
    },
    accentWash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.accentGlow,
    },

    navContent: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: SPACE.md,
    },

    // Buttons
    buttonWrap: {
      width: NAV.buttonSize + 8,
      height: NAV.buttonSize + 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonGlow: {
      position: 'absolute',
      width: NAV.buttonSize - 6,
      height: NAV.buttonSize - 6,
      borderRadius: (NAV.buttonSize - 6) / 2,
      backgroundColor: c.accent,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 14,
    },
    button: {
      width: NAV.buttonSize,
      height: NAV.buttonSize,
      borderRadius: NAV.buttonSize / 2,
      overflow: 'hidden',
    },
    buttonFill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: NAV.buttonSize / 2,
    },
    buttonRim: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: NAV.buttonSize / 2,
      borderWidth: 1,
    },
    buttonGloss: {
      position: 'absolute',
      top: 2,
      left: 8,
      right: 8,
      height: '46%',
      borderRadius: NAV.buttonSize / 2,
    },

    // Badge
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: c.accent,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? c.bg : '#ffffff',
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 5,
    },
    badgeText: {
      color: '#ffffff',
      fontSize: 9,
      fontFamily: FONT,
    },

    // Notifications modal
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: c.bgModal,
      borderRadius: RADIUS.xl,
      width: '90%',
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: c.borderAccent,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACE.lg,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: {
      color: c.textPrimary,
      fontSize: 20,
      fontFamily: FONT,
    },
    modalClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accentSoft,
    },
    modalBody: {
      padding: SPACE.lg,
    },
    modalText: {
      color: c.textSecondary,
      fontSize: 16,
      lineHeight: 24,
      fontFamily: FONT,
    },
    notificationItem: {
      backgroundColor: c.accentSoft,
      borderRadius: RADIUS.md,
      padding: SPACE.md,
      marginBottom: SPACE.md,
      borderWidth: 1,
      borderColor: c.borderAccent,
    },
    notificationType: {
      color: c.accent,
      fontSize: 12,
      marginBottom: SPACE.xs,
      fontFamily: FONT,
    },
    announcementTitle: {
      color: c.accent,
      fontSize: 14,
      marginBottom: SPACE.xs,
      fontFamily: FONT,
    },
    notificationMessage: {
      color: c.textPrimary,
      fontSize: 14,
      marginBottom: SPACE.xs,
      fontFamily: FONT,
    },
    notificationDate: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: FONT,
    },
  });
};

// Keep original export for backward compatibility (dark mode default)
export const styles = getGlobalBottomNavStyles(true);

export default styles;