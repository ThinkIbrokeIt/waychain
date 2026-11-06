// Polyfills required to run @noble/ed25519 (and @scure/*) under React Native / Hermes,
// which has NO global `crypto` object (no crypto.getRandomValues, no crypto.subtle).
// Fixes device errors: "crypto.getRandomValues must be defined" / "crypto.subtle must be defined".
//
// React Native's react-native-get-random-values provides globalThis.crypto.getRandomValues,
// but NOT crypto.subtle. @noble/ed25519 v2 async methods call crypto.subtle.digest('SHA-512'...).
// We shim crypto.subtle.digest using @noble/hashes/sha512 (sync, audited) and also point
// noble's utils at it. This must be imported FIRST in index.js, before any noble usage.
import 'react-native-get-random-values';
import { utils } from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';

// Ensure a global crypto object exists (Hermes has none).
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
}

// Provide crypto.subtle.digest backed by @noble/hashes (covers SHA-512 noble needs).
if (typeof globalThis.crypto.subtle === 'undefined') {
  globalThis.crypto.subtle = {
    digest: async (algorithm, data) => {
      const algo = String(algorithm).toUpperCase();
      if (algo.includes('512')) return sha512(new Uint8Array(data));
      if (algo.includes('256')) {
        const { sha256 } = require('@noble/hashes/sha256');
        return sha256(new Uint8Array(data));
      }
      throw new Error('Unsupported digest algorithm: ' + algorithm);
    },
  };
}

// Belt-and-suspenders: point noble's internal sha512 + RNG at our implementations.
utils.sha512 = (...m) => sha512(utils.concatBytes(...m));
if (typeof globalThis.crypto.getRandomValues === 'function') {
  utils.randomBytes = (len) => {
    const out = new Uint8Array(len);
    globalThis.crypto.getRandomValues(out);
    return out;
  };
}

export {};
