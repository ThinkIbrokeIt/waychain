// WayChain wallet core — REAL implementation
// EOA = Ed25519. Address = hex(publicKey) (64 hex chars), per WayChain chain source.
// Mnemonic = BIP39. Seed (first 32 bytes) feeds Ed25519 (SHA512-based derivation).
// NOTE: WayChain uses sha256 for hashing/selectors, NOT keccak256 (except cross-chain attestation storage).
// RNG/crypto under Hermes is polyfilled in src/services/polyfills.js (imported first in index.js).
import * as SecureStore from 'expo-secure-store';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { getPublicKeyAsync, signAsync } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// RN/Hermes has no global Buffer — use Uint8Array <-> hex helpers.
function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
function hexToBytes(hex) {
  const h = hex.replace(/^0x/, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

export const ACCOUNTS_KEY = 'waychain.accounts.v1';

export function newMnemonic(words = 12) {
  const strength = words === 24 ? 256 : 128;
  return generateMnemonic(wordlist, strength);
}

export function isValidMnemonic(m) {
  return validateMnemonic(m.trim(), wordlist);
}

// Derive Ed25519 keypair from a BIP39 mnemonic.
// Ed25519 seed = first 32 bytes of the BIP39 seed (standard ed25519 HD practice).
// Canonical address = hex(pubkey)[0:40] (20-byte form), per evm/crypto_verify.go
// addrFromPubKey. NOTE: this previously returned the full 64-hex pubkey, which
// does NOT match the chain's StateDB address — fixed to [0:40].
export async function deriveFromMnemonic(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic.trim());
  const priv = seed.slice(0, 32); // 32-byte Ed25519 seed
  const pub = await getPublicKeyAsync(priv);
  const pubHex = bytesToHex(pub);
  return {
    mnemonic: mnemonic.trim(),
    privateKey: '0x' + bytesToHex(priv),
    publicKey: '0x' + pubHex,
    address: '0x' + pubHex.slice(0, 40),
  };
}

// Derive directly from a raw private key (hex, 32 bytes / 64 hex chars, optional 0x).
// Address = hex(pubkey)[0:40] (20-byte canonical form, per chain addrFromPubKey).
export async function deriveFromPrivateKey(privateKeyHex) {
  let hex = privateKeyHex.replace(/^0x/, '').trim();
  if (hex.length === 128) {
    // 64-byte form could be priv||pub or just priv; assume first 32 bytes are priv
    hex = hex.slice(0, 64);
  }
  if (hex.length !== 64) throw new Error('Private key must be 32 bytes (64 hex chars)');
  const priv = hexToBytes(hex);
  const pub = await getPublicKeyAsync(priv);
  const pubHex = bytesToHex(pub);
  return {
    privateKey: '0x' + bytesToHex(priv),
    publicKey: '0x' + pubHex,
    address: '0x' + pubHex.slice(0, 40),
  };
}

// Sign arbitrary message bytes with the private key. Returns 64-byte sig (hex).
export async function sign(privateKeyHex, messageBytes) {
  const priv = hexToBytes(privateKeyHex.replace(/^0x/, ''));
  const sig = await signAsync(messageBytes, priv);
  return '0x' + bytesToHex(sig);
}

// ---- SecureStore-backed multi-account persistence ----

export async function loadAccounts() {
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveAccounts(accounts) {
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function addAccount(account) {
  const accounts = await loadAccounts();
  // avoid duplicates by address
  if (accounts.find(a => a.address === account.address)) return accounts;
  const next = [...accounts, account];
  await saveAccounts(next);
  return next;
}

export async function createAccount(words = 12) {
  const mnemonic = newMnemonic(words);
  const derived = await deriveFromMnemonic(mnemonic);
  const account = { ...derived, label: 'Account ' + ((await loadAccounts()).length + 1), createdAt: Date.now(), backedUp: false };
  await addAccount(account);
  return account;
}

export async function importMnemonic(mnemonic) {
  if (!isValidMnemonic(mnemonic)) throw new Error('Invalid recovery phrase');
  const derived = await deriveFromMnemonic(mnemonic);
  const account = { ...derived, label: 'Account ' + ((await loadAccounts()).length + 1), createdAt: Date.now(), backedUp: true };
  await addAccount(account);
  return account;
}

export async function importPrivateKey(privateKeyHex) {
  const derived = await deriveFromPrivateKey(privateKeyHex);
  const account = { ...derived, label: 'Account ' + ((await loadAccounts()).length + 1), createdAt: Date.now(), backedUp: true };
  await addAccount(account);
  return account;
}

// Mark an account's seed as backed up (user confirmed they saved it).
export async function markBackedUp(address) {
  const accounts = await loadAccounts();
  const next = accounts.map(a => a.address === address ? { ...a, backedUp: true } : a);
  await saveAccounts(next);
  return next;
}

// True only if every account has backedUp === true.
export async function allBackedUp() {
  const accounts = await loadAccounts();
  return accounts.length > 0 && accounts.every(a => a.backedUp);
}

// Namespace export for convenient import { wallet }
export const wallet = {
  newMnemonic,
  isValidMnemonic,
  deriveFromMnemonic,
  deriveFromPrivateKey,
  sign,
  loadAccounts,
  saveAccounts,
  addAccount,
  createAccount,
  importMnemonic,
  importPrivateKey,
  markBackedUp,
  allBackedUp,
};
