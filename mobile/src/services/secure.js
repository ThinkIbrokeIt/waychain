// SecureStore-backed persistence: address book, auth prefs, auto-lock, tx log.
// All RN-safe (no Buffer). Address book stored as encrypted-envelope JSON.
import * as SecureStore from 'expo-secure-store';

const ADDR_BOOK_KEY = 'waychain.addressbook.v1';
const AUTH_KEY = 'waychain.auth.v1';
const TXLOG_KEY = 'waychain.txlog.v1';
const LOCK_KEY = 'waychain.lock.v1'; // timestamp of last background

export async function getAddressBook() {
  try { const raw = await SecureStore.getItemAsync(ADDR_BOOK_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
export async function addAddressEntry({ name, address }) {
  const book = await getAddressBook();
  const entry = { name: name.trim(), address: address.trim().replace(/^0x/, ''), addedAt: Date.now() };
  const next = [...book.filter(e => e.address !== entry.address), entry];
  await SecureStore.setItemAsync(ADDR_BOOK_KEY, JSON.stringify(next));
  return next;
}
export async function removeAddressEntry(address) {
  const book = await getAddressBook();
  const next = book.filter(e => e.address !== address.replace(/^0x/, ''));
  await SecureStore.setItemAsync(ADDR_BOOK_KEY, JSON.stringify(next));
  return next;
}

// Auth prefs: { enabled, biometric, pinSet }
export async function getAuthPrefs() {
  try { const raw = await SecureStore.getItemAsync(AUTH_KEY); return raw ? JSON.parse(raw) : { enabled: false, biometric: false, pinSet: false }; }
  catch { return { enabled: false, biometric: false, pinSet: false }; }
}
export async function setAuthPrefs(prefs) {
  await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(prefs));
}

// Local tx log (we record what we send; chain history lookup is by hash).
export async function getTxLog() {
  try { const raw = await SecureStore.getItemAsync(TXLOG_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
export async function addTx(tx) {
  const log = await getTxLog();
  const next = [tx, ...log].slice(0, 100);
  await SecureStore.setItemAsync(TXLOG_KEY, JSON.stringify(next));
  return next;
}

// Auto-lock: record background time; gate on foreground if elapsed > timeout.
export async function markBackground() {
  await SecureStore.setItemAsync(LOCK_KEY, String(Date.now()));
}
export async function getLastBackground() {
  try { const v = await SecureStore.getItemAsync(LOCK_KEY); return v ? Number(v) : 0; }
  catch { return 0; }
}
export const AUTO_LOCK_MS = 60 * 1000; // 60s background -> require auth
