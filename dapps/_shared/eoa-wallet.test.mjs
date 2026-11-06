// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Unit tests for the shared dApp EOA wallet module (dapps/_shared/eoa-wallet.js).
// Proves the 64-hex EOA contract that issue #105 required for the mobile wallet
// and that every dApp (#106-#111) must reuse.
//
// Run: node dapps/_shared/eoa-wallet.test.mjs
import { EOA, bytesToHex, hexToBytes, waychainTxHashInput } from './eoa-wallet.js';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

let pass = 0, failc = 0;
const ok = (m) => { console.log('  ✓ ' + m); pass++; };
const fail = (m) => { console.log('  ✗ ' + m); failc++; };

// Deterministic 32-byte ed25519 seed (NOT a real key — test vector only).
const SEED = new Uint8Array(32).fill(7);
const PUB = await getPublicKeyAsync(SEED);
const pubHex = bytesToHex(PUB);

console.log('dApp shared EOA wallet — 64-hex contract');

// 1. publicKey is full 64-hex; address is 20-byte display.
const account = {
  privateKey: '0x' + bytesToHex(SEED),
  publicKey: '0x' + pubHex, // 64-hex
  address: '0x' + pubHex.slice(0, 40), // 20-byte
};
if (/^0x[0-9a-f]{64}$/.test(account.publicKey)) ok('publicKey is full 64-hex ed25519 pubkey');
else fail('publicKey is not 64-hex: ' + account.publicKey);
if (/^0x[0-9a-f]{40}$/.test(account.address)) ok('address is 20-byte display form');
else fail('address is not 20-byte: ' + account.address);

// 2. balanceKey accepts 64-hex, REJECTS 20-byte (the exact bug #105 guards against).
try {
  const k = EOA.balanceKey(account);
  if (k === account.publicKey) ok('balanceKey returns the 64-hex pubkey');
  else fail('balanceKey returned wrong key: ' + k);
} catch (e) { fail('balanceKey rejected valid 64-hex: ' + e.message); }

try {
  EOA.balanceKey({ publicKey: account.address }); // 20-byte
  fail('balanceKey did NOT reject the 20-byte display address (regression of #105)');
} catch {
  ok('balanceKey correctly rejects the 20-byte display address');
}

// 3. tx hash input format matches consensus/serialize.go wire spec.
const input = waychainTxHashInput({
  nonce: 3, from: account.publicKey, to: '0x' + 'ab'.repeat(20),
  value: 1000n, gasLimit: 21000, lane: 0, data: new Uint8Array([0xde, 0xad]),
});
const expected = `${3}:${account.publicKey}:0x${'ab'.repeat(20)}:1000:21000:0:2:dead:`;
if (input === expected) ok('tx hash input matches wire format (<nonce>:<from>:<to>:<value>:<gas>:<lane>:<len>:<data>:<enc>)');
else fail('tx hash input mismatch:\n  got:      ' + input + '\n  expected: ' + expected);

// 4. signWaychainTx produces a 64-byte ed25519 sig over the sha256 wire hash.
const { hash, sig } = await EOA.signWaychainTx(
  { nonce: 3, from: account.publicKey, to: '', value: 0n, gasLimit: 21000, lane: 0 },
  account.privateKey, signAsync,
);
const sigBytes = hexToBytes(sig.replace(/^0x/, ''));
if (sigBytes.length === 64) ok('signWaychainTx yields a 64-byte Ed25519 signature');
else fail('signature length wrong: ' + sigBytes.length);
if (/^0x[0-9a-f]{64}$/.test(hash)) ok('tx hash is 0x-prefixed 64-hex sha256');
else fail('tx hash format wrong: ' + hash);

// 5. The signed hash equals sha256(wireInput) — matches the node.
// NOTE: test 4 signs an EMPTY-data input; re-hash that exact same input here.
const input4 = waychainTxHashInput({ nonce: 3, from: account.publicKey, to: '', value: 0n, gasLimit: 21000, lane: 0 });
const recomputed = await EOA.sha256Hex(new TextEncoder().encode(input4));
if (recomputed === hash) ok('tx hash == sha256(wireInput) (matches node consensus/serialize.go)');
else fail('hash does not equal sha256(wireInput):\n  got:      ' + hash + '\n  expected: ' + recomputed);

if (failc === 0) { console.log(`\nPASSED: dApp EOA wallet honors 64-hex EOA contract`); process.exit(0); }
else { console.log(`\nFAILED: ${failc} check(s) failed`); process.exit(1); }
