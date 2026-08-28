import { StyleSheet } from 'react-native';

/**
 * Theme-aware styles for GlobalNavbar.
 *
 * Mirrors the token pairs used by the web Navbar.module.css
 * ("Panel Gutter" navbar), so mobile light mode reads as the same
 * cream / electric-blue "Paper & Current" theme instead of a re-tinted
 * dark shell.
 *
 * Usage:
 *   const { colors, isDark } = useTheme();
 *   const styles = getGlobalNavbarStyles(colors, isDark);
 */
export const getGlobalNavbarStyles = (colors, isDark) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: colors.bgElevated,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderAccent,
      zIndex: 1000,
      position: 'relative',
      shadowColor: isDark ? '#000' : 'rgba(30,41,59,0.25)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.12,
      shadowRadius: 8,
      elevation: 8,
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
      backgroundColor: colors.accentSoft,
      pointerEvents: 'none',
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      zIndex: 1,
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    brandLogo: {
      width: 28,
      height: 28,
      borderRadius: 6,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
    },
    brandText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: 'bold',
      letterSpacing: 0.5,
      fontFamily: 'Yoruka',
      textShadowColor: colors.accentSoft,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    themeToggleBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerAuthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto',
    },
    headerSignInBtn: {
      overflow: 'hidden',
      borderRadius: 16,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 4,
    },
    signInGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      gap: 4,
    },
    headerSignInIcon: {
      width: 14,
      height: 14,
      borderRadius: 2,
      backgroundColor: '#fff',
    },
    headerSignInText: {
      color: '#FFFFFF',
      fontSize: 11,
      letterSpacing: 0.2,
      fontFamily: 'Yoruka',
    },
    headerWalletBtn: {
      overflow: 'hidden',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderAccent,
    },
    walletGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      gap: 4,
    },
    headerWalletText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontFamily: 'Yoruka',
    },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.borderAccent,
    },
    signOutText: {
      color: colors.accent,
      fontSize: 11,
      fontFamily: 'Yoruka',
    },
    walletDropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 6,
      backgroundColor: colors.bgElevated,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: isDark ? '#000' : 'rgba(30,41,59,0.3)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.5 : 0.18,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 1001,
      minWidth: 130,
    },
    walletDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    walletDropdownText: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: 'Yoruka',
    },
  });

export default getGlobalNavbarStyles;