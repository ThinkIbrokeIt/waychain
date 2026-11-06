#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Prep for funding the 1.1M WAY quest budget into treasury 0x03.
// ISSUE #141 (QUEST-LAUNCH-PLAN.md Phase 2). This script DOES NOT sign or broadcast — it prints the exact
// payload the founder must sign. Signing requires the founder's private key,
// which the agent must never hold.
//
// Target: questFund(uint256 amount)  selector 0xCEA1B2C3
//   calldata = 0xCEA1B2C3 + amount(32 bytes, big-endian)
// Landed at precompile address 0x03 (treasury / TaskRegistry paying source).
//
// IMPORTANT GATES (see issue #70):
//   1. Redeploy current master to AWS 3.89.116.45 FIRST — the live node is
//      stale (way_getBalance(0x03) returned 0x0 and predates recent merges).
//   2. questFund is founder-authorized inflation (mints into 0x03, no source).
//   3. Signing needs the founder's key — agent cannot do it.

const amount = process.argv[2] ? BigInt(process.argv[2]) : 1100000n;

// 18-decimal WAY: 1.1M * 10^18
const wei = amount * 10n ** 18n;

function toHex32(bn) {
  let h = bn.toString(16);
  if (h.length > 64) throw new Error('amount too large');
  return h.padStart(64, '0');
}

const selector = 'cea1b2c3'; // questFund(uint256)
const calldata = '0x' + selector + toHex32(wei);

console.log('=== WayChain quest budget funding (QUEST-LAUNCH-PLAN Phase 2, issue #141) ===');
console.log('amount (WAY):', amount.toString());
console.log('amount (wei, 18dec):', wei.toString());
console.log('target precompile: 0x03 (treasury)');
console.log('method: questFund(uint256)  selector 0xCEA1B2C3');
console.log('calldata:', calldata);
console.log('');
console.log('Tx wire (founder signs, then eth_sendRawTransaction([hexWire])):');
console.log('  to   = 0x03 (precompile address, 20-byte)');
console.log('  data =', calldata);
console.log('  value = 0');
console.log('  from = <founder 64-hex ed25519 pubkey>');
console.log('  lane = 0 (consensus)');
console.log('');
console.log('Verify after (on the DEPLOYED node, not stale):');
console.log('  eth_call questPoolRemaining (0xDF95446F) -> expect 1,100,000 (18dec)');
console.log('');
console.log('GATES: (1) redeploy master to AWS first; (2) founder signs; (3) broadcast.');
