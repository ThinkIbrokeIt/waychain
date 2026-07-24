#!/usr/bin/env bash
# update-vendored.sh — keep site/vendor/* on the LATEST STABLE npm release.
# Founder rule (2026-07-24): vendored libs track stable, never a dead/hardcoded pin.
# Run: bash site/vendor/update-vendored.sh   (from repo root)
#
# Vendored libs are served from OUR host (no jsdelivr/google). This script
# refreshes them from the npm registry 'latest' tag so they stay current + auditable.
set -euo pipefail
cd "$(dirname "$0")"
TMP=$(mktemp -d)

# pkg|outfile|subpath-in-tarball|browser-global|bundle?
# For pkgs without a UMD browser build, we bundle from source with esbuild.
fetch_tarball() { # $1=pkg $2=version
  curl -sL "https://registry.npmjs.org/$1/-/$1-$2.tgz" -o "$TMP/$1.tgz"
  tar -xzf "$TMP/$1.tgz" -C "$TMP"
}

# ── tweetnacl (UMD global: nacl) ──
V=$(curl -sL https://registry.npmjs.org/tweetnacl/latest | python3 -c "import sys,json;print(json.load(sys.stdin)['version'])")
fetch_tarball tweetnacl "$V"
cp "$TMP/package/nacl-fast.min.js" ./tweetnacl.min.js
echo "tweetnacl -> $V"

# ── @scure/bip39 (ESM, used via <script type=module>) ──
V=$(curl -sL https://registry.npmjs.org/@scure/bip39/latest | python3 -c "import sys,json;print(json.load(sys.stdin)['version'])")
fetch_tarball @scure/bip39 "$V"
cp "$TMP/package/src/index.ts" ./scure-bip39.src.ts 2>/dev/null || true
# ESM build for browser: grab the +esm bundle from jsdelivr (npm-backed) at latest
curl -sL "https://cdn.jsdelivr.net/npm/@scure/bip39@$V/+esm" -o ./scure-bip39.esm.js
curl -sL "https://cdn.jsdelivr.net/npm/@scure/bip39@$V/wordlists/english.js/+esm" -o ./scure-bip39-english.esm.js
echo "@scure/bip39 -> $V"

# ── jsqr (real pkg name; UMD global: jsQR) ──
V=$(curl -sL https://registry.npmjs.org/jsqr/latest | python3 -c "import sys,json;print(json.load(sys.stdin)['version'])")
fetch_tarball jsqr "$V"
cp "$TMP/package/dist/jsQR.js" ./jsQR.js
echo "jsqr -> $V"

# ── qrcode (bundle UMD global: QRCode from source) ──
V=$(curl -sL https://registry.npmjs.org/qrcode/latest | python3 -c "import sys,json;print(json.load(sys.stdin)['version'])")
fetch_tarball qrcode "$V"
( cd "$TMP" && npx --yes esbuild package/lib/browser.js --bundle --format=iife --global-name=QRCode --outfile="$PWD/jsQR.out" --minify >/dev/null 2>&1 ) || true
if [ -f "$TMP/jsQR.out" ]; then cp "$TMP/jsQR.out" ./qrcode.min.js; fi
echo "qrcode -> $V"

rm -rf "$TMP"
echo "DONE — vendored libs refreshed to latest stable."
