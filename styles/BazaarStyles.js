import { StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export const BAZAAR_COLORS = {
  bg: '#0B0B14',
  bgElevated: '#111219',
  bgCard: '#15161F',
  bgCardAlt: '#1A1B26',
  accent: '#F36316',
  accentDeep: '#F36316',
  accentSoft: 'rgba(243, 99, 22, 0.12)',
  textPrimary: '#FFFFFF',
  textSecondary: '#C9C9D1',
  textMuted: '#8A8A99',
  border: 'rgba(255, 255, 255, 0.08)',
  success: '#34C759',
  danger: '#FF453A',
  gold: '#FFC857',
};

export const BAZAAR_COLORS_LIGHT = {
  bg: '#FDFBD4',
  bgElevated: '#F5F0D0',
  bgCard: '#FFFFFF',
  bgCardAlt: '#F8F8E8',
  accent: '#3B82F6',
  accentDeep: '#2563EB',
  accentSoft: 'rgba(59, 130, 246, 0.12)',
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#64748B',
  border: 'rgba(59, 130, 246, 0.15)',
  success: '#16A34A',
  danger: '#DC2626',
  gold: '#B45309',
};

export const BAZAAR_SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 };
export const BAZAAR_FONT = 'Yoruka';
export const BAZAAR_CARD_WIDTH = CARD_WIDTH;

