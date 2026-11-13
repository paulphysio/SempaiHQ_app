import { StyleSheet } from 'react-native';
import { colors, space, radius, type, layout } from '../theme/theme';

const COVER_W = layout.SCREEN_W * 0.46;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  barRight: { flexDirection: 'row', alignItems: 'center' },

  heroWrap: { overflow: 'hidden' },
  heroBackdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.55 },
  heroBody: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl },
  coverShadow: { borderRadius: radius.lg },
  cover: {
    width: COVER_W,
    height: COVER_W * 1.5,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: colors.surfaceHi,
  },
  title: { ...type.hero, textAlign: 'center', marginTop: space.lg },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, paddingVertical: 4 },
  author: { ...type.bodyStrong, color: colors.primaryHi, marginLeft: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },

  section: { paddingHorizontal: layout.gutter },
  statRow: { flexDirection: 'row', marginBottom: space.lg },
  ctaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xl },
  latestBtn: { paddingHorizontal: 16, paddingVertical: 15 },

  summary: { ...type.body, marginTop: 6 },
  more: { ...type.caption, color: colors.primaryHi, fontWeight: '700' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },

  chapterWrap: { paddingHorizontal: layout.gutter, marginBottom: space.sm },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chapterNum: {
    width: 40,
    height: 40,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '22',
    borderWidth: 1,
    borderColor: colors.primary + '66',
  },
  chapterNumText: { ...type.h3, color: colors.primaryHi },
  chapterTitle: { ...type.bodyStrong },
  noChapters: { ...type.body, textAlign: 'center', paddingVertical: space.xl },

  pillWrap: { position: 'absolute', left: layout.gutter, right: layout.gutter, bottom: space.lg },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: space.xl },
  footerText: { ...type.caption },
});
