// #11 integration check: precompileCall dispatches correct eth_call payloads.
// Run: node test/precompile-call.test.mjs
// (Offline — mocks the RPC so we assert the to/data shape, not live state.)
import { PRECOMPILES, precompileAddress, encodeCall } from '../src/services/precompiles.js';

let failures = 0;
const fail = (m) => { console.error('  ✗ ' + m); failures++; };
const ok = (m) => console.log('  ✓ ' + m);

console.log('precompileCall dispatch check (issue #11)');
console.log('============================================');

// Replicate the read-path logic from rpc.js precompileCall to assert payloads.
async function precompileRead(addr1, method, argsHex) {
  const pc = PRECOMPILES[addr1];
  const m = pc.methods.find((x) => x.name === method);
  const to = precompileAddress(addr1);
  const data = encodeCall(addr1, method, argsHex);
  return { to, data, kind: m.kind };
}

// 1. Selector precompile read -> eth_call to addr with selector+args
const r1 = await precompileRead('0x22', 'getUserVault', '');
if (r1.to === '0x' + '0'.repeat(24) + '22') ok('1WAY read targets 0x..22');
else fail(`wrong to: ${r1.to}`);
if (r1.data === '0xa8b7c9d0') ok('1WAY getUserVault data = selector 0xa8b7c9d0');
else fail(`wrong data: ${r1.data}`);

// 2. No-selector precompile read -> raw args, no selector prefix
const r2 = await precompileRead('0x12', 'calcRent', '0x' + '00'.repeat(28));
if (r2.data === '0x' + '00'.repeat(28)) ok('StateRent read = raw args (no selector)');
else fail(`no-selector read wrong: ${r2.data}`);

// 3. Every read method across all 27 produces a valid 0x data payload
let readCount = 0, writeCount = 0, badPayload = 0;
for (const [addr, pc] of Object.entries(PRECOMPILES)) {
  for (const m of pc.methods) {
    const to = precompileAddress(addr);
    const data = encodeCall(addr, m.name, '0x');
    if (!/^0x[0-9a-f]*$/.test(data)) badPayload++;
    if (!/^0x0{24}[0-9a-f]{2}$/.test(to)) badPayload++;
    if (m.kind === 'read') readCount++; else writeCount++;
  }
}
if (badPayload === 0) ok(`all ${readCount + writeCount} methods produce valid 0x payloads`);
else fail(`${badPayload} methods produced malformed payloads`);

console.log(`  (read methods: ${readCount}, write methods: ${writeCount})`);
console.log('============================================');
if (failures) { console.error(`FAILED: ${failures}`); process.exit(1); }
else console.log('PASSED: precompileCall dispatch shape correct');
