// ./styles/NovelPageStyles.js
//
// Kaito Adventure design system — Novel detail/summary pages.
// Same public API as before: getNovelPageStyles(isDark) returns a
// StyleSheet. All class names referenced by NovelDetailScreen.js
// and NovelSummaryScreen.js are defined here.

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
    accentSoft: 'rgba(230,126,34,0.16)',
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

export const getNovelPageStyles = (isDark = true) => {
  const c = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    // -------------------------------------------------------------- shell
    page: {
      flex: 1,
      backgroundColor: c.bg,
    },
    contentContainer: {
      paddingBottom: SPACE.xxl,
      paddingHorizontal: SPACE.lg,
    },

    // ------------------------------------------------------------ loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.bg,
      gap: SPACE.md,
    },
    loadingText: {
      color: c.textSecondary,
      fontSize: 15,
      fontFamily: FONT,
      marginTop: SPACE.sm,
      letterSpacing: 0.8,
    },

    // -------------------------------------------------------------- error
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.bg,
      padding: SPACE.xxl,
    },
    errorText: {
      color: c.error,
      fontSize: 21,
      fontFamily: FONT,
      marginBottom: SPACE.xl,
      letterSpacing: 0.5,
      fontWeight: '600',
    },
    backHomeLink: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.accent,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xl,
      borderRadius: RADIUS.sm,
      ...cardShadow(c, isDark ? 0.35 : 0.18, 10, 5),
    },
    backHomeText: {
      color: c.textOnAccent,
      fontSize: 14,
      fontFamily: FONT,
      marginLeft: SPACE.sm,
      fontWeight: '600',
      letterSpacing: 0.4,
    },

    // ------------------------------------------------------------- navbar
    navbar: {
      backgroundColor: c.bgCard,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      ...softShadow(c),
    },
    navContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logoLink: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: c.accent,
    },
    logoText: {
      color: c.textPrimary,
      fontSize: 18,
      fontFamily: FONT,
      marginLeft: SPACE.sm,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    menuToggle: {
      padding: SPACE.sm,
    },

    // ----------------------------------------------------------- nav drawer
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.overlay,
      zIndex: 10,
    },
    navItems: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: width * 0.7,
      backgroundColor: c.bgCard,
      padding: SPACE.xl,
      zIndex: 20,
      borderLeftWidth: 1,
      borderLeftColor: c.border,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACE.md,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
      marginBottom: SPACE.sm,
    },
    navItemText: {
      color: c.textPrimary,
      fontSize: 15,
      fontFamily: FONT,
      marginLeft: SPACE.md,
      letterSpacing: 0.3,
    },
    connectBtn: {
      marginTop: SPACE.xl,
      alignSelf: 'center',
      width: '100%',
    },

    // ---------------------------------------------------------- novel header
    novelContainer: {
      paddingHorizontal: 0,
    },
    novelHeaderGradient: {
      borderRadius: RADIUS.lg,
      marginVertical: SPACE.lg,
      padding: SPACE.xl,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      ...cardShadow(c),
    },
    novelHeader: {
      alignItems: 'center',
    },
    novelTitle: {
      color: c.textPrimary,
      fontSize: 26,
      fontFamily: FONT,
      textAlign: 'center',
      marginBottom: SPACE.lg,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    novelImageWrapper: {
      position: 'relative',
      marginBottom: SPACE.lg,
      alignItems: 'center',
    },
    novelImage: {
      width: width * 0.5,
      height: width * 0.75,
      borderRadius: RADIUS.md,
      borderWidth: 2,
      borderColor: c.accent,
    },
    imageGlow: {
      position: 'absolute',
      top: -8,
      left: -8,
      right: -8,
      bottom: -8,
      backgroundColor: c.accentSoft,
      borderRadius: RADIUS.lg,
      zIndex: -1,
    },
    novelViews: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACE.lg,
      backgroundColor: c.bgElevated2,
      paddingVertical: SPACE.sm,
      paddingHorizontal: SPACE.lg,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: c.border,
    },
    novelViewsText: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FONT,
      marginLeft: SPACE.sm,
      letterSpacing: 0.2,
    },
    novelIntro: {
      color: c.textPrimary,
      fontSize: 15,
      fontFamily: FONT,
      textAlign: 'center',
      lineHeight: 22,
      letterSpacing: 0.2,
    },
    highlight: {
      color: c.accent,
      fontFamily: FONT,
      fontWeight: '600',
    },

    // ---------------------------------------------------------- sections
    chaptersSection: {
      marginBottom: SPACE.lg,
    },
    commentsSection: {
      marginVertical: SPACE.lg,
    },
    commentsToggle: {
      paddingVertical: SPACE.md,
      alignItems: 'center',
    },
    sectionTitle: {
      color: c.accent,
      fontSize: 20,
      fontFamily: FONT,
      marginBottom: SPACE.lg,
      fontWeight: '700',
      letterSpacing: 0.6,
    },

    // -------------------------------------------------------- summary link
    summaryLinkContainer: {
      padding: SPACE.lg,
      backgroundColor: c.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    summaryLink: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.accent,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.lg,
      borderRadius: RADIUS.sm,
      alignSelf: 'flex-start',
      ...cardShadow(c, isDark ? 0.35 : 0.18, 10, 5),
    },
    summaryLinkText: {
      color: c.textOnAccent,
      fontSize: 14,
      marginLeft: SPACE.sm,
      fontFamily: FONT,
      fontWeight: '600',
      letterSpacing: 0.4,
    },

    // -------------------------------------------------------- chapter cards
    chapterCard: {
      flex: 1,
      margin: SPACE.sm,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      ...softShadow(c),
    },
    chapterContent: {
      borderRadius: RADIUS.md,
      overflow: 'hidden',
    },
    chapterGradient: {
      padding: SPACE.lg,
      alignItems: 'center',
      backgroundColor: c.bgElevated,
    },
    chapterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: SPACE.sm,
    },
    chapterNumber: {
      color: c.textPrimary,
      fontSize: 15,
      fontFamily: FONT,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    chapterIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.sm,
    },
    chapterIcon: {
      marginLeft: SPACE.sm,
    },
    chapterTitle: {
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
      textAlign: 'center',
      letterSpacing: 0.2,
    },
    chapterAccent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: c.accent,
    },
    noChapters: {
      color: c.textMuted,
      fontSize: 15,
      fontFamily: FONT,
      textAlign: 'center',
      marginVertical: SPACE.xl,
      letterSpacing: 0.2,
    },

    // ----------------------------------------------------------- connect popup
    connectPopupOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.overlay,
    },
    connectPopup: {
      width: '90%',
      maxWidth: 400,
      padding: SPACE.xl,
      borderRadius: RADIUS.lg,
      alignItems: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      ...cardShadow(c, isDark ? 0.5 : 0.2, 20, 10),
    },
    closePopupButton: {
      position: 'absolute',
      top: SPACE.lg,
      right: SPACE.lg,
    },
    popupTitle: {
      color: c.textPrimary,
      fontSize: 20,
      fontFamily: FONT,
      marginBottom: SPACE.md,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    popupMessage: {
      color: c.textSecondary,
      fontSize: 14,
      fontFamily: FONT,
      textAlign: 'center',
      marginBottom: SPACE.xl,
      lineHeight: 20,
      letterSpacing: 0.2,
    },
    connectWalletButton: {
      marginBottom: SPACE.xl,
      width: '100%',
      alignItems: 'center',
    },

    // ------------------------------------------------------------ error banner
    errorMessage: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: c.errorSoft,
      borderWidth: 1,
      borderColor: c.error,
      padding: SPACE.md,
      borderRadius: RADIUS.sm,
      marginVertical: SPACE.sm,
      marginHorizontal: SPACE.lg,
    },
    errorMessageText: {
      color: c.error,
      fontSize: 13,
      fontFamily: FONT,
      flex: 1,
      letterSpacing: 0.2,
    },
    clearErrorButton: {
      padding: SPACE.xs,
    },

    // --------------------------------------------------------------- footer
    footer: {
      padding: SPACE.lg,
      alignItems: 'center',
      backgroundColor: c.bgCard,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    footerText: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: FONT,
      letterSpacing: 0.2,
    },

    // ----------------------------------------------------------- summary page
    summaryHeader: {
      backgroundColor: c.bgCard,
      paddingVertical: SPACE.lg,
      paddingHorizontal: SPACE.xl,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    summaryHeaderContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    summaryPageTitle: {
      color: c.accent,
      fontSize: 18,
      fontFamily: FONT,
      fontWeight: '700',
      letterSpacing: 0.6,
    },

    // ------------------------------------------------------------- search
    searchSection: {
      padding: SPACE.lg,
      backgroundColor: c.bg,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgInput,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchIcon: {
      marginRight: SPACE.sm,
    },
    searchInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
      letterSpacing: 0.2,
    },

    // ---------------------------------------------------------- summary grid
    summaryMain: {
      flex: 1,
      padding: SPACE.lg,
    },
    summaryNovelsGrid: {
      paddingBottom: SPACE.lg,
    },
    summaryNovelCard: {
      marginBottom: SPACE.lg,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      ...softShadow(c),
    },
    summaryCardGradient: {
      padding: SPACE.lg,
    },
    summaryCardContent: {
      gap: SPACE.sm,
    },
    summaryNovelTitle: {
      color: c.accent,
      fontSize: 16,
      fontFamily: FONT,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    summaryPreview: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FONT,
      lineHeight: 18,
      letterSpacing: 0.2,
    },
    readMore: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACE.sm,
    },
    readMoreText: {
      color: c.accent,
      fontSize: 12,
      marginRight: SPACE.xs,
      fontFamily: FONT,
      fontWeight: '600',
      letterSpacing: 0.3,
    },

    // ----------------------------------------------------------- no results
    noResults: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: SPACE.xxl * 2,
    },
    noResultsIcon: {
      marginBottom: SPACE.lg,
    },
    noResultsTitle: {
      color: c.accent,
      fontSize: 18,
      fontFamily: FONT,
      marginBottom: SPACE.sm,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    noResultsText: {
      color: c.textMuted,
      fontSize: 13,
      fontFamily: FONT,
      letterSpacing: 0.2,
    },

    // ---------------------------------------------------- single summary
    singleSummaryContainer: {
      padding: SPACE.xl,
      backgroundColor: c.bgCard,
      borderRadius: RADIUS.md,
      margin: SPACE.lg,
      borderWidth: 1,
      borderColor: c.border,
      ...softShadow(c),
    },
    singleSummaryTitle: {
      color: c.accent,
      fontSize: 20,
      fontFamily: FONT,
      marginBottom: SPACE.lg,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    singleSummaryText: {
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
      lineHeight: 22,
      letterSpacing: 0.2,
    },
  });
};

// Keep original export for any callers using the default (dark) theme.
export const styles = getNovelPageStyles(true);