const _bazaarStyleCache = {};
const buildBazaarStyles = (BAZAAR_COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BAZAAR_COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BAZAAR_SPACE.l,
    paddingVertical: BAZAAR_SPACE.m,
    backgroundColor: BAZAAR_COLORS.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: BAZAAR_COLORS.border,
  },
  headerTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 20,
    fontWeight: '700',
    color: BAZAAR_COLORS.textPrimary,
  },
  iconButton: {
    padding: BAZAAR_SPACE.s,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: BAZAAR_SPACE.xl,
  },
  mutedText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.textMuted,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.danger,
    textAlign: 'center',
    marginTop: BAZAAR_SPACE.m,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BAZAAR_COLORS.accent,
    paddingVertical: BAZAAR_SPACE.m,
    paddingHorizontal: BAZAAR_SPACE.xl,
    borderRadius: 12,
    marginTop: BAZAAR_SPACE.l,
    gap: BAZAAR_SPACE.s,
  },
  primaryButtonText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    paddingVertical: BAZAAR_SPACE.m,
    paddingHorizontal: BAZAAR_SPACE.xl,
    borderRadius: 12,
    marginTop: BAZAAR_SPACE.m,
    gap: BAZAAR_SPACE.s,
  },
  secondaryButtonText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    fontWeight: '600',
    color: BAZAAR_COLORS.textPrimary,
  },
  card: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    overflow: 'hidden',
    width: CARD_WIDTH,
  },
  cardCover: {
    width: '100%',
    aspectRatio: 0.7,
    backgroundColor: BAZAAR_COLORS.bgCardAlt,
  },
  cardCoverPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: BAZAAR_SPACE.m,
  },
  cardTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 14,
    fontWeight: '600',
    color: BAZAAR_COLORS.textPrimary,
  },
  cardAuthor: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: BAZAAR_SPACE.s,
  },
  priceBadge: {
    backgroundColor: BAZAAR_COLORS.accentSoft,
    paddingHorizontal: BAZAAR_SPACE.s,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    fontWeight: '700',
    color: BAZAAR_COLORS.accent,
  },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: BAZAAR_SPACE.s,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 10,
    fontWeight: '700',
    color: BAZAAR_COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  // Detail screen
  detailScroll: {
    flex: 1,
  },
  detailCover: {
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: BAZAAR_COLORS.bgCardAlt,
  },
  detailBody: {
    padding: BAZAAR_SPACE.l,
  },
  detailTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 24,
    fontWeight: '800',
    color: BAZAAR_COLORS.textPrimary,
  },
  detailAuthor: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.textSecondary,
    marginTop: BAZAAR_SPACE.xs,
  },
  detailDescription: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    lineHeight: 22,
    color: BAZAAR_COLORS.textSecondary,
    marginTop: BAZAAR_SPACE.l,
  },
  payCard: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    padding: BAZAAR_SPACE.l,
    margin: BAZAAR_SPACE.l,
  },
  payTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 17,
    fontWeight: '700',
    color: BAZAAR_COLORS.textPrimary,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: BAZAAR_SPACE.m,
    marginTop: BAZAAR_SPACE.m,
  },
  currencyOption: {
    flex: 1,
    paddingVertical: BAZAAR_SPACE.m,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    alignItems: 'center',
    backgroundColor: BAZAAR_COLORS.bgCardAlt,
  },
  currencyOptionActive: {
    borderColor: BAZAAR_COLORS.accent,
    backgroundColor: BAZAAR_COLORS.accentSoft,
  },
  currencyOptionText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 14,
    fontWeight: '700',
    color: BAZAAR_COLORS.textSecondary,
  },
  currencyOptionActiveText: {
    color: BAZAAR_COLORS.accent,
  },
  splitNote: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: BAZAAR_SPACE.m,
    lineHeight: 18,
  },
  // Forms
  input: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: BAZAAR_SPACE.m,
    paddingVertical: BAZAAR_SPACE.m,
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    color: BAZAAR_COLORS.textPrimary,
    marginTop: BAZAAR_SPACE.s,
  },
  label: {
    fontFamily: BAZAAR_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: BAZAAR_COLORS.textSecondary,
    marginTop: BAZAAR_SPACE.m,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: BAZAAR_SPACE.l,
    marginTop: BAZAAR_SPACE.s,
    gap: BAZAAR_SPACE.m,
  },
  filePickerText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 14,
    color: BAZAAR_COLORS.textSecondary,
    flex: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BAZAAR_SPACE.s,
    marginTop: BAZAAR_SPACE.m,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BAZAAR_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: BAZAAR_COLORS.accent,
    borderColor: BAZAAR_COLORS.accent,
  },
  checkboxLabel: {
    fontFamily: BAZAAR_FONT,
    fontSize: 13,
    color: BAZAAR_COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  // Dashboard
  statCard: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    padding: BAZAAR_SPACE.l,
    marginBottom: BAZAAR_SPACE.m,
  },
  statValue: {
    fontFamily: BAZAAR_FONT,
    fontSize: 26,
    fontWeight: '800',
    color: BAZAAR_COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    gap: BAZAAR_SPACE.m,
  },
  statCardHalf: {
    flex: 1,
  },
  listItem: {
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
    padding: BAZAAR_SPACE.m,
    marginBottom: BAZAAR_SPACE.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAZAAR_SPACE.m,
  },
  listItemTitle: {
    fontFamily: BAZAAR_FONT,
    fontSize: 15,
    fontWeight: '600',
    color: BAZAAR_COLORS.textPrimary,
  },
  listItemSub: {
    fontFamily: BAZAAR_FONT,
    fontSize: 12,
    color: BAZAAR_COLORS.textMuted,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: BAZAAR_SPACE.s,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: BAZAAR_SPACE.xs,
  },
  statusPillText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 11,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    gap: BAZAAR_SPACE.s,
    paddingHorizontal: BAZAAR_SPACE.l,
    paddingVertical: BAZAAR_SPACE.m,
  },
  tab: {
    paddingHorizontal: BAZAAR_SPACE.m,
    paddingVertical: BAZAAR_SPACE.s,
    borderRadius: 10,
    backgroundColor: BAZAAR_COLORS.bgCard,
    borderWidth: 1,
    borderColor: BAZAAR_COLORS.border,
  },
  tabActive: {
    backgroundColor: BAZAAR_COLORS.accentSoft,
    borderColor: BAZAAR_COLORS.accent,
  },
  tabText: {
    fontFamily: BAZAAR_FONT,
    fontSize: 13,
    fontWeight: '600',
    color: BAZAAR_COLORS.textSecondary,
  },
  tabTextActive: {
    color: BAZAAR_COLORS.accent,
  },
});

/** Themed Bazaar palette + styles. Cached per theme. */
export const getBazaarPalette = (isDark) => (isDark ? BAZAAR_COLORS : BAZAAR_COLORS_LIGHT);

export const getBazaarStyles = (isDark) => {
  const key = isDark ? 'dark' : 'light';
  if (!_bazaarStyleCache[key]) {
    _bazaarStyleCache[key] = buildBazaarStyles(getBazaarPalette(isDark));
  }
  return _bazaarStyleCache[key];
};

/**
 * Drop-in hook for Bazaar screens:
 *   const { colors: BAZAAR_COLORS, styles } = useBazaarTheme();
 */
export const useBazaarTheme = () => {
  const { isDark } = useTheme();
  return {
    colors: getBazaarPalette(isDark),
    styles: getBazaarStyles(isDark),
    isDark,
  };
};
