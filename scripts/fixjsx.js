const fs = require('fs');

const ORANGE = 'F36316|F28C38|ff6200|FF5733|E67E22|e67e22|ff6b35|ff8a3d|D94F04|cc5500|E3A768|F39C12|ffb02e|ffcc44|FFD84D';
const ATTR_RE = new RegExp(`([a-zA-Z]+)=["']#(?:${ORANGE})["']`, 'g');
const ARR_RE = new RegExp(`colors=\\{\\[\\s*'(#(?:${ORANGE}))'\\s*\\]\\}`, 'g');

const files = ['SwapScreen','UserDetailsScreen','RampScreen','WalletImportScreen','ApplyScreen','KaitoLeaderboardScreen','WelcomeScreen','InboxScreen','WalletScreen','ReaderScreen','DownloadScreen','MarketplaceScreen','MintScreen','PrivacyPolicyScreen','StatPageScreen','SupportScreen','TermsScreen','AddGifScreen','KeepItSimpleScreen','KaitoAdventureScreen','AnnouncementsScreen','ChatScreen','BazaarScreen','BazaarBookScreen','BazaarDashboardScreen','UploadBookScreen','LeaderboardScreen','DAOGovernanceScreen'];

for (const f of files) {
  const p = 'screens/' + f + '.js';
  if (!fs.existsSync(p)) { console.log(f, 'missing'); continue; }
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const ssIdx = lines.findIndex(l => l.includes('StyleSheet.create({'));
  // find main component start: first "const X = () => {" or "export default function"
  let compIdx = lines.findIndex(l => /const \w+ = \(\) => \{|export default function|function \w+Screen\(/.test(l));
  if (compIdx === -1) compIdx = 0;
  const end = ssIdx === -1 ? lines.length : ssIdx;
  let changed = 0;
  for (let i = compIdx; i < end; i++) {
    let l = lines[i];
    const nl = l.replace(ATTR_RE, (m, prop) => `${prop}={colors.accent}`)
                 .replace(ARR_RE, 'colors={[colors.accent]}');
    if (nl !== l) { lines[i] = nl; changed++; }
  }
  if (changed) { fs.writeFileSync(p, lines.join('\n')); console.log(f, changed, 'lines fixed'); }
}
