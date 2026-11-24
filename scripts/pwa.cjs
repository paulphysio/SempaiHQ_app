// Make the web build installable ("Install app" on PC, "Add to Home Screen" on iPhone/Android).
//   node scripts/pwa.cjs <web build dir>      (run by scripts/build-web.sh)
// Adds manifest.webmanifest + icons, and the manifest / Apple tags to index.html.
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp-compact');

const OUT = process.argv[2];
if (!OUT || !fs.existsSync(path.join(OUT, 'index.html'))) {
  console.error('pwa: give the web build folder');
  process.exit(1);
}
const BASE = (process.env.SEMPAI_WEB_BASE || '/web-app').replace(/\/$/, '');
const BG = '#0B0B14';
const SRC = path.join(__dirname, '..', 'assets', 'icon.png');

async function icon(size, file, { pad = 0 } = {}) {
  const src = await Jimp.read(SRC);
  const canvas = new Jimp(size, size, BG);
  const inner = Math.round(size * (1 - pad * 2));
  src.resize(inner, inner);
  canvas.composite(src, Math.round((size - inner) / 2), Math.round((size - inner) / 2));
  await canvas.writeAsync(path.join(OUT, 'icons', file));
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
  await icon(192, 'icon-192.png');
  await icon(512, 'icon-512.png');
  await icon(512, 'maskable-512.png', { pad: 0.1 }); // Android crops these to a circle/squircle
  await icon(180, 'apple-touch-icon.png');

  const manifest = {
    name: 'SempaiHQ',
    short_name: 'SempaiHQ',
    description: 'Read novels and manga from independent creators — and earn SMP.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BG,
    theme_color: BG,
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${BASE}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));

  const tags = [
    `<link rel="manifest" href="${BASE}/manifest.webmanifest" />`,
    `<link rel="apple-touch-icon" href="${BASE}/icons/apple-touch-icon.png" />`,
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-title" content="SempaiHQ" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black" />',
  ].join('\n    ');
  const file = path.join(OUT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('rel="manifest"')) html = html.replace('</head>', `    ${tags}\n  </head>`);
  fs.writeFileSync(file, html);
  console.log('pwa: manifest, icons and install tags added');
})().catch((e) => {
  console.error('pwa failed:', e.message);
  process.exit(1);
});
