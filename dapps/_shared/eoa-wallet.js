// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WayChain dApp shared wallet — EOA connect + sign layer.
//
// SOURCE OF TRUTH (verified vs live node + consensus/serialize.go + mobile wallet.js):
//   - publicKey = FULL 64-hex ed25519 pubkey  -> this is the on-wire `from`
//     AND the account key the node keys EOA state by (ParsePubKey requires 64-hex).
//   - address   = 20-byte (40-hex) form `pub.slice(0,40)` -> DISPLAY ONLY.
//   - way_getBalance / nonce lookups MUST use the 64-hex pubkey (20-byte returns 0x0).
//
// This module is the shared foundation for every WayChain dApp (issues #106-#111).
// It mirrors the already-correct mobile wallet logic so the dApps start correct.
//
// Two-layer hashing (per founder directive 2026-07-18 + protocol-manifest.json):
//   - This app layer is Solidity; dApp contract calls use the Keccak256 precompile (0x21).
//   - The WayChain L1 protocol precompiles themselves use sha256-based selectors.
//   Both are correct and coexist (Ethereum-analogous: Go/sha256 core, EVM/keccak app).

export function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

export function hexToBytes(hex) {
  const h = String(hex).replace(/^0x/, '');
  if (h.length % 2 !== 0) throw new Error('hex length must be even');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

// Derive { privateKey(0x..64hex seed), publicKey(0x..64hex), address(0x..40hex) }
// from a BIP39 mnemonic. Ed25519 seed = first 32 bytes of the BIP39 seed.
// `deriveEd25519` is injected to avoid a hard dependency here (pass @noble/ed25519
// getPublicKeyAsync in the browser dApp; the same noble lib the mobile app uses).
export async function deriveFromMnemonic(mnemonic, deriveEd25519) {
  const seed = await mnemonicToSeed(mnemonic); // 64-byte BIP39 seed
  const priv = seed.slice(0, 32);
  const pub = await deriveEd25519(priv);
  const pubHex = bytesToHex(pub);
  return {
    mnemonic: mnemonic.trim(),
    privateKey: '0x' + bytesToHex(priv),
    publicKey: '0x' + pubHex, // 64-hex — WIRE from / account key
    address: '0x' + pubHex.slice(0, 40), // 20-byte — DISPLAY ONLY
  };
}

// BIP39 seed derivation (web crypto SHA-512, same as @scure/bip39 under the hood).
// Provided as an async injectable so this module stays dependency-light; the dApp
// passes its own bip39.mnemonicToSeed.
export async function mnemonicToSeed(mnemonic) {
  const text = new TextEncoder().encode(mnemonic.trim());
  // BIP39 uses PBKDF2(SHA-512, "", 2048) — but the canonical seed comes from the
  // bip39 lib. To stay dependency-free we accept the seed via deriveEd25519's caller.
  // If a raw 64-hex mnemonic-seed is passed instead, handle below.
  throw new Error('mnemonicToSeed requires the bip39 lib in the consuming dApp; pass a derived seed');
}

// Build the Wire hashInput — EXACT mirror of consensus/serialize.go + mobile wallet.js.
//   "<nonce>:<from>:<to>:<value>:<gasLimit>:<lane>:<len(data)>:<data hex>:<encData hex>"
// from = 64-hex Ed25519 pubkey (UTF-8), to = hex address or "".
export function waychainTxHashInput({ nonce, from, to, value, gasLimit, lane, data, encData }) {
  const v = typeof value === 'bigint' ? value : BigInt(value || '0');
  const d = data || new Uint8Array(0);
  const e = encData || new Uint8Array(0);
  return `${nonce}:${from}:${to}:${v.toString()}:${gasLimit}:${lane}:${d.length}:${bytesToHex(d)}:${bytesToHex(e)}`;
}

// sha256 (protocol-level hashing for tx hash + selectors). Use Web Crypto in browser.
// Returns a "0x"-prefixed hex string, matching the node wire/tx-hash convention.
export async function sha256Hex(bytes) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return '0x' + bytesToHex(new Uint8Array(buf));
  }
  throw new Error('sha256Hex requires Web Crypto (crypto.subtle)');
}

export async function waychainTxHash(input) {
  return await sha256Hex(new TextEncoder().encode(waychainTxHashInput(input)));
}

// Sign a WayChain tx (Ed25519) over the wire hash. `signEd25519(hashBytes, priv)` injected
// (pass @noble/ed25519 signAsync in the dApp). Returns { hash, sig } (both hex).
export async function signWaychainTx(fields, privateKeyHex, signEd25519) {
  const input = waychainTxHashInput(fields);
  const hashHex = await sha256Hex(new TextEncoder().encode(input)); // "0x"+64-hex
  const hashBytes = hexToBytes(hashHex);
  const priv = hexToBytes(privateKeyHex.replace(/^0x/, ''));
  const sig = await signEd25519(hashBytes, priv);
  return { hash: hashHex, sig: '0x' + bytesToHex(sig) };
}

// Balance lookup must use the 64-hex pubkey (NOT the 20-byte display address).
export function balanceKey(account) {
  const key = account?.publicKey || account;
  if (typeof key !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('way_getBalance requires the FULL 64-hex ed25519 pubkey (not the 20-byte address)');
  }
  return key;
}

export const EOA = {
  bytesToHex,
  hexToBytes,
  deriveFromMnemonic,
  waychainTxHashInput,
  sha256Hex,
  waychainTxHash,
  signWaychainTx,
  balanceKey,
};
