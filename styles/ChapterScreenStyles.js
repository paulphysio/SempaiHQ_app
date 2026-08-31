// ./styles/ChapterScreenStyles.js
//
// Kaito Adventure design system — Chapter reading screen.
// Same public API as before: getChapterScreenStyles(isDark) returns a
// StyleSheet. No component logic changes required — every class name
// referenced by ChapterScreen.js is defined here (several were previously
// missing, which is why parts of the screen looked unstyled).

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

export const getChapterScreenStyles = (isDark = true) => {
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
    },
    ember: {
      position: 'absolute',
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.accentBright,
      shadowColor: c.accentBright,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: isDark ? 0.9 : 0.35,
      shadowRadius: 6,
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
    errorTitle: {
      color: c.textPrimary,
      fontSize: 21,
      fontFamily: FONT,
      textAlign: 'center',
      marginBottom: SPACE.xl,
      letterSpacing: 0.5,
      lineHeight: 28,
    },
    input: {
      backgroundColor: c.bgInput,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 14,
      color: c.textPrimary,
      fontSize: 15,
      fontFamily: FONT,
      width: '100%',
      maxWidth: 420,
      marginBottom: SPACE.md,
      letterSpacing: 0.3,
    },

    // ------------------------------------------------------------ buttons
    actionButton: {
      backgroundColor: c.accent,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.xl,
      paddingVertical: 15,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACE.sm,
      width: '100%',
      maxWidth: 420,
      marginBottom: SPACE.md,
      ...cardShadow(c, isDark ? 0.35 : 0.18, 10, 5),
    },
    actionButtonText: {
      color: c.textOnAccent,
      fontSize: 14,
      fontFamily: FONT,
      letterSpacing: 0.6,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.xl,
      paddingVertical: 15,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACE.sm,
      width: '100%',
      maxWidth: 420,
    },
    secondaryButtonText: {
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
      letterSpacing: 0.5,
    },
    buttonIcon: {
      marginRight: 2,
    },
    badgesButton: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.gold,
      marginTop: SPACE.sm,
    },
    badgesButtonText: {
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
      letterSpacing: 0.6,
      fontWeight: '600',
    },

    // ------------------------------------------------------------- header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACE.lg,
      paddingTop: Platform.OS === 'ios' ? 8 : 14,
      paddingBottom: SPACE.md,
      backgroundColor: c.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: RADIUS.pill,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: c.textPrimary,
      fontSize: 16,
      fontFamily: FONT,
      letterSpacing: 0.6,
      flex: 1,
      textAlign: 'center',
      fontWeight: '600',
      marginHorizontal: SPACE.sm,
    },

    // ---------------------------------------------------------- balances
    balanceContainer: {
      flexDirection: 'column',
      alignItems: 'center',
      paddingVertical: SPACE.sm,
      paddingHorizontal: SPACE.md,
      backgroundColor: c.bg,
      gap: SPACE.sm,
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      gap: SPACE.sm,
    },
    balanceCard: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.md,
      paddingVertical: SPACE.sm,
      paddingHorizontal: SPACE.xs,
      borderWidth: 1,
      borderColor: c.border,
      gap: 2,
    },
    balanceLabel: {
      color: c.textSecondary,
      fontSize: 9,
      fontFamily: FONT,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    balanceValue: {
      color: c.gold,
      fontSize: 11,
      fontFamily: FONT,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    pointsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.md,
      paddingVertical: SPACE.sm,
      paddingHorizontal: SPACE.lg,
      borderWidth: 1,
      borderColor: c.border,
      gap: SPACE.xs,
      width: '100%',
    },
    pointsLabel: {
      color: c.textSecondary,
      fontSize: 10,
      fontFamily: FONT,
      fontWeight: '500',
      letterSpacing: 0.3,
    },
    pointsValue: {
      color: c.gold,
      fontSize: 12,
      fontFamily: FONT,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // --------------------------------------------------------- messages
    messageContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.md,
      marginHorizontal: SPACE.lg,
      marginTop: SPACE.md,
      padding: SPACE.md,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
    },
    errorMessage: {
      backgroundColor: c.errorSoft,
      borderColor: c.error,
    },
    warningMessage: {
      backgroundColor: c.warningSoft,
      borderColor: c.warning,
    },
    successMessage: {
      backgroundColor: c.successSoft,
      borderColor: c.success,
    },
    messageText: {
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
      letterSpacing: 0.2,
      flex: 1,
      lineHeight: 18,
    },

    // ----------------------------------------------------------- locked
    lockedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACE.xxl,
      paddingBottom: 120,
    },
    lockIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACE.xl,
    },
    lockedMessage: {
      color: c.textPrimary,
      fontSize: 21,
      fontFamily: FONT,
      textAlign: 'center',
      marginBottom: SPACE.sm,
      letterSpacing: 0.5,
      fontWeight: '600',
    },
    lockedSubMessage: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FONT,
      textAlign: 'center',
      marginBottom: SPACE.xl,
      letterSpacing: 0.2,
      lineHeight: 19,
    },

    // -------------------------------------------------------- payment grid
    priceStaleNote: {
      color: c.textMuted,
      fontSize: 11,
      textAlign: 'center',
      letterSpacing: 0.3,
      marginBottom: SPACE.md,
      fontStyle: 'italic',
    },
    paymentGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: SPACE.md,
      marginTop: SPACE.md,
      width: '100%',
    },
    paymentButton: {
      backgroundColor: c.bgElevated,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      padding: SPACE.lg,
      alignItems: 'center',
      width: '45%',
      minWidth: 140,
      ...softShadow(c),
    },
    fullChaptersButton: {
      borderColor: c.gold,
    },
    threeChaptersButton: {
      borderColor: c.accentDim,
    },
    disabledButton: {
      opacity: 0.4,
    },
    paymentButtonText: {
      color: c.textPrimary,
      fontSize: 12,
      fontFamily: FONT,
      marginTop: SPACE.sm,
      marginBottom: SPACE.xs,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    paymentPrice: {
      color: c.gold,
      fontSize: 14,
      fontFamily: FONT,
      letterSpacing: 0.3,
      fontWeight: '700',
    },

    // --------------------------------------------------------- ad unlock
    adUnlockContainer: {
      marginTop: SPACE.md,
      marginBottom: SPACE.lg,
      alignItems: 'center',
      width: '100%',
      maxWidth: 420,
    },
    adUnlockButton: {
      backgroundColor: c.bgElevated,
      borderColor: c.accentBright,
    },

    // ------------------------------------------------------ small balance
    smallBalanceContainer: {
      marginTop: SPACE.md,
      marginBottom: SPACE.lg,
      alignItems: 'center',
      width: '100%',
      maxWidth: 420,
    },

    // ------------------------------------------------------ read actions
    actionButtonsContainer: {
      flexDirection: 'row',
      gap: SPACE.md,
      marginTop: SPACE.md,
      width: '100%',
      maxWidth: 420,
    },
    smpButton: {
      backgroundColor: c.accent,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      ...cardShadow(c, isDark ? 0.35 : 0.18, 10, 5),
    },
    smpButtonText: {
      color: c.textOnAccent,
      fontSize: 13,
      fontFamily: FONT,
      letterSpacing: 0.3,
      textAlign: 'center',
      fontWeight: '600',
    },
    getSmpButton: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    getSmpButtonText: {
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
      letterSpacing: 0.3,
    },

    // ------------------------------------------------------- benefactor
    benefactorContainer: {
      marginTop: SPACE.xl,
      width: '100%',
      maxWidth: 420,
      gap: SPACE.sm,
    },
    benefactorButton: {
      backgroundColor: c.bgElevated,
      borderColor: c.gold,
    },
    benefactorStatus: {
      marginTop: SPACE.xl,
      padding: SPACE.lg,
      backgroundColor: c.goldSoft,
      borderWidth: 1,
      borderColor: c.gold,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      width: '100%',
      maxWidth: 420,
    },
    benefactorStatusText: {
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
      marginTop: SPACE.xs,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    benefactorExpiryText: {
      color: c.textSecondary,
      fontSize: 11,
      fontFamily: FONT,
      marginTop: SPACE.xs,
      letterSpacing: 0.3,
    },

    // ------------------------------------------------------------ content
    contentContainer: {
      flex: 1,
      paddingHorizontal: SPACE.lg,
      paddingTop: SPACE.md,
    },
    scrollContent: {
      paddingBottom: 120,
    },
    paragraph: {
      color: c.textPrimary,
      fontSize: 16,
      fontFamily: FONT,
      lineHeight: 27,
      marginBottom: SPACE.lg,
      letterSpacing: 0.2,
    },
    readingOptions: {
      padding: SPACE.md,
      marginBottom: SPACE.lg,
      backgroundColor: c.goldSoft,
      borderWidth: 1,
      borderColor: c.gold,
      borderRadius: RADIUS.sm,
    },
    readingModeText: {
      color: c.gold,
      fontSize: 13,
      fontFamily: FONT,
      textAlign: 'center',
      letterSpacing: 0.3,
      fontWeight: '600',
    },

    // -------------------------------------------------------- audio bar
    audioControls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xs,
      marginBottom: SPACE.lg,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.lg,
    },
    audioButton: {
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 1,
      paddingVertical: SPACE.xs,
      paddingHorizontal: SPACE.xs,
      minWidth: 52,
    },
    audioButtonText: {
      color: c.textSecondary,
      fontSize: 10,
      fontFamily: FONT,
      marginTop: SPACE.xs,
      letterSpacing: 0.2,
    },

    // --------------------------------------------------- chapter selector
    chapterSelector: {
      marginBottom: SPACE.lg,
    },
    chapterSelectorButton: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.pill,
      paddingVertical: SPACE.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACE.sm,
    },
    chapterSelectorText: {
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
      letterSpacing: 0.3,
    },

    // ------------------------------------------------------------ rating
    ratingSection: {
      padding: SPACE.lg,
      marginBottom: SPACE.lg,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.md,
      gap: SPACE.sm,
    },
    userRating: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACE.sm,
      flexWrap: 'wrap',
    },
    averageRating: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    ratingLabel: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FONT,
      marginRight: SPACE.sm,
      letterSpacing: 0.2,
    },
    starsContainer: {
      flexDirection: 'row',
    },
    star: {
      marginRight: SPACE.xs,
    },
    ratingValue: {
      color: c.textSecondary,
      fontSize: 12,
      fontFamily: FONT,
      marginLeft: SPACE.sm,
      letterSpacing: 0.2,
    },

    // -------------------------------------------------------- author note
    authorNoteSection: {
      marginTop: SPACE.sm,
      marginBottom: SPACE.lg,
      padding: SPACE.lg,
      backgroundColor: c.goldSoft,
      borderWidth: 1,
      borderColor: c.gold,
      borderRadius: RADIUS.md,
    },
    authorNoteTitle: {
      color: c.gold,
      fontSize: 14,
      fontFamily: FONT,
      marginBottom: SPACE.md,
      letterSpacing: 0.4,
      fontWeight: '700',
    },
    authorNoteDisplay: {
      backgroundColor: c.bgCard,
      borderRadius: RADIUS.sm,
      padding: SPACE.md,
      borderWidth: 1,
      borderColor: c.divider,
    },
    authorNoteText: {
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
      lineHeight: 19,
      marginBottom: SPACE.md,
    },
    authorNoteEmpty: {
      color: c.textMuted,
      fontSize: 13,
      fontFamily: FONT,
      fontStyle: 'italic',
      marginBottom: SPACE.md,
    },
    editButton: {
      backgroundColor: c.accent,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 10,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      alignSelf: 'flex-start',
    },
    editButtonText: {
      color: c.textOnAccent,
      fontSize: 12,
      fontFamily: FONT,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    authorNoteEdit: {
      backgroundColor: c.bgCard,
      borderRadius: RADIUS.sm,
      padding: SPACE.md,
      borderWidth: 1,
      borderColor: c.divider,
    },
    authorNoteTextarea: {
      backgroundColor: c.bgInput,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.xs,
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
      padding: SPACE.md,
      minHeight: 84,
      textAlignVertical: 'top',
      marginBottom: SPACE.md,
    },
    authorNoteActions: {
      flexDirection: 'row',
      gap: SPACE.md,
    },
    saveButton: {
      backgroundColor: c.accent,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 10,
      borderRadius: RADIUS.sm,
      flex: 1,
      alignItems: 'center',
    },
    saveButtonText: {
      color: c.textOnAccent,
      fontSize: 13,
      fontFamily: FONT,
      fontWeight: '600',
    },
    cancelButton: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 10,
      borderRadius: RADIUS.sm,
      flex: 1,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
    },

    // ----------------------------------------------------- chapter nav
    chapterNavigation: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACE.lg,
      marginBottom: SPACE.sm,
    },
    navButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.gold,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 10,
      gap: SPACE.sm,
    },
    navButtonText: {
      color: c.gold,
      fontSize: 13,
      fontFamily: FONT,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    navSpacer: {
      flex: 1,
    },

    // -------------------------------------------------------------- modals
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACE.xl,
    },
    modalContent: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.lg,
      padding: SPACE.xl,
      width: '100%',
      maxWidth: 420,
      ...cardShadow(c, isDark ? 0.5 : 0.2, 20, 10),
    },
    closeButton: {
      alignSelf: 'flex-end',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACE.md,
    },
    modalTitle: {
      color: c.textPrimary,
      fontSize: 19,
      fontFamily: FONT,
      marginBottom: SPACE.xs,
      letterSpacing: 0.6,
      fontWeight: '700',
    },
    modalSubtitle: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FONT,
      marginBottom: SPACE.lg,
      letterSpacing: 0.2,
      lineHeight: 18,
    },
    transactionDetails: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      padding: SPACE.lg,
      marginBottom: SPACE.lg,
      gap: SPACE.xs,
    },
    detailText: {
      color: c.textPrimary,
      fontSize: 13,
      fontFamily: FONT,
      marginBottom: SPACE.xs,
      letterSpacing: 0.2,
    },
    modalButtonRow: {
      flexDirection: 'row',
      gap: SPACE.md,
      marginBottom: SPACE.md,
    },
    modalConfirmButton: {
      backgroundColor: c.accent,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 13,
      flex: 1,
      alignItems: 'center',
      ...cardShadow(c, isDark ? 0.3 : 0.15, 8, 4),
    },
    modalCancelButton: {
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.lg,
      paddingVertical: 13,
      flex: 1,
      alignItems: 'center',
    },
    modalButtonText: {
      color: c.textOnAccent,
      fontSize: 13,
      fontFamily: FONT,
      letterSpacing: 0.4,
      fontWeight: '600',
    },
    modalNote: {
      color: c.textMuted,
      fontSize: 11,
      fontFamily: FONT,
      textAlign: 'center',
      letterSpacing: 0.2,
    },

    // ----------------------------------------------------------- video ad
    videoAdContainer: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.lg,
      padding: SPACE.xl,
      width: '100%',
      maxWidth: 420,
      alignItems: 'center',
      ...cardShadow(c, isDark ? 0.5 : 0.2, 20, 10),
    },
    video: {
      width: '100%',
      height: 210,
      marginTop: SPACE.md,
      borderRadius: RADIUS.sm,
      overflow: 'hidden',
      backgroundColor: c.bg,
    },

    // ------------------------------------------------------- benefactor modal
    benefactorModalContent: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.lg,
      padding: SPACE.xl,
      width: '92%',
      maxWidth: 440,
      maxHeight: '85%',
      ...cardShadow(c, isDark ? 0.5 : 0.2, 20, 10),
    },
    benefactorScrollBody: {
      paddingBottom: SPACE.xs,
    },
    tokenSelectorRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: SPACE.sm,
      marginBottom: SPACE.xl,
      gap: SPACE.sm,
    },
    tokenOptionFlex: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xs,
      gap: SPACE.xs,
    },
    tokenSelector: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACE.md,
      marginTop: SPACE.lg,
      marginBottom: SPACE.lg,
    },
    tokenOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.sm,
      padding: SPACE.md,
      paddingHorizontal: SPACE.xl,
      gap: SPACE.sm,
    },
    tokenOptionSelected: {
      borderColor: c.gold,
      backgroundColor: c.goldSoft,
    },
    tokenOptionText: {
      color: c.textSecondary,
      fontSize: 13,
      fontFamily: FONT,
      fontWeight: '600',
    },
    tokenOptionTextSelected: {
      color: c.gold,
    },
    tokenBalance: {
      color: c.textMuted,
      fontSize: 11,
      fontFamily: FONT,
    },

    // 2-column plan grid — fixed pairing on every device.
    benefactorPlansGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginTop: SPACE.xs,
      paddingTop: SPACE.sm, // clearance for the "RECOMMENDED" badge overhang
    },
    benefactorPlanSlot: {
      width: '48%',
      marginBottom: SPACE.md,
    },
    benefactorPlan: {
      backgroundColor: c.bgElevated,
      borderWidth: 2,
      borderRadius: RADIUS.md,
      padding: SPACE.lg,
      alignItems: 'center',
      width: '100%',
      ...softShadow(c),
    },
    benefactorPlanIcon: {
      marginBottom: SPACE.sm,
    },
    benefactorPlanBadge: {
      width: 56,
      height: 56,
      marginBottom: SPACE.sm,
    },
    benefactorPlanName: {
      fontSize: 15,
      fontFamily: FONT,
      marginBottom: SPACE.xs,
      letterSpacing: 0.4,
      fontWeight: '700',
    },
    benefactorPlanPrice: {
      color: c.gold,
      fontSize: 17,
      fontFamily: FONT,
      marginBottom: SPACE.xs,
      letterSpacing: 0.3,
      fontWeight: '700',
    },
    benefactorPlanChapters: {
      color: c.textPrimary,
      fontSize: 11,
      fontFamily: FONT,
      marginBottom: SPACE.xs,
      letterSpacing: 0.2,
    },
    benefactorPlanDuration: {
      color: c.textSecondary,
      fontSize: 10,
      fontFamily: FONT,
      letterSpacing: 0.3,
    },
    benefactorPlanDisabled: {
      opacity: 0.45,
    },
    insufficientBalanceText: {
      color: c.error,
      fontSize: 10,
      fontFamily: FONT,
      marginTop: SPACE.xs,
      fontWeight: '600',
    },
    featuredBadge: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: c.goldBright,
      paddingHorizontal: SPACE.sm,
      paddingVertical: SPACE.xs,
      borderRadius: RADIUS.xs,
      zIndex: 1,
      elevation: 3,
      ...cardShadow(c, 0.25, 6, 3),
    },
    featuredBadgeText: {
      color: c.textOnGold,
      fontSize: 9,
      fontFamily: FONT,
      letterSpacing: 0.4,
      fontWeight: '800',
    },

    // ------------------------------------------------------ plan details
    planDetailsModal: {
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: RADIUS.xl,
      padding: SPACE.xxl,
      width: '85%',
      maxWidth: 400,
      alignSelf: 'center',
      position: 'relative',
      ...cardShadow(c, isDark ? 0.5 : 0.2, 22, 10),
    },
    planDetailsBadge: {
      width: 80,
      height: 80,
      alignSelf: 'center',
      marginBottom: SPACE.lg,
    },
    planDetailsName: {
      fontSize: 26,
      fontFamily: FONT,
      textAlign: 'center',
      marginBottom: SPACE.sm,
      letterSpacing: 1,
      fontWeight: '800',
    },
    planDetailsPrice: {
      fontSize: 30,
      fontFamily: FONT,
      color: c.gold,
      textAlign: 'center',
      marginBottom: SPACE.xs,
      fontWeight: '800',
    },
    planDetailsDuration: {
      fontSize: 13,
      fontFamily: FONT,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: SPACE.xl,
      letterSpacing: 0.3,
    },
    planFeaturesList: {
      marginBottom: SPACE.xl,
      gap: SPACE.sm,
    },
    planFeatureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACE.sm,
    },
    featureCheckIcon: {
      marginRight: SPACE.md,
    },
    planFeatureText: {
      fontSize: 13,
      fontFamily: FONT,
      color: c.textPrimary,
      flex: 1,
      lineHeight: 18,
    },
    planDetailsSubscribeButton: {
      paddingVertical: SPACE.lg,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      ...cardShadow(c, isDark ? 0.35 : 0.18, 10, 5),
    },
    planDetailsSubscribeButtonDisabled: {
      opacity: 0.6,
    },
    planDetailsSubscribeButtonText: {
      color: c.textOnGold,
      fontSize: 15,
      fontFamily: FONT,
      letterSpacing: 1,
      fontWeight: '700',
    },

    // ------------------------------------------------------- chapter list
    chapterList: {
      maxHeight: 420,
      marginTop: SPACE.md,
    },
    chapterListItem: {
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xs,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    chapterListItemText: {
      color: c.textPrimary,
    },

    // ------------------------------------------------------- payment animation
    paymentAnimationOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACE.xl,
    },
    paymentAnimationContainer: {
      backgroundColor: c.bgCard,
      borderRadius: RADIUS.lg,
      padding: SPACE.xl * 2,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: c.accent,
      ...cardShadow(c, 0.5, 20, 10),
      width: width * 0.8,
      maxWidth: 350,
    },
    paymentAnimationRing: {
      position: 'absolute',
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 3,
      borderColor: c.accent,
      backgroundColor: 'transparent',
    },
    paymentAnimationRing2: {
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 2,
      borderColor: c.accentBright,
    },
    paymentIcon: {
      marginBottom: SPACE.lg,
    },
    paymentAnimationText: {
      fontSize: 18,
      fontFamily: FONT,
      color: c.textPrimary,
      fontWeight: '700',
      marginBottom: SPACE.md,
      textAlign: 'center',
    },
    paymentProgressBar: {
      width: '100%',
      height: 4,
      backgroundColor: c.bgElevated,
      borderRadius: 2,
      marginBottom: SPACE.md,
      overflow: 'hidden',
    },
    paymentProgressFill: {
      height: '100%',
      backgroundColor: c.accent,
      borderRadius: 2,
    },
    paymentAnimationSubtext: {
      fontSize: 14,
      fontFamily: FONT,
      color: c.textSecondary,
      textAlign: 'center',
    },
  });
};

// Keep original export for any callers using the default (dark) theme.
export const styles = getChapterScreenStyles(true);