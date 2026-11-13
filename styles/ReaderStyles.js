import { StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Design tokens matching app aesthetics
const COLOR = {
  dark: {
    bg: '#0B0B14',
    bgElevated: '#111219',
    bgCard: '#15161F',
    bgCardAlt: '#1A1B26',
    accent: '#FF5733',
    accentDeep: '#F36316',
    accentGlow: 'rgba(255, 87, 51, 0.35)',
    accentSoft: 'rgba(255, 87, 51, 0.12)',
    sakura: '#E94560',
    gold: '#FFD700',
    textPrimary: '#FFFFFF',
    textSecondary: '#C9C9D1',
    textMuted: '#8A8A99',
    border: 'rgba(255, 255, 255, 0.08)',
    borderAccent: 'rgba(255, 87, 51, 0.35)',
    danger: '#FF6B6B',
    warning: '#FFC107',
  },
  light: {
    bg: '#FDFBD4',
    bgElevated: '#f5f0d0',
    bgCard: '#ffffff',
    bgCardAlt: '#f8f8e8',
    accent: '#3b82f6',
    accentDeep: '#2563eb',
    accentGlow: 'rgba(59, 130, 246, 0.35)',
    accentSoft: 'rgba(59, 130, 246, 0.12)',
    sakura: '#E94560',
    gold: '#f59e0b',
    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#64748b',
    border: 'rgba(59, 130, 246, 0.15)',
    borderAccent: 'rgba(59, 130, 246, 0.35)',
    danger: '#ef4444',
    warning: '#f59e0b',
  },
};

const RADIUS = { sm: 6, md: 10, lg: 16, xl: 20, pill: 999 };
const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28 };
const FONT = 'Yoruka';

const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 6,
};

const cardShadowLight = {
  shadowColor: 'rgba(0, 0, 0, 0.1)',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 4,
};

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
    backgroundColor: COLOR.dark.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  headerTitle: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '700',
    color: COLOR.dark.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACE.m,
  },
  iconButton: {
    padding: SPACE.s,
    borderRadius: RADIUS.sm,
  },
  filePickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xxl,
  },
  filePickerCard: {
    width: width * 0.8,
    backgroundColor: COLOR.dark.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACE.xxl,
    alignItems: 'center',
    ...cardShadow,
  },
  filePickerIcon: {
    fontSize: 64,
    marginBottom: SPACE.l,
    color: COLOR.dark.accent,
  },
  filePickerTitle: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '700',
    color: COLOR.dark.textPrimary,
    marginBottom: SPACE.s,
    textAlign: 'center',
  },
  filePickerSubtitle: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textSecondary,
    marginBottom: SPACE.xl,
    textAlign: 'center',
  },
  pickButton: {
    backgroundColor: COLOR.dark.accent,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s,
    ...cardShadow,
  },
  pickButtonText: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filePickerIcon: {
    fontSize: 64,
    marginBottom: SPACE.l,
    color: COLOR.dark.accent,
  },
  filePickerText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textSecondary,
  },
  readerContainer: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  pdfContainer: {
    flex: 1,
  },
  epubContainer: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textSecondary,
    marginTop: SPACE.m,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLOR.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  errorText: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.danger,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.xl,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 18,
    color: COLOR.dark.textSecondary,
    textAlign: 'center',
  },
  fileInfo: {
    backgroundColor: COLOR.dark.bgCard,
    padding: SPACE.m,
    marginHorizontal: SPACE.l,
    marginTop: SPACE.m,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileName: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLOR.dark.textPrimary,
    flex: 1,
    marginRight: SPACE.m,
  },
  fileTypeBadge: {
    backgroundColor: COLOR.dark.accentSoft,
    paddingHorizontal: SPACE.s,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.sm,
  },
  fileTypeText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '600',
    color: COLOR.dark.accent,
    textTransform: 'uppercase',
  },
  progressBar: {
    height: 2,
    backgroundColor: COLOR.dark.border,
    marginTop: SPACE.m,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLOR.dark.accent,
  },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.s,
    backgroundColor: COLOR.dark.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  pageIndicatorText: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLOR.dark.textSecondary,
  },
  navigationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACE.m,
    backgroundColor: COLOR.dark.bgElevated,
    borderTopWidth: 1,
    borderTopColor: COLOR.dark.border,
  },
  navButton: {
    backgroundColor: COLOR.dark.bgCard,
    padding: SPACE.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.dark.border,
  },
  navButtonText: {
    fontFamily: FONT,
    fontSize: 14,
    color: COLOR.dark.textPrimary,
  },
  chapterList: {
    flex: 1,
    backgroundColor: COLOR.dark.bg,
  },
  chapterItem: {
    padding: SPACE.m,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  chapterTitle: {
    fontFamily: FONT,
    fontSize: 16,
    color: COLOR.dark.textPrimary,
  },
  chapterActive: {
    backgroundColor: COLOR.dark.accentSoft,
  },
  chapterActiveText: {
    color: COLOR.dark.accent,
  },
  tocContainer: {
    flex: 1,
    backgroundColor: COLOR.dark.bgCard,
  },
  tocItem: {
    padding: SPACE.m,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.dark.border,
  },
  tocTitle: {
    fontFamily: FONT,
    fontSize: 15,
    color: COLOR.dark.textPrimary,
  },
  tocActive: {
    backgroundColor: COLOR.dark.accentSoft,
  },
  tocActiveText: {
    color: COLOR.dark.accent,
  },
  settingsButton: {
    backgroundColor: COLOR.dark.bgCard,
    padding: SPACE.s,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLOR.dark.border,
  },
});
