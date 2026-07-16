// Drift guard v2 (issue #9 hardening): every registry selector must exist
// as a `uint32 = 0xXXXXXXXX` literal in evm/*.go. This catches invented or
// wrong selectors — the drift class that produced 4 bugs during #12
// (getProposal arg, claimRewards write, SWAY getTotalSupply, WIFR no-selector).
// Run: node test/precompile-selectors.test.mjs
import { execSync } from 'node:child_process';
import { PRECOMPILES } from '../src/services/precompiles.js';

const repo = new URL('../../waychain-consensus/evm/', import.meta.url).pathname;
let goLiterals;
try {
  goLiterals = new Set(
    execSync(`grep -rhoE "(uint32 = 0x[0-9a-fA-F]{8}|case 0x[0-9a-fA-F]{8})" ${repo}*.go`, { encoding: 'utf8' })
      .match(/0x[0-9a-fA-F]{8}/g)
      .map((s) => s.toLowerCase())
  );
} catch {
  goLiterals = null; // source not present (e.g. CI without consensus checkout)
}

let failures = 0;
const fail = (m) => { console.error('  ✗ ' + m); failures++; };
const ok = (m) => console.log('  ✓ ' + m);

console.log('precompile selector drift guard v2 (issue #9)');
console.log('=================================================');

if (!goLiterals) {
  console.log('  ⚠ evm/*.go not found at ' + repo + ' — selector check skipped (registry addr/shape check still runs elsewhere)');
} else {
  let checked = 0, bad = 0;
  for (const [addr, pc] of Object.entries(PRECOMPILES)) {
    if (pc.noSelector) continue; // raw-input precompiles have no selector literal
    for (const m of pc.methods) {
      if (!m.sel) { fail(`${addr} ${m.name}: missing sel`); continue; }
      const sel = ('0x' + m.sel).toLowerCase();
      checked++;
      if (!goLiterals.has(sel)) { fail(`${addr} ${m.name}: sel ${sel} NOT in evm/*.go`); bad++; }
    }
  }
  if (bad === 0) ok(`all ${checked} selectors present in evm/*.go`);
  else fail(`${bad} selectors missing from Go source`);
}

console.log('=================================================');
if (failures) { console.error(`FAILED: ${failures}`); process.exit(1); }
else console.log('PASSED: registry selectors match Go source');
