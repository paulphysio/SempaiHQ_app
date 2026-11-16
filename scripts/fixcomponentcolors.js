const fs = require('fs');
const ORANGE = 'FF5733|F36316|F28C38|ff6200|E67E22|e67e22|ff6b35|ff8a3d|D94F04|cc5500|FF7F50|D94A00|FF6B35|FF9900|f36316';

function patch(file, fn) {
  let s = fs.readFileSync(file, 'utf8');
  const n = fn(s);
  if (n !== s) { fs.writeFileSync(file, n); console.log('patched', file); }
}

// gradient arrays colors={['#X','#Y']} -> colors={[colors.accent, colors.accentDeep]}
const gradRe = new RegExp(`colors=\\{\\[\\s*'#(?:${ORANGE})'\\s*,\\s*'#(?:${ORANGE}|333|999999|777777)'\\s*\\]\\}`, 'g');
const singleRe = new RegExp(`([a-zA-Z]+)=["']#(?:${ORANGE})["']`, 'g');

const files = [
  'components/ConnectButton.js',
  'components/ConnectButtonEnhanced.js',
  'components/WalletPanel.js',
  'components/GoogleSignInButton.js',
  'components/NavigationLoadingOverlay.js',
  'components/TreasuryBalance.js',
  'components/JupiterSwapWebView.js',
  'components/PDFReader.js',
  'components/BalanceModal.js',
  'components/SendModal.js',
];
for (const f of files) {
  patch(f, (s) => s
    .replace(gradRe, (m) => m.includes("'#333'") || m.includes("'#999999'") ? m : 'colors={[colors.accent, colors.accentDeep]}')
    .replace(singleRe, '$1={colors.accent}'));
}

// LoadingButton: default param -> resolve inside
patch('components/LoadingButton.js', (s) => s
  .replace("gradientColors = ['#FF5733', '#F36316'],", 'gradientColors = null,')
  .replace('colors={isDisabled ? [\'#999999\', \'#777777\'] : gradientColors}',
    'colors={isDisabled ? [\'#999999\', \'#777777\'] : (gradientColors || [colors.accent, colors.accentDeep])}'));

// WalletScreen inline bg
patch('screens/WalletScreen.js', (s) => s.replace("backgroundColor: '#D94F04'", 'backgroundColor: colors.accent'));

// ChapterScreen activity indicator
patch('screens/ChapterScreen.js', (s) => s.replace('color="#E67E22"', 'color={colors.accent}'));

// AdminScreen stat color
patch('screens/AdminScreen.js', (s) => s.replace("color: '#ff6200'", 'color: colors.accent'));

// StatPageScreen chart colors
patch('screens/StatPageScreen.js', (s) => s
  .replace(/'#F28C38'/g, 'colors.accent')
  .replace(/'#E67E22'/g, 'colors.accentDeep'));
