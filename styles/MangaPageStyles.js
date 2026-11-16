import { StyleSheet } from 'react-native';
import { space, radius, layout } from '../theme/theme';

export const getStyles = ({ colors, type }) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  barRight: { flexDirection: 'row', alignItems: 'center' },

  grid: { paddingBottom: 140 },
  columnWrap: { gap: layout.gridGap, paddingHorizontal: layout.gutter, marginBottom: space.xl },

  bannerWrap: { marginHorizontal: layout.gutter, marginTop: space.lg, borderRadius: radius.xl },
  banner: { borderRadius: radius.xl, padding: space.xl, overflow: 'hidden' },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  bannerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  bannerTagText: { ...type.label, color: colors.gold, marginLeft: 6 },
  bannerSub: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
  bannerAmount: { ...type.hero, fontSize: 30, marginTop: 2 },
  bannerCopy: { ...type.body, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  cdRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg },
  cdCell: {
    minWidth: 52,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cdValue: { ...type.h1, fontSize: 20 },
  cdUnit: { ...type.label, fontSize: 8, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  cdSep: { color: 'rgba(255,255,255,0.6)', fontSize: 18, marginHorizontal: 5 },

  searchWrap: { paddingHorizontal: layout.gutter, marginTop: space.lg },
  chipRail: { paddingHorizontal: layout.gutter, paddingVertical: space.md, gap: space.sm },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    marginBottom: space.md,
  },
  clearText: { ...type.caption, color: colors.primaryHi, fontWeight: '700' },
  progressChip: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.primary + '66',
  },
  progressChipText: { ...type.caption, color: colors.primaryHi, fontWeight: '700', fontSize: 10 },

  pillWrap: { position: 'absolute', left: layout.gutter, right: layout.gutter, bottom: space.lg },
  tileRow: { flexDirection: 'row' },
  quickRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
