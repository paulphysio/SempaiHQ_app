const fs = require('fs');
const files = ['ApplyScreen','CreatorDashboardScreen','DAOGovernanceScreen','KaijiScreen','KaitoLeaderboardScreen','LeaderboardScreen','RampScreen','UserDetailsScreen'].map(n=>'screens/'+n+'.js');
const MAP = [
  [/#[0-9a-fA-F]{6}\b/g, (m) => {
    const h = m.toLowerCase();
    const map = {
      '#0d1117':'c.bg','#161b22':'c.bgCard','#21262d':'c.bgCardAlt','#30363d':'c.bgElevated',
      '#0d0d12':'c.bg','#1c1c26':'c.bgCard','#1a1a24':'c.bgCard','#16213e':'c.bgCard','#2a2a3e':'c.bgCard',
      '#14141c':'c.bgElevated','#23232f':'c.bgElevated','#1a0900':'c.bgElevated','#7a2600':'c.bgElevated',
      '#ff9a3d':'c.accent','#ff6200':'c.accent','#d94f04':'c.accent','#cd7f32':'c.gold',
      '#888888':'c.textMuted','#666666':'c.textMuted','#666666':'c.textMuted',
      '#c0c0c0':'c.textSecondary'
    };
    return map[h] || m;
  }]
];
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const idx = s.lastIndexOf('StyleSheet.create({');
  let tail = s.slice(idx);
  tail = tail.replace(/'#[0-9a-fA-F]{3,8}'|"#[0-9a-fA-F]{3,8}"/g, (m) => {
    const q = m[0], hex = m.slice(1, -1);
    const mapped = MAP[0][1](hex);
    return mapped === hex ? m : q + mapped + q;
  });
  // also unquoted? tokens only appear quoted
  fs.writeFileSync(f, s.slice(0, idx) + tail);
}
const hexes = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const tail = s.slice(s.lastIndexOf('StyleSheet.create({'));
  for (const m of tail.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) hexes.add(m[0]);
}
console.log([...hexes].join(' '));
