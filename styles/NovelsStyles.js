// ./styles/NovelsStyles.js
//
// Kaito Adventure design system — Novel library/grid page.
// Same public API as before: getNovelsStyles(isDark) returns a
// StyleSheet. All class names referenced by NovelsPageScreen.js
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

    accent: '#c65200',
    accentBright: '#e0662a',
    accentSoft: 'rgba(198,82,0,0.10)',
    accentDim: '#a85f2b',

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

export const getNovelsStyles = (isDark = true) => {
  const c = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    // -------------------------------------------------------------- shell
    libraryContainer: {
      flex: 1,
      backgroundColor: c.bg,
      paddingBottom: 0,
    },
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
    scrollContent: {
      paddingBottom: 240,
    },

    // ------------------------------------------------------------- navbar
    libraryNavbar: {
      position: 'absolute',
      top: 0,
      width: '100%',
      backgroundColor: c.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      padding: SPACE.lg,
      zIndex: 1000,
      ...softShadow(c),
    },
    navbarContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      maxWidth: 1200,
      marginHorizontal: 'auto',
    },
    libraryLogo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
      borderWidth: 2,
      borderColor: c.accent,
    },
    logoText: {
      marginLeft: SPACE.md,
      fontSize: 16,
      fontFamily: FONT,
      color: c.accent,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    menuButton: {
      padding: SPACE.sm,
      zIndex: 1002,
    },

    // ----------------------------------------------------------- nav drawer
    navItems: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 280,
      backgroundColor: c.bgCard,
      padding: SPACE.xl,
      zIndex: 1001,
      borderLeftWidth: 1,
      borderLeftColor: c.border,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: c.overlay,
      zIndex: 1000,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACE.md,
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
      backgroundColor: c.accent,
      padding: SPACE.md,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
    },

    // ---------------------------------------------------------- hero section
    heroSection: {
      padding: SPACE.xl,
      backgroundColor: c.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    heroContent: {
      maxWidth: 1200,
      width: '100%',
      alignSelf: 'center',
    },
    heroTitle: {
      color: c.gold,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: SPACE.sm,
      textTransform: 'uppercase',
    },
    heroSubtitle: {
      color: c.textSecondary,
      fontSize: 14,
      letterSpacing: 1,
      marginBottom: SPACE.lg,
    },

    // ------------------------------------------------------------- search
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.md,
      marginBottom: SPACE.lg,
    },
    searchIcon: {
      marginRight: SPACE.sm,
    },
    searchInput: {
      flex: 1,
      color: c.textPrimary,
      fontSize: 14,
      letterSpacing: 0.5,
    },
    clearButton: {
      padding: SPACE.xs,
    },

    // ---------------------------------------------------------- tag filters
    tagFiltersContainer: {
      marginBottom: SPACE.sm,
    },
    tagFiltersLabel: {
      color: c.textSecondary,
      fontSize: 13,
      marginBottom: SPACE.md,
      letterSpacing: 1,
    },
    tagFiltersScroll: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACE.sm,
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.sm,
      marginRight: SPACE.sm,
      marginBottom: SPACE.sm,
    },
    tagChipActive: {
      backgroundColor: c.accent,
      borderColor: c.accent,
    },
    tagChipText: {
      color: c.textSecondary,
      fontSize: 12,
      letterSpacing: 0.5,
    },
    tagChipTextActive: {
      color: c.textOnAccent,
      fontWeight: '600',
    },
    clearTagsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.error,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.sm,
      borderRadius: RADIUS.pill,
      marginRight: SPACE.sm,
      marginBottom: SPACE.sm,
    },
    clearTagsText: {
      color: c.textOnAccent,
      fontSize: 12,
      marginLeft: SPACE.xs,
    },

    // ---------------------------------------------------------- results header
    resultsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACE.xl,
      paddingVertical: SPACE.lg,
      backgroundColor: c.bg,
    },
    resultsCount: {
      color: c.textSecondary,
      fontSize: 13,
      letterSpacing: 1,
    },
    resultsCountHighlight: {
      color: c.gold,
      fontWeight: '700',
    },

    // ----------------------------------------------------------- book grid
    gridContainer: {
      paddingHorizontal: SPACE.lg,
      paddingTop: SPACE.lg,
    },
    gridContent: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    novelCard: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      marginBottom: SPACE.lg,
      overflow: 'hidden',
      ...cardShadow(c),
    },
    novelCardTouchable: {
      width: '100%',
    },
    novelCoverContainer: {
      position: 'relative',
      width: '100%',
      aspectRatio: 2 / 3,
      backgroundColor: c.bgElevated,
    },
    novelCover: {
      width: '100%',
      height: '100%',
    },
    novelCoverPlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
    },
    novelCoverPlaceholderText: {
      color: c.textMuted,
      fontSize: 13,
      letterSpacing: 1,
    },
    adultBadge: {
      position: 'absolute',
      top: SPACE.sm,
      right: SPACE.sm,
      backgroundColor: c.error,
      paddingHorizontal: SPACE.sm,
      paddingVertical: SPACE.xs,
      borderRadius: RADIUS.xs,
    },
    adultBadgeText: {
      color: c.textOnAccent,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    novelInfo: {
      padding: SPACE.lg,
      minHeight: 100,
    },
    novelTitle: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: SPACE.sm,
      letterSpacing: 0.5,
      lineHeight: 20,
      height: 40,
    },
    novelMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 'auto',
      paddingTop: SPACE.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    novelAuthor: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    novelAuthorIcon: {
      marginRight: SPACE.xs,
    },
    novelAuthorText: {
      color: c.textSecondary,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    novelViewers: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    novelViewersIcon: {
      marginRight: SPACE.xs,
    },
    novelViewersText: {
      color: c.textSecondary,
      fontSize: 11,
      letterSpacing: 0.5,
    },

    // ------------------------------------------------------------ loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.bg,
      minHeight: 400,
    },
    loadingText: {
      color: c.textPrimary,
      fontSize: 14,
      marginTop: SPACE.md,
      letterSpacing: 1,
    },

    // ---------------------------------------------------------- skeleton
    skeletonContainer: {
      paddingHorizontal: SPACE.lg,
      paddingTop: SPACE.lg,
    },
    skeletonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    skeletonCard: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      marginBottom: SPACE.lg,
      overflow: 'hidden',
    },
    skeletonCover: {
      width: '100%',
      aspectRatio: 2 / 3,
      backgroundColor: c.bgElevated,
    },
    skeletonInfo: {
      padding: SPACE.lg,
    },
    skeletonTitle: {
      height: 18,
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.xs,
      marginBottom: SPACE.sm,
    },
    skeletonMeta: {
      height: 12,
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.xs,
      width: '60%',
    },

    // ----------------------------------------------------------- empty state
    emptyContainer: {
      padding: SPACE.xxl * 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyIcon: {
      marginBottom: SPACE.lg,
    },
    emptyTitle: {
      color: c.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: SPACE.md,
      letterSpacing: 1,
    },
    emptyText: {
      color: c.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
      letterSpacing: 0.5,
      maxWidth: 400,
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.accent,
      paddingHorizontal: SPACE.xl,
      paddingVertical: SPACE.md,
      borderRadius: RADIUS.sm,
      marginTop: SPACE.lg,
    },
    emptyButtonText: {
      color: c.textOnAccent,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: SPACE.xs,
      letterSpacing: 1,
    },

    // --------------------------------------------------------------- footer
    footer: {
      padding: SPACE.xl,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bgCard,
    },
    footerText: {
      color: c.textMuted,
      fontSize: 11,
      letterSpacing: 1,
    },
  });
};

// Keep original export for any callers using the default (dark) theme.
export const styles = getNovelsStyles(true);
