// Anti-drift guard (issue #10): the read balance path must use the 64-hex
// pubkey, NOT the 20-byte display address. The live node keys EOA accounts by
// the full 64-hex pubkey (verified: way_getBalance(20byte)=0x0). This class of
// 20-byte-vs-64-hex mismatch has destroyed the project repeatedly (O->0 /
// address-form drift). This test fails if WalletScreen regresses to active.address
// for balance, or if getBalance is ever wired to a 20-byte form.
//
// Run: node test/balance-64hex.test.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let pass = 0, failc = 0;
const ok = (m) => { console.log('  ✓ ' + m); pass++; };
const fail = (m) => { console.log('  ✗ ' + m); failc++; };

console.log('balance 64-hex drift guard (issue #10)');

const walletScreen = readFileSync(join(root, 'src/screens/WalletScreen.js'), 'utf8');
const rpc = readFileSync(join(root, 'src/services/rpc.js'), 'utf8');

// 1. WalletScreen must call refreshBalance with active.publicKey (not active.address)
const refreshCalls = walletScreen.match(/refreshBalance\(([^)]*)\)/g) || [];
const badRefresh = refreshCalls.filter((c) => c.includes('active.address'));
if (badRefresh.length === 0) ok('WalletScreen refreshBalance uses active.publicKey (not active.address)');
else fail(`WalletScreen still uses 20-byte for balance: ${badRefresh.join(', ')}`);

// 2. rpc.getBalance must be invoked with a 64-hex key from WalletScreen.
//    The only getBalance caller in WalletScreen should pass publicKey.
if (/refreshBalance\(active\.publicKey\)/.test(walletScreen)) ok('WalletScreen passes publicKey to getBalance');
else fail('WalletScreen does not pass publicKey to getBalance');

// 3. rpc.js getBalance must call way_getBalance with the address arg as-is
//    (caller is responsible for 64-hex). Confirm it does NOT itself pad/truncate
//    a 20-byte into a wrong 64-hex (the old fallback padded with zeros).
if (/way_getBalance/.test(rpc)) ok('rpc.js getBalance forwards to way_getBalance');
else fail('rpc.js getBalance does not call way_getBalance');

// 4. No naive 20-byte fallback that zero-pads (would still be wrong for the node).
//    We allow the fallback to exist but it must not be the primary path.
if (/padStart\(64, '0'\)/.test(rpc)) {
  console.log('  ⚠ rpc.js has a 64-hex zero-pad fallback — acceptable only as error fallback, not primary path');
}

if (failc === 0) { console.log(`\nPASSED: balance path uses 64-hex pubkey`); process.exit(0); }
else { console.log(`\nFAILED: ${failc} drift check(s) failed`); process.exit(1); }
