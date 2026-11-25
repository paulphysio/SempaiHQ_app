// styles/ProfileMangaStyles.js
//
// Manga / anime-novel design system for the Creator Profile page.
// The PALETTE below is a copy of the dark + light colours from your original ProfileStyles.js,
// value for value. Your old ProfileStyles.js is NOT touched, so any other screen importing it keeps working.

import { StyleSheet, Dimensions, Platform } from 'react-native';
import { surfacePalettes } from '../theme/tokens';

const { width } = Dimensions.get('window');

export const PALETTE = surfacePalettes;

export const getProfilePalette = (isDark = true) => (isDark ? PALETTE.dark : PALETTE.light);

// How far the hard "ink" shadow sits behind each panel.
export const INK = 5;

export const getProfileMangaStyles = (isDark = true) => {
  const c = getProfilePalette(isDark);

  return StyleSheet.create({
    // ---------------------------------------------------------------- shell
    root: { flex: 1, backgroundColor: c.bg },
    sunDisc: {
      position: 'absolute',
      top: -190,
      right: -150,
      width: 380,
      height: 380,
      borderRadius: 190,
      backgroundColor: c.accentSoft,
    },
    sunRing: {
      position: 'absolute',
      top: -150,
      right: -110,
      width: 300,
      height: 300,
      borderRadius: 150,
      borderWidth: 1,
      borderColor: c.accentDim,
      opacity: 0.45,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

    // ---------------------------------------------------------------- title
    titleWrap: { alignItems: 'center', marginBottom: 26 },
    title: {
      color: c.textPrimary,
      fontSize: 30,
      fontWeight: '900',
      letterSpacing: 4,
      textAlign: 'center',
      textShadowColor: c.accent,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 14,
    },
    titleSlashRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
    titleSlash: {
      width: 64,
      height: 4,
      backgroundColor: c.accent,
      transform: [{ skewX: '-30deg' }],
    },
    titleSlashThin: {
      width: 26,
      height: 2,
      marginLeft: 6,
      backgroundColor: c.gold,
      transform: [{ skewX: '-30deg' }],
    },
    subtitle: {
      color: c.textSecondary,
      fontSize: 12,
      letterSpacing: 3,
      marginTop: 10,
      textAlign: 'center',
    },

    // ----------------------------------------------------------------- hero
    heroBody: { paddingTop: 34, paddingBottom: 22, paddingHorizontal: 18, alignItems: 'center' },
    avatarWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
    avatarPulse: {
      position: 'absolute',
      width: 132,
      height: 132,
      borderRadius: 66,
      borderWidth: 1,
      borderColor: c.accent,
    },
    avatarDashed: {
      position: 'absolute',
      width: 124,
      height: 124,
      borderRadius: 62,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.gold,
    },
    avatarCore: {
      width: 106,
      height: 106,
      borderRadius: 53,
      borderWidth: 4,
      borderColor: c.border,
      backgroundColor: c.bgElevated2,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarImg: { width: '100%', height: '100%' },
    avatarInitial: { color: c.accent, fontSize: 46, fontWeight: '900' },

    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
      flexWrap: 'wrap',
    },
    namePlate: {
      backgroundColor: c.accent,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 20,
      paddingVertical: 6,
      overflow: 'hidden',
      borderRadius: 999,
      maxWidth: 260,
    },
    nameText: {
      color: c.textOnAccent,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 1,
    },
    nameBadge: { width: 32, height: 32, marginLeft: 8, resizeMode: 'contain' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: c.border,
      marginHorizontal: 4,
      marginBottom: 6,
      borderRadius: 999,
    },
    chipInner: { flexDirection: 'row', alignItems: 'center' },
    chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 2, marginLeft: 6 },

    bioText: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      fontStyle: 'italic',
    },

    // ---------------------------------------------------------------- stats
    panelPad: { padding: 16 },
    statsRow: { flexDirection: 'row', marginHorizontal: -4 },
    statTile: {
      flex: 1,
      marginHorizontal: 4,
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 4,
      alignItems: 'center',
      overflow: 'hidden',
      borderRadius: 20,
    },
    statTileTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
    statIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      marginTop: 4,
    },
    statValue: { color: c.textPrimary, fontSize: 18, fontWeight: '900', marginTop: 10 },
    statLabel: {
      color: c.textMuted,
      fontSize: 10,
      letterSpacing: 2,
      marginTop: 2,
      textTransform: 'uppercase',
    },
    lastRead: {
      color: c.textMuted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 14,
      fontStyle: 'italic',
    },

    rankBox: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
      padding: 12,
      borderRadius: 20,
    },
    rankTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    rankLevel: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankLevelLv: { color: c.textOnGold, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
    rankLevelNum: { color: c.textOnGold, fontSize: 18, fontWeight: '900', marginTop: -2 },
    rankTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 1 },
    rankJp: { color: c.gold, fontSize: 12, letterSpacing: 2, marginTop: 2 },
    rankHint: { color: c.textMuted, fontSize: 11, marginTop: 8, letterSpacing: 0.5 },

    // --------------------------------------------------------------- badges
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
    badgeCell: { width: '33.333%', alignItems: 'center', paddingHorizontal: 6, marginBottom: 14 },
    badgeFrame: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    badgeImg: { width: '84%', height: '84%', resizeMode: 'contain' },
    badgeName: {
      color: c.textSecondary,
      fontSize: 10,
      letterSpacing: 1,
      marginTop: 6,
      textAlign: 'center',
    },

    // ------------------------------------------------------------ creations
    workGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    workCell: { width: '48%', marginBottom: 18 },
    workCover: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated,
      overflow: 'hidden',
      borderRadius: 18,
    },
    workSpine: { width: 9, backgroundColor: c.accent, borderRightWidth: 0, borderRightColor: c.border },
    workImg: { flex: 1, height: 168, backgroundColor: c.bgElevated2 },
    workImgEmpty: { alignItems: 'center', justifyContent: 'center' },
    workTitle: {
      color: c.textPrimary,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      marginTop: 8,
    },
    workSummary: { color: c.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },

    // --------------------------------------------------------------- social
    socialRow: { flexDirection: 'row', flexWrap: 'wrap' },
    socialChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginRight: 10,
      marginBottom: 10,
      borderRadius: 999,
    },
    socialText: { color: c.textPrimary, fontSize: 12, letterSpacing: 1, marginLeft: 8 },
    walletRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.bgElevated,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 4,
      borderRadius: 18,
    },
    walletLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
    walletText: { color: c.gold, fontSize: 13, letterSpacing: 1, marginLeft: 10, fontWeight: '700' },
    copyBtn: {
      width: 34,
      height: 34,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
    },
    copiedTag: { color: c.success, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginRight: 8 },

    // -------------------------------------------------------------- actions
    actionsRow: { flexDirection: 'row', marginTop: 18, marginHorizontal: -5 },
    actionCell: { flex: 1, marginHorizontal: 5 },

    // --------------------------------------------------------- states/misc
    centerBox: { alignItems: 'center', paddingVertical: 34, paddingHorizontal: 20 },
    stateIconWrap: {
      width: 74,
      height: 74,
      borderRadius: 37,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgElevated2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    stateText: { color: c.textSecondary, fontSize: 14, lineHeight: 22, textAlign: 'center', letterSpacing: 0.5 },
    errorText: { color: c.error, fontSize: 14, lineHeight: 22, textAlign: 'center', letterSpacing: 0.5 },
    loadingText: { color: c.textPrimary, marginTop: 14, fontSize: 14, letterSpacing: 4, fontWeight: '800' },
    placeholder: { color: c.textMuted, fontSize: 12, textAlign: 'center', fontStyle: 'italic', letterSpacing: 1, paddingVertical: 6 },
    ownTag: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: c.gold,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    ownTagText: { color: c.textOnGold, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  });
};const RADIUS = { xs: 8, sm: 12, md: 16, lg: 20, xl: 26, pill: 999 };
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
      borderRadius: 999,
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
    messageInput: {
      backgroundColor: c.bgElevated,
      color: c.textPrimary,
      borderRadius: RADIUS.xs,
      padding: SPACE.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: SPACE.lg,
      minHeight: 100,
      fontSize: 14,
      fontFamily: FONT,
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
