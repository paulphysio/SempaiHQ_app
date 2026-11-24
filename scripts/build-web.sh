#!/usr/bin/env bash
# Build the web version of the app and place it in the website project, which
# serves it at sempaihq.com (see SempaiHeadquarters/src/proxy.js).
#   bash scripts/build-web.sh            → builds into ../SempaiHeadquarters/public/web-app
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash on Windows: keep "/web-app" as-is
cd "$(dirname "$0")/.."
OUT="../SempaiHeadquarters/public/web-app"
TMP=".web-build"   # inside the project: Windows Node and Git Bash agree on this path
rm -rf "$TMP"
SEMPAI_WEB_BASE=/web-app npx expo export --platform web --output-dir "$TMP" --clear
# Safety: the web build is public — refuse to publish if a secret slipped in.
if grep -rqE 'sb_secret_[A-Za-z0-9_-]{20,}|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{40,}' "$TMP"; then
  echo "STOP: a secret key is in the web build. Not publishing." >&2; exit 1
fi
SEMPAI_WEB_BASE=/web-app node scripts/pwa.cjs "$TMP"   # installable: manifest, icons, iPhone tags
rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "$TMP"/. "$OUT"/
rm -rf "$TMP"
echo "Web app built into $OUT"
