// Themeify ONLY the trailing `const styles = StyleSheet.create({...})` block of a screen file.
// Usage: node scripts/themeifyScreen.js <screenfile> <ExportName>
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const exportName = process.argv[3] || 'getScreenStyles';
let s = fs.readFileSync(file, 'utf8');

const marker = 'const styles = StyleSheet.create({';
const idx = s.lastIndexOf(marker);
if (idx === -1) { console.log('no stylesheet found'); process.exit(1); }

const head = s.slice(0, idx);
let tail = s.slice(idx);

const REPLACEMENTS = [
  [/#0A0A18|#0B0B14|#0b0b14|#0A0A14|#0c0c0c|#0C0C0C|#0d0d0d|#0D0D0D|#0f0f1a|#0F0F1A|#0a0a0a/gi, 'c.bg'],
  [/#1A1A2E|#15161F|#1a1a1a|#141414|#141210|#12121F|#1A1B26|#1a1714|#1A1A2C|#1c1c28|#1E1E2E/gi, 'c.bgCard'],
  [/#111219|#211c15|#232338|#1f1f30|#262640|#1a1a2e/gi, 'c.bgElevated'],
  [/#2c2419|#2c2c3e|#3d3221|#e7d9bd|#d6c39c|#e8e8e8|#eee\b|#e0e0e0/gi, 'c.border'],
  [/#f0f0f0|#f5f5f5|#f8f8f8|#fafafa|#faf5ea|#f7f7fa|#f7f9fc/gi, 'c.bgCard'],
  [/#F5F5F5|#F0F0F0/gi, 'c.textPrimary'],
  [/#C9C9D1|#ccc\b|#CCCCCC|#b0b0b0|#a8987f|#6d5f49|#a2937a|#8A8A99/gi, 'c.textSecondary'],
  [/#999\b|#999999|#aaa\b|#AAAAAA|#6b5d4f|#777\b|#888\b|#8a8a99/gi, 'c.textMuted'],
  [/#333\b|#333333|#2a2216|#1e293b|#1E293B/gi, 'c.textPrimary'],
  [/#9B59B6|#8e44ad|#9b59b6|#7C5CFF|#6C5CE7|#a55eea|#B388FF|#b388ff|#667eea|#764ba2/gi, 'c.accent'],
  [/#F28C38|#F36316|#ff6200|#FF5733|#E67E22|#e67e22|#FF8C42|#f97316|#ea580c|#c2500f|#d9622b|#cc5500/gi, 'c.accent'],
  [/#EF5350|#e2495f|#c13a52|#FF453A|#ff453a|#dc2626|#e74c3c|#E74C3C|#ff5470|#FF5470/gi, 'c.danger'],
  [/#FFD700|#ffd700|#fbbf24|#c9a84c|#e0b84a|#FFC857|#ffc857|#F59E0B|#f59e0b/gi, 'c.gold'],
];

for (const [re, rep] of REPLACEMENTS) {
  tail = tail.replace(new RegExp("'(" + re.source + ")'", 'gi'), rep);
}
tail = tail.replace(/'rgba\(255,\s*255,\s*255,\s*0?\.?(?:08|0?1|12|16)\)'/gi, 'c.border');

const WHITE_RE = /'#[fF]{3}(?![0-9a-fA-F])'|'#[fF]{6}(?![0-9a-fA-F])'/g;
tail = tail.replace(/(\w+)\s*:\s*\{([^{}]*)\}/g, (m, key, body) => {
  if (/button|btn|confirm|send|badge|chip|active|primary|tab|pill|cta|toggle|switch/i.test(key)) return m;
  return `${key}: {${body.replace(new RegExp('color:\\s*' + WHITE_RE.source, 'g'), 'color: c.textPrimary')}}`;
});
tail = tail.replace(new RegExp('backgroundColor:\\s*' + WHITE_RE.source, 'g'), 'backgroundColor: c.bgCard');
tail = tail.replace(new RegExp('borderColor:\\s*' + WHITE_RE.source, 'g'), 'borderColor: c.bg');
// fix accidental 'color: color:' style doubles
tail = tail.replace(/(\w+): \1:/g, '$1:');
tail = tail.replace(/color: (backgroundColor|borderColor|tintColor): c\.\w+/g, "color: '#fff'");

// wrap
tail = tail.replace(marker, `export const ${exportName} = (c) => StyleSheet.create({`);
fs.writeFileSync(file, head + tail);
console.log(path.basename(file), 'tail transformed');
