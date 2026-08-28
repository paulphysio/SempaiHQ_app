// ./styles/BadgesStyles.js
//
// Kaito Adventure design system — Badges screen.
// Theme-aware styles for badge purchase and display.

import { StyleSheet, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Style factory
// ---------------------------------------------------------------------------

export const getBadgesStyles = (isDark) => {
  const p = isDark ? PALETTE.dark : PALETTE.light;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: p.bg,
    },
    header: {
      padding: SPACE.lg,
      backgroundColor: p.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: p.textPrimary,
      marginBottom: SPACE.xs,
    },
    subtitle: {
      fontSize: 14,
      color: p.textSecondary,
    },
    writerSection: {
      padding: SPACE.lg,
      backgroundColor: p.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: p.border,
    },
    writerSectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: p.textPrimary,
      marginBottom: SPACE.md,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: p.bgElevated,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACE.md,
      paddingVertical: SPACE.sm,
      marginBottom: SPACE.md,
    },
    searchIcon: {
      marginRight: SPACE.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: p.textPrimary,
    },
    writerList: {
      marginBottom: SPACE.sm,
    },
    writerChip: {
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.sm,
      backgroundColor: p.bgElevated,
      borderRadius: RADIUS.pill,
      marginRight: SPACE.sm,
      borderWidth: 1,
      borderColor: p.border,
    },
    writerChipSelected: {
      backgroundColor: p.accent,
      borderColor: p.accent,
    },
    writerChipText: {
      fontSize: 14,
      color: p.textSecondary,
    },
    writerChipTextSelected: {
      color: p.textPrimary,
      fontWeight: 'bold',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 100,
      paddingHorizontal: SPACE.lg,
    },
    section: {
      marginBottom: SPACE.xxl,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: p.textPrimary,
      marginBottom: SPACE.lg,
    },
    badgesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACE.md,
    },
    badgeCard: {
      width: '48%',
      backgroundColor: p.bgCard,
      borderRadius: RADIUS.md,
      padding: SPACE.lg,
      borderWidth: 1,
      borderColor: p.border,
      alignItems: 'center',
    },
    ownedBadge: {
      borderColor: p.gold,
      backgroundColor: p.goldSoft,
    },
    badgeImage: {
      width: 80,
      height: 80,
      marginBottom: SPACE.md,
    },
    badgeName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: p.textPrimary,
      marginBottom: SPACE.xs,
      textAlign: 'center',
    },
    badgeDescription: {
      fontSize: 12,
      color: p.textSecondary,
      textAlign: 'center',
      marginBottom: SPACE.md,
    },
    purchaseButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.sm,
      backgroundColor: p.accent,
      paddingHorizontal: SPACE.lg,
      paddingVertical: SPACE.sm,
      borderRadius: RADIUS.pill,
    },
    purchaseButtonText: {
      color: p.textPrimary,
      fontWeight: 'bold',
      fontSize: 14,
    },
    ownedBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACE.sm,
    },
    ownedText: {
      color: p.goldBright,
      fontWeight: 'bold',
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: p.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: SPACE.lg,
    },
    modalContent: {
      backgroundColor: p.bgCard,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.md,
      padding: SPACE.xl,
      width: '100%',
      maxWidth: 400,
    },
    closeButton: {
      alignSelf: 'flex-end',
      padding: SPACE.sm,
      marginBottom: SPACE.md,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: p.textPrimary,
      marginBottom: SPACE.xs,
    },
    modalSubtitle: {
      fontSize: 14,
      color: p.textSecondary,
      marginBottom: SPACE.xs,
    },
    modalPrice: {
      fontSize: 32,
      fontWeight: 'bold',
      color: p.gold,
      marginBottom: SPACE.xl,
    },
    currencySelector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: SPACE.xl,
    },
    currencyOption: {
      flex: 1,
      marginHorizontal: SPACE.xs,
      alignItems: 'center',
      backgroundColor: p.bgElevated,
      borderWidth: 1,
      borderColor: p.border,
      borderRadius: RADIUS.sm,
      paddingVertical: SPACE.md,
      paddingHorizontal: SPACE.xs,
      gap: SPACE.xs,
    },
    currencyOptionSelected: {
      borderColor: p.gold,
      backgroundColor: p.goldSoft,
    },
    currencyOptionText: {
      color: p.textSecondary,
      fontSize: 14,
    },
    currencyOptionTextSelected: {
      color: p.gold,
      fontWeight: 'bold',
    },
    currencyBalance: {
      color: p.textMuted,
      fontSize: 12,
    },
    confirmButton: {
      paddingVertical: SPACE.lg,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.accent,
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmButtonText: {
      color: p.textPrimary,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
};
