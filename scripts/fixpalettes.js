const fs = require('fs');
function headTail(s){const i=s.lastIndexOf('StyleSheet.create({');return i===-1?[s,'']:[s.slice(0,i),s.slice(i)];}

// WelcomeScreen: ORANGE consts only used inside factory tail
{
  const p='screens/WelcomeScreen.js';let s=fs.readFileSync(p,'utf8');
  const [h,t]=headTail(s);
  fs.writeFileSync(p,h+t.replace(/ORANGE_BRIGHT/g,'c.accent').replace(/\bORANGE\b/g,'c.accentDeep'));
  console.log('WelcomeScreen');
}
// CreatorDashboardScreen: KA_COLORS -> themed
{
  const p='screens/CreatorDashboardScreen.js';let s=fs.readFileSync(p,'utf8');
  s=s.replace('const KA_COLORS = {','const KA_COLORS_BASE = {');
  const pi=s.indexOf('const KA_COLORS_BASE = {');
  const end=s.indexOf('\n};',pi);
  const builder=`
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
  s=s.slice(0,end+3)+builder+s.slice(end+3);
  s=s.replace('const CreatorDashboardScreen = () => {',
    'const CreatorDashboardScreen = () => {\n  const KA_COLORS = useMemo(() => kaColors(isDark, colors), [isDark]);');
  const [h,t]=headTail(s);
  const MAP={orangePrimary:'c.accent',orangeBright:'c.accent',orangeSoft:'c.accentDeep',orangeDim:'c.accentDeep',gold:'c.gold',goldBright:'c.gold',ivory:'c.textPrimary',ivoryDim:'c.textSecondary',border:'c.border',textPrimary:'c.textPrimary',textSecondary:'c.textSecondary',textMuted:'c.textMuted',bgPrimary:'c.bg',bgCard:'c.bgCard',bgElevated:'c.bgElevated',success:"'#16a34a'",error:'c.danger',warning:'c.gold'};
  fs.writeFileSync(p,h+t.replace(/KA_COLORS\.(\w+)/g,(m,k)=>MAP[k]||m));
  console.log('CreatorDashboardScreen');
}
// LeaderboardScreen: COLORS palette inside factory tail + gradients
{
  const p='screens/LeaderboardScreen.js';let s=fs.readFileSync(p,'utf8');
  const [h,t]=headTail(s);
  let nh=h.replace(/colors=\{\['#1A1730', '#0A0A14'\]\}/g,'colors={[colors.bgCardAlt, colors.bg]}')
           .replace(/colors=\{\['#211D38', '#0A0A14'\]\}/g,'colors={[colors.bgCard, colors.bg]}');
  const MAP={bg:'c.bg',surface:'c.bgCard',surfaceRaised:'c.bgElevated',line:'c.border',brand:'c.accent',gem:'c.sakura',textHi:'c.textPrimary',textMid:'c.textSecondary',textLow:'c.textMuted',danger:'c.danger'};
  fs.writeFileSync(p,nh+t.replace(/COLORS\.(\w+)/g,(m,k)=>MAP[k]||m));
  console.log('LeaderboardScreen');
}
// StatusBars
{
  let s=fs.readFileSync('screens/RampScreen.js','utf8');
  s=s.replace(/<StatusBar barStyle="light-content" backgroundColor="#1A1A2E" \/>/,'<StatusBar barStyle={isDark ? \'light-content\' : \'dark-content\'} backgroundColor={colors.bg} />');
  fs.writeFileSync('screens/RampScreen.js',s);
  s=fs.readFileSync('screens/SwapScreen.js','utf8');
  s=s.replace(/<StatusBar barStyle="light-content" backgroundColor="#141414" \/>/,'<StatusBar barStyle={isDark ? \'light-content\' : \'dark-content\'} backgroundColor={colors.bg} />');
  fs.writeFileSync('screens/SwapScreen.js',s);
  console.log('statusbars');
}
