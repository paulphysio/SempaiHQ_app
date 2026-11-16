const fs = require('fs');
// For files importing a styles factory, inject useTheme+styles into every
// top-level component whose body references `styles.`
const jobs = [
  ['components/ConnectButton.js', 'getConnectButtonStyles', "import { styles } from '../styles/ConnectButtonStyles';"],
  ['components/ConnectButtonEnhanced.js', 'getConnectButtonStyles', "import { styles } from '../styles/ConnectButtonStyles';"],
  ['components/WalletPanel.js', 'getWalletPanelStyles', "import { styles } from '../styles/WalletPanelStyles';"],
];
for (const [file, getName, imp] of jobs) {
  let s = fs.readFileSync(file, 'utf8');
  const named = imp.match(/import \{ (\w+) \}/)[1];
  s = s.replace(imp, `import { ${getName} } from '../styles/${getName === 'getConnectButtonStyles' ? 'ConnectButtonStyles' : 'WalletPanelStyles'}';`);
  if (!/useMemo/.test(s.split('\n').find(l => /^import React/.test(l)) || '')) {
    s = s.replace(/import React, \{([^}]*)\} from 'react';/, (m, g) => `import React, {${g.trimEnd()}, useMemo } from 'react';`);
  }
  if (!/useTheme/.test(s)) {
    const lines = s.split('\n'); let li = -1;
    lines.forEach((l, i) => { if (/^import\s/.test(l)) li = i; });
    lines.splice(li + 1, 0, "import { useTheme } from '../context/ThemeContext';");
    s = lines.join('\n');
  }
  const lines = s.split('\n');
  // find top-level component declarations and the line where their body starts
  const decls = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^(export )?(const|function) [A-Z]\w*\s*=\s*(\(|function|async)/.test(lines[i]) || /^export const [A-Z]\w* = \(/.test(lines[i])) {
      // signature may span lines; body starts at first line ending with '=> {' or '{' after '=>'
      let j = i;
      while (j < lines.length && !/=>\s*\{\s*$/.test(lines[j]) && !/\{\s*$/.test(lines[j])) j++;
      if (j < lines.length) decls.push({ start: i, body: j });
      i = j;
    }
  }
  // determine each decl's extent: until next decl start or EOF
  for (let d = decls.length - 1; d >= 0; d--) {
    const { start, body } = decls[d];
    const end = d + 1 < decls.length ? decls[d + 1].start : lines.length;
    const bodyText = lines.slice(body + 1, end).join('\n');
    if (/\bstyles\./.test(bodyText)) {
      lines.splice(body + 1, 0, '  const { isDark, colors } = useTheme();', `  const styles = useMemo(() => ${getName}(colors), [isDark]);`);
    }
  }
  fs.writeFileSync(file, lines.join('\n'));
  console.log(file, 'components hooked:', decls.length);
}
