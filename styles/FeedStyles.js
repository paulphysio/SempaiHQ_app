// ./styles/FeedStyles.js
//
// Kaito Adventure design system — Social feed page.
// Same public API as before: getFeedStyles(isDark) returns a
// StyleSheet. All class names referenced by FeedScreen.js
// are defined here.
//
// Light mode converts orange accents to blue (matching HomeStyles pattern).

import { StyleSheet, Platform } from 'react-native';
import { palettes } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
// Dark mode uses warm orange accents, light mode uses cool blue accents.
// Both share the same structural design language.

// Feed palette — derived from the shared tokens (was its own orange #D94F04 + blue).
const PALETTE = {
  dark: {
    bg: palettes.dark.bg,
    bgElevated: palettes.dark.bgCardAlt,
    bgCard: palettes.dark.bgCard,
    bgInput: palettes.dark.accentSoft,
    accent: palettes.dark.accent,
    accentDeep: palettes.dark.accentDeep,
    accentBright: palettes.dark.accentHi,
    accentSoft: palettes.dark.accentSoft,
    accentGlow: palettes.dark.accentGlow,
    // "primary" was a second, off-brand blue in dark mode; it now follows the brand
    primary: palettes.dark.accent,
    primarySoft: palettes.dark.accentSoft,
    primaryBorder: palettes.dark.borderAccent,
    textPrimary: palettes.dark.textPrimary,
    textSecondary: palettes.dark.textSecondary,
    textMuted: palettes.dark.textMuted,
    border: palettes.dark.border,
    borderAccent: palettes.dark.borderAccent,
    danger: palettes.dark.danger,
    success: palettes.dark.success,
    overlay: palettes.dark.scrim,
    shadow: '#000000',
  },
  light: {
    bg: palettes.light.bg,
    bgElevated: palettes.light.bgCardAlt,
    bgCard: palettes.light.bgCard,
    bgInput: palettes.light.accentSoft,
    accent: palettes.light.accent,
    accentDeep: palettes.light.accentDeep,
    accentBright: palettes.light.accentHi,
    accentSoft: palettes.light.accentSoft,
    accentGlow: palettes.light.accentGlow,
    // "primary" was a second, off-brand blue in dark mode; it now follows the brand
    primary: palettes.light.accent,
    primarySoft: palettes.light.accentSoft,
    primaryBorder: palettes.light.borderAccent,
    textPrimary: palettes.light.textPrimary,
    textSecondary: palettes.light.textSecondary,
    textMuted: palettes.light.textMuted,
    border: palettes.light.border,
    borderAccent: palettes.light.borderAccent,
    danger: palettes.light.danger,
    success: palettes.light.success,
    overlay: palettes.light.scrim,
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
};

const RADIUS = { xs: 8, sm: 12, md: 15, lg: 20, xl: 25, pill: 999 };
const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
const FONT = Platform.select({ ios: 'Yoruka', android: 'Yoruka', default: 'Yoruka' });

const cardShadow = (c, opacity = 0.1, radius = 4, elevation = 3) => ({
  shadowColor: c.shadow,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

const glowShadow = (c, color) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
});

// ---------------------------------------------------------------------------

export const getFeedStyles = (isDark = true) => {
  const c = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    // -------------------------------------------------------------- shell
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    page: {
      flex: 1,
      backgroundColor: c.bg,
    },

    // --------------------------------------------------------------- header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACE.lg,
      backgroundColor: c.bgElevated,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: FONT,
    },

    // ----------------------------------------------------------- navbar
    feedNavbar: {
      backgroundColor: c.bgElevated,
      borderBottomWidth: 1,
      borderBottomColor: c.borderAccent,
    },
    navbarContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACE.md,
    },
    logoLink: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    logoText: {
      color: c.accent,
      fontSize: 18,
      fontWeight: '700',
      marginLeft: SPACE.sm,
      fontFamily: FONT,
    },
    menuButton: {
      padding: SPACE.sm,
    },
    navItems: {
      backgroundColor: c.bgElevated,
      padding: SPACE.md,
      borderTopWidth: 1,
      borderTopColor: c.borderAccent,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACE.md,
    },
    navItemText: {
      color: c.textPrimary,
      fontSize: 16,
      marginLeft: SPACE.sm,
      fontFamily: FONT,
    },

    // ------------------------------------------------------------- content
    feedContent: {
      flex: 1,
    },
    feedMain: {
      padding: SPACE.md,
    },
    feedTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACE.sm,
    },
    feedTitle: {
      color: c.accent,
      fontSize: 24,
      fontWeight: '700',
      marginLeft: SPACE.sm,
      fontFamily: FONT,
    },
    feedSubtitle: {
      color: c.textMuted,
      fontSize: 14,
      marginBottom: SPACE.xl,
      fontFamily: FONT,
    },

    // ---------------------------------------------------------- locked state
    lockedContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACE.lg,
    },
    lockedMessage: {
      fontSize: 18,
      color: c.textSecondary,
      marginTop: SPACE.lg,
      fontFamily: FONT,
    },
    connectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primary,
      paddingHorizontal: SPACE.xl,
      paddingVertical: SPACE.md,
      borderRadius: RADIUS.pill,
      marginTop: SPACE.lg,
      borderWidth: 2,
      borderColor: c.primaryBorder,
      ...glowShadow(c, c.primary),
      borderRadius: 999,
    },
    buttonIcon: {
      marginRight: SPACE.sm,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FONT,
    },

    // ------------------------------------------------------------- loading
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: c.textSecondary,
      marginTop: SPACE.md,
      fontFamily: FONT,
    },

    // ------------------------------------------------------------- feed list
    feedList: {
      padding: SPACE.md,
    },
    postCard: {
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.md,
      marginBottom: SPACE.md,
      padding: SPACE.lg,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      ...cardShadow(c),
    },
    postHeader: {
      marginBottom: SPACE.md,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 45,
      height: 45,
      borderRadius: 22.5,
      backgroundColor: c.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: c.primaryBorder,
    },
    userDetails: {
      marginLeft: SPACE.md,
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FONT,
    },
    postTime: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
      fontFamily: FONT,
    },
    postContent: {
      fontSize: 15,
      color: c.textPrimary,
      lineHeight: 22,
      marginBottom: SPACE.md,
      fontFamily: FONT,
    },
    postImage: {
      width: '100%',
      height: 200,
      borderRadius: RADIUS.sm,
      marginBottom: SPACE.md,
      resizeMode: 'cover',
    },
    postActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      paddingTop: SPACE.md,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: SPACE.xl,
    },
    actionText: {
      fontSize: 14,
      color: c.textSecondary,
      marginLeft: SPACE.sm,
      fontFamily: FONT,
    },
    likedText: {
      color: c.danger,
    },

    // ----------------------------------------------------------- empty state
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACE.xl,
    },
    emptyText: {
      fontSize: 18,
      color: c.textSecondary,
      marginTop: SPACE.lg,
      fontFamily: FONT,
    },
    emptySubtext: {
      fontSize: 14,
      color: c.textMuted,
      marginTop: SPACE.sm,
      fontFamily: FONT,
    },

    // ------------------------------------------------------------- modal
    modalContainer: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: c.bg,
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: SPACE.lg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: FONT,
    },
    modalBody: {
      padding: SPACE.lg,
    },
    userPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACE.md,
    },
    postInput: {
      backgroundColor: c.bgInput,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      borderRadius: RADIUS.md,
      padding: SPACE.md,
      color: c.textPrimary,
      fontSize: 16,
      fontFamily: FONT,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    imagePreview: {
      position: 'relative',
      marginTop: SPACE.md,
    },
    previewImage: {
      width: '100%',
      height: 200,
      borderRadius: RADIUS.sm,
    },
    removeImage: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: RADIUS.sm,
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      marginTop: SPACE.md,
      gap: SPACE.md,
    },
    attachButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primarySoft,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      borderRadius: 999,
    },
    attachText: {
      fontSize: 14,
      color: c.primary,
      marginLeft: SPACE.sm,
      fontFamily: FONT,
    },

    // -------------------------------------------------------- post creator
    postCreatorContainer: {
      marginBottom: SPACE.xl,
    },
    postCreator: {
      backgroundColor: c.bgElevated,
      borderRadius: RADIUS.md,
      padding: SPACE.md,
      borderWidth: 1,
      borderColor: c.borderAccent,
    },
    postButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.accent,
      paddingHorizontal: SPACE.md,
      paddingVertical: SPACE.sm,
      borderRadius: RADIUS.sm,
      alignSelf: 'flex-end',
      marginTop: SPACE.md,
      borderRadius: 999,
    },
    postButtonText: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: SPACE.sm,
      fontFamily: FONT,
    },

    // -------------------------------------------------------- posts container
    postsContainer: {
      flex: 1,
      minHeight: 200,
    },
    noPosts: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: SPACE.xxl,
    },
    noPostsText: {
      color: c.textMuted,
      fontSize: 16,
      marginTop: SPACE.md,
      fontFamily: FONT,
    },

    // -------------------------------------------------------- additional styles
    postBody: {
      flex: 1,
    },
    postInput: {
      backgroundColor: c.bgInput,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      borderRadius: RADIUS.md,
      padding: SPACE.md,
      color: c.textPrimary,
      fontSize: 16,
      fontFamily: FONT,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    userHandle: {
      color: c.textMuted,
      fontSize: 14,
      marginRight: SPACE.sm,
      fontFamily: FONT,
    },
    moreButton: {
      padding: SPACE.xs,
    },
    postText: {
      color: c.textPrimary,
      fontSize: 15,
      lineHeight: 20,
      marginBottom: SPACE.md,
      fontFamily: FONT,
    },
    actionTextActive: {
      color: c.accent,
    },
    commentsSection: {
      marginTop: SPACE.md,
      paddingTop: SPACE.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    comment: {
      flexDirection: 'row',
      marginBottom: SPACE.md,
    },
    commentAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACE.sm,
    },
    commentBody: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    commentUserName: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: '600',
      marginRight: SPACE.sm,
      fontFamily: FONT,
    },
    commentTime: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: FONT,
    },
    commentText: {
      color: c.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontFamily: FONT,
    },
    noComments: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: SPACE.sm,
      fontFamily: FONT,
    },
    addComment: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: SPACE.md,
      paddingTop: SPACE.md,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    commentInputAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACE.sm,
    },
    commentInput: {
      flex: 1,
      backgroundColor: c.bgInput,
      borderWidth: 1,
      borderColor: c.primaryBorder,
      borderRadius: RADIUS.pill,
      paddingHorizontal: SPACE.md,
      paddingVertical: SPACE.sm,
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
    },
    commentButton: {
      padding: SPACE.sm,
      marginLeft: SPACE.sm,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalText: {
      color: c.textSecondary,
      fontSize: 14,
      marginBottom: SPACE.xl,
      fontFamily: FONT,
    },
    modalCancelButton: {
      paddingHorizontal: SPACE.md,
      paddingVertical: SPACE.sm,
    },
    modalCancelText: {
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
    },
    modalDeleteButton: {
      backgroundColor: c.danger,
      paddingHorizontal: SPACE.md,
      paddingVertical: SPACE.sm,
      borderRadius: RADIUS.sm,
    },
    modalDeleteText: {
      color: c.textPrimary,
      fontSize: 14,
      fontFamily: FONT,
    },
    bottomPadding: {
      height: 20,
    },
    safeArea: {
      flex: 1,
      backgroundColor: c.bg,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 80,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 48,
    },
    composer: {
      flexDirection: 'row',
      padding: SPACE.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    composerAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACE.md,
    },
    composerBody: {
      flex: 1,
    },
    composerInput: {
      color: c.textPrimary,
      fontSize: 16,
      minHeight: 60,
      textAlignVertical: 'top',
      fontFamily: FONT,
    },
    composerActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: SPACE.sm,
    },
    composerActionButton: {
      padding: SPACE.sm,
    },
    postButtonDisabled: {
      opacity: 0.5,
    },
  });
};

// Keep original export for backward compatibility (dark mode default)
export const styles = getFeedStyles(true);
