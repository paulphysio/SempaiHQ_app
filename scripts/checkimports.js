const fs = require('fs'), path = require('path');
function walk(d, acc) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!['node_modules', '.git', 'android', 'ios', 'kaiji-clean', 'kaiji-clean-new'].includes(f)) walk(p, acc); }
    else if (/\.(js|jsx)$/.test(f)) acc.push(p);
  }
  return acc;
}
const files = walk('.', []);
const problems = [];
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]*styles\/[^'"]+)['"]/g)) {
    const names = m[1].split(',').map(x => x.trim().split(' as ')[0].trim()).filter(Boolean);
    let target = m[2];
    if (!target.startsWith('.')) continue;
    target = path.normalize(path.join(path.dirname(f), target));
    let found = null;
    for (const ext of ['.js', '.jsx', '/index.js']) if (fs.existsSync(target + ext)) { found = target + ext; break; }
    if (!found) { problems.push(f + ' -> MISSING ' + m[2]); continue; }
    const ts = fs.readFileSync(found, 'utf8');
    for (const n of names) {
      const re = new RegExp('export\\s+(?:const|let|var|function|class|async function)\\s+' + n + '\\b|export\\s*\\{[^}]*\\b' + n + '\\b');
      if (!re.test(ts)) problems.push(f + ' -> ' + n + ' NOT exported by ' + found);
    }
  }
  for (const m of s.matchAll(/import\s+(\w+)\s+from\s*['"]([^'"]*styles\/[^'"]+)['"]/g)) {
    let target = m[2];
    if (!target.startsWith('.')) continue;
    target = path.normalize(path.join(path.dirname(f), target));
    let found = null;
    for (const ext of ['.js', '.jsx', '/index.js']) if (fs.existsSync(target + ext)) { found = target + ext; break; }
    if (found) {
      const ts = fs.readFileSync(found, 'utf8');
      if (!/export\s+default/.test(ts)) problems.push(f + ' -> default import, no default export in ' + found);
    }
  }
}
console.log(problems.length ? problems.join('\n') : 'all style imports resolve');
