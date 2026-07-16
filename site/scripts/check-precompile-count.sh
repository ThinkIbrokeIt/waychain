#!/usr/bin/env bash
# Fail if public count artifacts disagree with protocol bool: 27 precompiles (0x0C-0x26).
# Parent: waychain-consensus#23 / #25
set -euo pipefail
cd "$(dirname "$0")/.."
COUNT=$(python3 -c "import json; print(json.load(open('version.json'))['precompile_count'] if False else json.load(open('version.json'))['precompiles'])")
if [ "$COUNT" != "27" ]; then
  echo "::error::version.json precompiles=$COUNT (want 27)"
  exit 1
fi
js_count=$(grep -oE "'0x[0-9A-Fa-f]{2}':" js/precompiles.js | wc -l | tr -d ' ')
if [ "$js_count" != "27" ]; then
  echo "::error::js/precompiles.js entries=$js_count (want 27)"
  exit 1
fi
for f in MARKETING.md declaration.html declaration/index.html telegram-config.md index.html; do
  if grep -nE '20 (native |Live )?precompiles|21 precompiles|"precompiles": 2[012]|0x0C-0x20' "$f"; then
    echo "::error::stale precompile count in $f"
    exit 1
  fi
done
if grep -nE 'Keccak-256 via 0x21|Keccak256.*0x21' docs/index.html; then
  echo "::error::docs still claims Keccak via 0x21"
  exit 1
fi
echo "✅ site precompile count SoT checks passed (27)"
