// ./styles/GlobalSidebarStyles.js
//
// Kaito Adventure design system — Global sidebar navigation.
// Theme-aware styles with orange-to-blue conversion in light mode.
// Matches the pattern from HomeStyles, FeedStyles, and GlobalBottomNavStyles.

import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const PALETTE = {
  dark: {
    bgElevated: '#1a1a2e',
    
    accent: '#ff6200',
    accentDeep: '#e55a00',
    accentSoft: 'rgba(255, 98, 0, 0.12)',
    
    connected: '#4CAF50',
    
    border: 'rgba(255, 255, 255, 0.1)',
    
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
  },
  light: {
    bgElevated: '#ffffff',
    
    accent: '#3b82f6',
    accentDeep: '#2563eb',
    accentSoft: 'rgba(59, 130, 246, 0.12)',
    
    connected: '#22c55e',
    
    border: 'rgba(59, 130, 246, 0.15)',
    
    overlay: 'rgba(30, 41, 59, 0.35)',
    shadow: 'rgba(30, 41, 59, 0.3)',
  },
};

const RADIUS = { xs: 8, sm: 10, md: 12, lg: 16 };
const SPACE = { xs: 4, sm: 8, md: 10, lg: 12, xl: 14 };
const FONT = Platform.select({ ios: 'Yoruka', android: 'Yoruka', default: 'Yoruka' });

// ---------------------------------------------------------------------------

export const getGlobalSidebarStyles = (isDark = true) => {
  const c = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
      zIndex: 900,
    },
    sidebar: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: Math.min(300, width * 0.86),
      height: '100%',
      backgroundColor: c.bgElevated,
      borderLeftWidth: 1,
      borderLeftColor: c.border,
      shadowColor: c.shadow,
      shadowOffset: { width: -4, height: 0 },
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 20,
      elevation: 12,
      zIndex: 1000,
    },
    sidebarContent: {
      flex: 1,
      paddingHorizontal: SPACE.lg,
      paddingBottom: SPACE.lg,
    },
    sidebarHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.md,
      paddingTop: SPACE.xl,
      paddingBottom: SPACE.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    sidebarLogo: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.md,
    },
    sidebarTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
      color: isDark ? '#FFFFFF' : '#1e293b',
      fontFamily: FONT,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navLinksContainer: {
      paddingTop: SPACE.lg,
      paddingBottom: SPACE.xl,
    },
    navGroup: {
      marginBottom: SPACE.sm,
    },
    navGroupButton: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.md,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.lg,
      borderRadius: RADIUS.md,
    },
    walletButtonConnected: {
      borderColor: c.accent,
    },
    walletConnectedText: {
      color: c.accent,
    },
    navIcon: {
      marginRight: 2,
    },
    navGroupText: {
      flex: 1,
      textAlign: 'left',
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1e293b',
      fontFamily: FONT,
    },
    dropdownIcon: {
      marginLeft: SPACE.sm,
    },
    dropdown: {
      marginTop: SPACE.sm,
      paddingLeft: SPACE.lg,
      gap: SPACE.xs,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.md,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.lg,
      borderRadius: RADIUS.xs,
    },
    dropdownItemText: {
      flex: 1,
      fontSize: 13,
      color: isDark ? '#CCCCCC' : '#475569',
      fontFamily: FONT,
    },
  });
};

export const SIDEBAR_ACCENT = (isDark) => isDark ? '#ff6200' : '#3b82f6';
export const SIDEBAR_ACCENT_DARK = (isDark) => isDark ? '#e55a00' : '#2563eb';
export const SIDEBAR_CONNECTED = (isDark) => isDark ? '#4CAF50' : '#22c55e';

export default getGlobalSidebarStyles;