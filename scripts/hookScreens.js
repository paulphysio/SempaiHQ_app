const fs = require('fs');
const jobs = [
  ['screens/ApplyScreen.js','getApplyStyles','ApplyScreen'],
  ['screens/CreatorDashboardScreen.js','getCreatorDashStyles','CreatorDashboardScreen'],
  ['screens/DAOGovernanceScreen.js','getDAOStyles','DAOGovernanceScreen'],
  ['screens/KaijiScreen.js','getKaijiStyles','KaijiScreen'],
  ['screens/KaitoLeaderboardScreen.js','getKaitoLbStyles','KaitoLeaderboardScreen'],
  ['screens/LeaderboardScreen.js','getLeaderboardStyles','LeaderboardScreen'],
  ['screens/RampScreen.js','getRampStyles','RampScreen'],
  ['screens/UserDetailsScreen.js','getUserDetailsStyles','UserDetailsScreen'],
];
for (const [file, getName, comp] of jobs) {
  let s = fs.readFileSync(file, 'utf8');
  // ensure useMemo in react import
  if (!/useMemo/.test(s.split('\n').find(l=>/^import React/.test(l))||'')) {
    s = s.replace(/import React, \{([^}]*)\} from 'react';/, (m,g)=>`import React, {${g.trimEnd()}, useMemo } from 'react';`);
  }
  if (!/useTheme/.test(s)) {
    const lines = s.split('\n');
    let li = -1;
    lines.forEach((l,i)=>{ if(/^import\s/.test(l)) li=i; });
    lines.splice(li+1, 0, "import { useTheme } from '../context/ThemeContext';");
    s = lines.join('\n');
  }
  const needle = `const ${comp} = () => {`;
  if (s.includes(needle)) {
    s = s.replace(needle, `${needle}\n  const { isDark, colors } = useTheme();\n  const styles = useMemo(() => ${getName}(colors), [isDark]);`);
    fs.writeFileSync(file, s);
    console.log(file, 'hooked');
  } else console.log(file, 'NEEDLE MISSING');
}
