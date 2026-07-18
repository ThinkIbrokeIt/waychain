// qrAuth.js — close the QR attack surface (founder: "no holes, grounded before flight").
//
// The scanner must ONLY accept QRs OUR wallet/companion generated. A foreign QR
// (tx-injection / address-substitution) is auto-blocked. We authenticate every
// scannable QR with an HMAC keyed by the user's OWN mnemonic — so only a device
// holding the same seed can produce a QR the scanner will parse.
//
// Scheme (our own, simple, mnemonic-bound):
//   authKey = HMAC-SHA256(seed, "waychain:qr-auth:v1")
//   tag(Q)  = HMAC-SHA256(authKey, Q)        (first 16 hex)
//   emitted QR payload = Q + "#t=" + tag
//   scan: split on "#t=", verify HMAC(Q, authKey) == tag, else BLOCK.

import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { mnemonicToSeedSync } from '@scure/bip39';

function authKeyFor(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic.trim());
  return hmac(sha256, seed, new TextEncoder().encode('waychain:qr-auth:v1'));
}

export function tagQr(mnemonic, payload) {
  const key = authKeyFor(mnemonic);
  const mac = hmac(sha256, key, new TextEncoder().encode(payload));
  return payload + '#t=' + bytesToHex(mac).slice(0, 16);
}

// Returns the verified payload, or null if the QR is NOT ours (auto-blocked).
export function verifyQr(mnemonic, data) {
  if (!data || typeof data !== 'string') return null;
  const hashIdx = data.lastIndexOf('#t=');
  if (hashIdx < 0) return null; // no auth tag -> foreign -> block
  const payload = data.slice(0, hashIdx);
  const tag = data.slice(hashIdx + 3);
  const key = authKeyFor(mnemonic);
  const mac = hmac(sha256, key, new TextEncoder().encode(payload));
  const expected = bytesToHex(mac).slice(0, 16);
  // constant-time-ish compare (lengths equal, 16 hex)
  if (tag.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= tag.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? payload : null;
}

export function hasAuthTag(data) {
  return typeof data === 'string' && data.lastIndexOf('#t=') >= 0;
}
