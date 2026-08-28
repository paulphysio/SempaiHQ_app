// ./styles/ProfileStyles.js
//
// Kaito Adventure design system — Creator profile page.
// Same public API as before: getProfileStyles(isDark) returns a
// StyleSheet. All class names referenced by ProfileScreen.js
// are defined here.

import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
// Both palettes share the same warm "ink & ember" identity (deep orange +
// aged gold) so the brand reads identically in either mode — dark leans into
// lantern-lit paper, light leans into sun-bleached parchment.

const PALETTE = {
  dark: {
    bg: '#0c0c0c',
    bgCard: '#141210',
    bgElevated: '#1a1714',
    bgElevated2: '#211c15',
    bgInput: '#181410',

    accent: '#cc5500',
    accentBright: '#ff6b35',
    accentSoft: "rgba(230,126,34,0.16)",
    accentDim: '#8b4513',

    gold: '#c9a84c',
    goldBright: '#ffd700',
    goldSoft: 'rgba(201,168,76,0.16)',

    textPrimary: '#f5e6d3',
    textSecondary: '#a8987f',
    textMuted: '#6b5d4f',
    textOnAccent: '#fff8ef',
    textOnGold: '#1b1710',

    border: '#2c2419',
    borderStrong: '#3d3221',
    divider: '#221c14',

    success: '#5fa876',
    successSoft: 'rgba(95,168,118,0.14)',
    error: '#e2495f',
    errorSoft: 'rgba(226,73,95,0.14)',
    warning: '#c9a84c',
    warningSoft: 'rgba(201,168,76,0.14)',

    overlay: 'rgba(5,4,2,0.88)',
    shadow: '#000000',
    skeleton: '#211c15',
  },
  light: {
    bg: '#faf5ea',
    bgCard: '#ffffff',
    bgElevated: '#f2e9d8',
    bgElevated2: '#ece0c6',
    bgInput: '#ffffff',

    accent: '#3b82f6',
    accentBright: '#60a5fa',
    accentSoft: 'rgba(59, 130, 246, 0.12)',
    accentDim: '#2563eb',

    gold: '#96762f',
    goldBright: '#b28f3a',
    goldSoft: 'rgba(150,118,47,0.12)',

    textPrimary: '#2a2216',
    textSecondary: '#6d5f49',
    textMuted: '#a2937a',
    textOnAccent: '#fffaf3',
    textOnGold: '#fffaf3',

    border: '#e7d9bd',
    borderStrong: '#d6c39c',
    divider: '#efe3cc',

    success: '#3c7a52',
    successSoft: 'rgba(60,122,82,0.10)',
    error: '#c13a52',
    errorSoft: 'rgba(193,58,82,0.10)',
    warning: '#96762f',
    warningSoft: 'rgba(150,118,47,0.10)',

    overlay: 'rgba(38,30,18,0.55)',
    shadow: '#2a2216',
    skeleton: '#f2e9d8',
  },
};

const RADIUS = { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 999 };
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
const FONT = Platform.select({ ios: 'Yoruka', android: 'Yoruka', default: 'Yoruka' });

