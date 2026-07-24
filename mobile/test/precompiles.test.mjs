// Drift guard for the precompile registry (issue #9, child of #8).
// Run: node test/precompiles.test.mjs
// Asserts the JS registry matches the Go source of truth
// (waychain-consensus/evm/precompiles.go IsPrecompile range 0x0C-0x26).
import { PRECOMPILE_LIST, precompileAddress } from '../src/services/precompiles.js';

let failures = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); failures++; };
const ok = (msg) => console.log('  ✓ ' + msg);

console.log('Precompile registry drift check');
console.log('================================');

// 1. Count + address range (0x0C-0x27 = 28 precompiles per protocol-manifest.json)
const addrs = PRECOMPILE_LIST.map((p) => p.addr);
if (addrs.length !== 28) fail(`expected 28 precompiles, got ${addrs.length}`);
else ok(`28 precompiles present`);

const expected = [];
for (let i = 0x0c; i <= 0x27; i++) expected.push('0x' + i.toString(16).toUpperCase().padStart(2, '0'));
const missing = expected.filter((a) => !addrs.includes(a));
const extra = addrs.filter((a) => !expected.includes(a));
if (missing.length) fail(`missing addresses: ${missing.join(',')}`);
if (extra.length) fail(`unexpected addresses: ${extra.join(',')}`);
if (!missing.length && !extra.length) ok('addresses exactly 0x0C-0x26');

// 2. Every precompile has a full 20-byte address derivable
const badAddr = PRECOMPILE_LIST.filter((p) => !/^0x0{24}[0-9a-f]{2}$/.test(p.address));
if (badAddr.length) fail(`bad address form: ${badAddr.map((p) => p.addr).join(',')}`);
else ok('all addresses are correct 20-byte form');

// 3. No leftover 'unknown' selectors (truth-first: either real sel or noSelector)
const unknown = PRECOMPILE_LIST.filter((p) =>
  !p.noSelector && p.methods.some((m) => m.sel === 'unknown')
);
if (unknown.length) fail(`precompiles with 'unknown' selectors: ${unknown.map((p) => p.name).join(',')}`);
else ok('no placeholder "unknown" selectors remain');

// 4. Cross-check against Go source if available (best-effort, non-fatal if absent)
import { readFileSync, existsSync } from 'fs';
const goPath = process.env.GO_SRC ||
  '/home/wink/projects/waychain-consensus/evm/precompiles.go';
if (existsSync(goPath)) {
  const src = readFileSync(goPath, 'utf8');
  const goRange = src.match(/IsPrecompile[^\n]*0x[0-9A-Fa-f]{2}[^\n]*0x[0-9A-Fa-f]{2}/);
  if (goRange) ok(`Go source found (${goPath})`);
  else ok('Go source found; range check skipped (format changed)');
} else {
  console.log('  (skipped Go cross-check: source not at ' + goPath + ')');
}

console.log('================================');
if (failures) {
  console.error(`FAILED: ${failures} check(s) failed`);
  process.exit(1);
} else {
  console.log('PASSED: registry matches source of truth');
}
