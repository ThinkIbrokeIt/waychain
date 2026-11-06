// App lock: biometric (expo-local-authentication) + PIN fallback.
import * as LocalAuthentication from 'expo-local-authentication';
import { getAuthPrefs, setAuthPrefs } from './secure';
import { sha256 } from '@noble/hashes/sha256';

function hex(b) { let s = ''; for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0'); return s; }

// Hash a PIN (not reversible; we compare hashes).
function pinHash(pin) { return '0x' + hex(sha256(new TextEncoder().encode('waychain:' + pin))); }

export async function isBiometricAvailable() {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

// Prompt biometric; returns true if authenticated.
export async function authenticateBiometric() {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock WayChain',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    return res.success;
  } catch { return false; }
}

// Set a PIN (called from Settings when enabling lock).
export async function setPin(pin) {
  const prefs = await getAuthPrefs();
  prefs.pinSet = true;
  prefs.enabled = true;
  await setAuthPrefs(prefs);
  await storePinHash(pinHash(pin));
}

async function storePinHash(h) {
  const { default: SecureStore } = await import('expo-secure-store');
  await SecureStore.setItemAsync('waychain.pinhash.v1', h);
}

export async function verifyPin(pin) {
  const { default: SecureStore } = await import('expo-secure-store');
  const stored = await SecureStore.getItemAsync('waychain.pinhash.v1');
  return stored === pinHash(pin);
}

// Full unlock attempt: try biometric first, then PIN.
export async function unlock(pin) {
  const prefs = await getAuthPrefs();
  if (!prefs.enabled) return true;
  if (prefs.biometric) {
    const ok = await authenticateBiometric();
    if (ok) return true;
  }
  if (pin !== undefined) return verifyPin(pin);
  return false;
}