const cardShadow = (c, opacity = 0.16, radius = 12, elevation = 5) => ({
  shadowColor: c.shadow,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

const softShadow = (c) => cardShadow(c, 0.1, 6, 2);

// ---------------------------------------------------------------------------

export const getProfileStyles = (isDark = true) => {
  const c = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    // -------------------------------------------------------------- shell
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    backgroundGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.bg,
    },
    emberContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
    },
    ember: {
      position: 'absolute',
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.accent,
      shadowColor: c.accentBright,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: SPACE.lg,
      paddingBottom: 100,
    },

    // ------------------------------------------------------------ loading
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 400,
    },
    loadingText: {
      color: c.textPrimary,
      marginTop: SPACE.md,
      fontSize: 14,
      letterSpacing: 2,
    },

    // ----------------------------------------------------------- connect prompt
    connectPrompt: {
      alignItems: 'center',
      padding: SPACE.xxl,
    },
    promptIcon: {
      marginBottom: SPACE.lg,
    },
    promptText: {
      color: c.textSecondary,
      fontSize: 14,
      textAlign: 'center',
      letterSpacing: 1,
      lineHeight: 22,
    },

    // -------------------------------------------------------------- error
    errorContainer: {
      alignItems: 'center',
      padding: SPACE.xxl,
    },
    errorText: {
      color: c.error,
      fontSize: 14,
      textAlign: 'center',
      letterSpacing: 1,
    },

    // -------------------------------------------------------------- content
    content: {
      gap: SPACE.xl,
    },
    title: {
      color: c.textPrimary,
      fontSize: 28,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: 3,
      textShadowColor: c.accent,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
      marginBottom: SPACE.sm,
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },

    // --------------------------------------------------------------- card
    card: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      padding: SPACE.xl,
      position: 'relative',
      overflow: 'hidden',
      ...cardShadow(c),
    },
    cardTopBorder: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: c.accent,
    },
    cardCorner: {
      position: 'absolute',
      width: 12,
      height: 12,
      borderColor: c.accentDim,
      borderStyle: 'solid',
      opacity: 0.5,
    },
    cardCornerTL: { top: SPACE.sm, left: SPACE.sm, borderWidth: 2, borderBottomWidth: 0, borderRightWidth: 0 },
    cardCornerTR: { top: SPACE.sm, right: SPACE.sm, borderWidth: 2, borderBottomWidth: 0, borderLeftWidth: 0 },
    cardCornerBL: { bottom: SPACE.sm, left: SPACE.sm, borderWidth: 2, borderTopWidth: 0, borderRightWidth: 0 },
    cardCornerBR: { bottom: SPACE.sm, right: SPACE.sm, borderWidth: 2, borderTopWidth: 0, borderLeftWidth: 0 },

    // ---------------------------------------------------------- profile header
    profileHeader: {
      alignItems: 'center',
      marginBottom: SPACE.lg,
    },
    avatarFrame: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 3,
      borderColor: c.accentDim,
      marginBottom: SPACE.lg,
      shadowColor: c.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
    profileImage: {
      width: '100%',
      height: '100%',
      borderRadius: 37,
    },
    profileName: {
      color: c.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: 2,
      textShadowColor: c.accent,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    benefactorBadge: {
      width: 28,
      height: 28,
      marginLeft: SPACE.sm,
    },
    bio: {
      color: c.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
      fontStyle: 'italic',
      marginBottom: SPACE.lg,
    },

    // -------------------------------------------------------------- divider
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: SPACE.lg,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
    },
    dividerText: {
      color: c.textMuted,
      fontSize: 11,
      marginHorizontal: SPACE.md,
      letterSpacing: 3,
      textTransform: 'uppercase',
    },

    // ------------------------------------------------------------- socials
    socials: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACE.md,
      marginBottom: SPACE.lg,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.xs,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.sm,
    },
    socialText: {
      color: c.textPrimary,
      fontSize: 12,
      marginLeft: SPACE.sm,
      letterSpacing: 1,
    },

    // ----------------------------------------------------------- wallet info
    walletInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.xs,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.md,
    },
    walletText: {
      color: c.gold,
      fontSize: 12,
      marginLeft: SPACE.sm,
      letterSpacing: 1,
    },

    // ---------------------------------------------------------- section title
    sectionTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 2,
      marginBottom: SPACE.lg,
      textShadowColor: c.accent,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },

    // ----------------------------------------------------------- novel grid
    novelGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACE.md,
    },
    novelCard: {
      width: (width - 52) / 2,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.xs,
      overflow: 'hidden',
      ...softShadow(c),
    },
    novelImage: {
      width: '100%',
      height: 160,
      resizeMode: 'cover',
    },
    novelContent: {
      padding: SPACE.md,
    },
    novelTitle: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: SPACE.xs,
    },
    novelSummary: {
      color: c.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },
    placeholder: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: 'center',
      fontStyle: 'italic',
      letterSpacing: 1,
    },

    // ------------------------------------------------------------- actions
    actions: {
      flexDirection: 'row',
      gap: SPACE.md,
    },
    actionButton: {
      flex: 1,
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.accentBright,
      borderRadius: RADIUS.xs,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      ...cardShadow(c, 0.5, 8, 6),
    },
    actionButtonText: {
      color: c.textOnAccent,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 1,
      marginLeft: SPACE.xs,
    },

    // ----------------------------------------------------------- badge modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: c.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACE.xl,
      width: width * 0.85,
      maxWidth: 400,
      borderWidth: 1,
      borderColor: c.border,
      ...cardShadow(c),
    },
    closeButton: {
      position: 'absolute',
      top: SPACE.md,
      right: SPACE.md,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    modalTitle: {
      color: c.textPrimary,
      fontSize: 20,
      fontWeight: '800',
      fontFamily: FONT,
      marginBottom: SPACE.md,
      marginTop: SPACE.xs,
      letterSpacing: 1,
    },
    modalMessage: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: FONT,
      marginBottom: SPACE.lg,
      lineHeight: 20,
    },
    badgeOptions: {
      maxHeight: 200,
      marginBottom: SPACE.lg,
    },
    badgeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACE.md,
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.xs,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: SPACE.sm,
    },
    badgeOptionSelected: {
      borderColor: c.accent,
      backgroundColor: c.accentSoft,
    },
    badgeOptionImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginRight: SPACE.md,
    },
    badgeOptionInfo: {
      flex: 1,
    },
    badgeOptionName: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      fontFamily: FONT,
    },
    badgeOptionDescription: {
      color: c.textSecondary,
      fontSize: 12,
      fontFamily: FONT,
      marginTop: 2,
    },
    badgeOptionPrice: {
      color: c.accent,
      fontSize: 14,
      fontWeight: '700',
      fontFamily: FONT,
      marginTop: 4,
    },
    currencySelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: SPACE.lg,
    },
    currencyOption: {
      flex: 1,
      marginHorizontal: SPACE.xs,
      paddingVertical: SPACE.md,
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.xs,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    currencyOptionSelected: {
      borderColor: c.accent,
      backgroundColor: c.accentSoft,
    },
    currencyOptionText: {
      color: c.textMuted,
      fontSize: 14,
      fontFamily: FONT,
    },
    currencyOptionTextSelected: {
      color: c.textPrimary,
      fontWeight: '700',
    },
    noBadgesContainer: {
      alignItems: 'center',
      paddingVertical: SPACE.xl,
    },
    noBadgesText: {
      color: c.textMuted,
      fontSize: 14,
      fontFamily: FONT,
      marginTop: SPACE.md,
      marginBottom: SPACE.lg,
      textAlign: 'center',
    },
    modalButton: {
      paddingHorizontal: SPACE.xl,
      paddingVertical: SPACE.md,
      borderRadius: RADIUS.xs,
      alignItems: 'center',
    },
    modalButtonText: {
      color: c.textOnAccent,
      fontSize: 16,
      fontWeight: '800',
      fontFamily: FONT,
      letterSpacing: 1,
    },
  });
};

// Keep original export for any callers using the default (dark) theme.
export const styles = getProfileStyles(true);
