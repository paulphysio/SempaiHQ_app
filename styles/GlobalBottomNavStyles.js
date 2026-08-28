// ./styles/GlobalBottomNavStyles.js
//
// Kaito Adventure design system — Global bottom navigation.
// Theme-aware styles with orange-to-blue conversion in light mode.
// Matches the pattern from HomeStyles and FeedStyles.

import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Design tokens
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
  },
};

const RADIUS = { xs: 8, sm: 12, md: 16, lg: 20 };
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16 };
const FONT = Platform.select({ ios: 'Yoruka', android: 'Yoruka', default: 'Yoruka' });

// ---------------------------------------------------------------------------

export const getGlobalBottomNavStyles = (isDark = true) => {
  const c = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    bottomNavbar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: c.bg,
      borderTopWidth: 1,
      borderTopColor: c.borderAccent,
      paddingVertical: SPACE.sm,
      paddingBottom: 12,
      zIndex: 1000,
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: isDark ? 0.2 : 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    gradientOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    glowEffect: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.accentGlow,
      pointerEvents: 'none',
    },
    navContent: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      width: '100%',
      zIndex: 1,
    },
    bottomNavButton: {
      padding: SPACE.sm,
      borderRadius: RADIUS.xs,
    },
    buttonGradient: {
      padding: SPACE.sm,
      borderRadius: RADIUS.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationWrapper: {
      position: 'relative',
    },
    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: c.accent,
      borderRadius: RADIUS.xs,
      minWidth: 14,
      height: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: c.bg,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
    },
    badgeText: {
      color: c.textPrimary,
      fontSize: 9,
      fontFamily: FONT,
    },
    announcementToggleWrapper: {
      position: 'relative',
    },
    announcementBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: c.accentDeep,
      borderRadius: RADIUS.xs,
      minWidth: 14,
      height: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: c.bg,
      shadowColor: c.accentDeep,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: c.bgModal,
      borderRadius: RADIUS.lg,
      width: '90%',
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: c.borderAccent,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACE.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.borderAccent,
    },
    modalTitle: {
      color: c.textPrimary,
      fontSize: 20,
      fontFamily: FONT,
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
      borderRadius: RADIUS.xs,
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
