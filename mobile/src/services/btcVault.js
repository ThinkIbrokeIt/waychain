// btcVault.js — mobile-side mirror of consensus/evm/btcwallet.go + way_stablecoin.go
// TRUSTLESS 1WAY vault (issue #78 / PR #79).
//
// The vault's BTC wallet address is DERIVED (not stored): sha256(WayChainMasterPub || domain || vaultID).
// Same sha256 our node uses, so the app shows the exact address the chain verifies against.
// A deposit is only accepted with a proof (txid + outIndex + toAddr == derived address).
// The lock light derives from vaultBTC + vaultDebt:
//   OFF   = vaultBTC == 0
//   RED   = vaultBTC > 0 && vaultDebt > 0   ("DEBT")
//   GREEN = vaultBTC > 0 && vaultDebt == 0  ("1WAY")

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

// MUST match consensus/evm/btcwallet.go WayChainMasterPub.
const WAYCHAIN_MASTER_PUB =
  '0000000000000000000000000000000000000000000000000000000000000000';
const VAULT_BTC_DOMAIN = new TextEncoder().encode('waychain:vault:btc:v1');

function hexToBytes(h) {
  const s = h.replace(/^0x/, '');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
}

export function derivedVaultBTCAddress(vaultIDHex) {
  const vault = hexToBytes(vaultIDHex);
  const master = hexToBytes(WAYCHAIN_MASTER_PUB);
  const h = sha256(new Uint8Array([...master, ...VAULT_BTC_DOMAIN, ...vault]));
  return 'bc1v' + bytesToHex(h);
}

export function pad32(h) {
  return h.replace(/^0x/, '').padStart(64, '0');
}
export function encodeUint256(v) {
  try {
    return BigInt(v).toString(16).padStart(64, '0');
  } catch {
    return '0'.repeat(64);
  }
}
export function encodeUint64(v) {
  try {
    return BigInt(v).toString(16).padStart(16, '0');
  } catch {
    return '0'.repeat(16);
  }
}

// Build the depositBTC calldata args (matches Go wayDepositBTC ABI):
//   vaultID[32] + amount[32] + txid[32] + outIndex[8] + toAddr
// toAddr is auto-filled = derived vault address (the proof target).
export function buildDepositArgs(vaultIDHex, amountSats, txidHex, outIndex, vaultBTCAddress) {
  const toAddrBytes = new TextEncoder().encode(vaultBTCAddress);
  const toHex = bytesToHex(toAddrBytes);
  return (
    pad32(vaultIDHex) +
    encodeUint256(amountSats) +
    pad32(txidHex) +
    encodeUint64(outIndex) +
    toHex
  );
}

// Parse getVault 96-byte result -> { btc, debt, creatorPresent, light, label }
//   light: 'off' | 'red' | 'green'
//   label: '' | 'DEBT' | '1WAY'
export function decodeVault(outHex) {
  const h = outHex.replace(/^0x/, '').padStart(192, '0');
  const btc = BigInt('0x' + h.slice(0, 64) || '0');
  const debt = BigInt('0x' + h.slice(64, 128) || '0');
  const creatorPresent = BigInt('0x' + h.slice(128, 192) || '0');
  let light = 'off';
  let label = '';
  if (btc > 0n) {
    if (debt > 0n) {
      light = 'red';
      label = 'DEBT';
    } else {
      light = 'green';
      label = '1WAY';
    }
  }
  return { btc, debt, creatorPresent, light, label };
}
