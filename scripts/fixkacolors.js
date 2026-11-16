const fs = require('fs');
const BUILDER = `
const kaColors = (isDark, c) => isDark ? KA_COLORS_BASE : {
  ...KA_COLORS_BASE,
  bgPrimary: c.bg, bgCard: c.bgCard, bgElevated: c.bgElevated,
  orangePrimary: c.accent, orangeBright: c.accent, orangeSoft: c.accentDeep, orangeDim: c.accentDeep,
  gold: c.gold, goldBright: c.gold,
  ivory: c.textPrimary, ivoryDim: c.textSecondary,
  border: c.border, textPrimary: c.textPrimary, textSecondary: c.textSecondary, textMuted: c.textMuted,
  success: '#16a34a', error: c.danger, warning: c.gold,
};
`;
const MAP = {
  orangePrimary: 'c.accent', orangeBright: 'c.accent', orangeSoft: 'c.accentDeep', orangeDim: 'c.accentDeep',
  gold: 'c.gold', goldBright: 'c.gold', ivory: 'c.textPrimary', ivoryDim: 'c.textSecondary',
  border: 'c.border', textPrimary: 'c.textPrimary', textSecondary: 'c.textSecondary', textMuted: 'c.textMuted',
  bgPrimary: 'c.bg', bgCard: 'c.bgCard', bgElevated: 'c.bgElevated', success: "'#16a34a'", error: 'c.danger', warning: 'c.gold',
};

function addKaColors(p, compNeedle, mapTail) {
  let s = fs.readFileSync(p, 'utf8');
  s = s.replace('const KA_COLORS = {', 'const KA_COLORS_BASE = {');
  const pi = s.indexOf('const KA_COLORS_BASE = {');
  const end = s.indexOf('\n};', pi);
  s = s.slice(0, end + 3) + BUILDER + s.slice(end + 3);
  if (s.includes(compNeedle)) {
    s = s.replace(compNeedle, compNeedle + '\n  const KA_COLORS = useMemo(() => kaColors(isDark, colors), [isDark]);');
  } else console.log('COMP NEEDLE MISS', p);
  if (mapTail) {
    const idx = s.lastIndexOf('StyleSheet.create({');
    let tail = s.slice(idx);
    tail = tail.replace(/KA_COLORS\.(\w+)/g, (m, k) => MAP[k] || m);
    s = s.slice(0, idx) + tail;
  }
  fs.writeFileSync(p, s);
  console.log('done', p);
}

addKaColors('screens/NovelDashboardScreen.js', 'const NovelDashboardScreen = () => {', false);
addKaColors('screens/NovelSummaryScreen.js', 'const NovelSummaryScreen = () => {', false);
