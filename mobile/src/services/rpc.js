// WayChain RPC service - connects to native chain
import * as Crypto from 'expo-crypto';
import { deriveFromMnemonic, deriveFromPrivateKey, newMnemonic, sign } from './wallet';

const RPC_URL = 'https://api.waychain.org';

// Decode a 0x-hex bigint string ("0x1a2b") → JS number (safe for UI display
// of counts/totals that fit in a double. Returns 0 on empty/invalid.
export const hexToNum = (hex) => {
  if (!hex || hex === '0x' || hex === '0x0') return 0;
  try {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    // Use BigInt then Number for display; values here are small counts/wei-totals.
    return Number(BigInt('0x' + clean));
  } catch {
    return 0;
  }
};

// Precompile addresses — imported from the shared registry (issue #9).
// Single source of truth: src/services/precompiles.js mirrors
// waychain-consensus/evm/precompiles.go (0x0C–0x26).
import { PRECOMPILES as REGISTRY, precompileAddress, encodeCall } from './precompiles';
import { buildAndSignTx, getNonce, sendRawTransaction } from './tx';

// Backwards-compatible named map for existing call sites.
const PRECOMPILES = {
  BIJO:           precompileAddress('0x14'),
  TWO_WAY:        precompileAddress('0x18'),
  TRUSTLESS_LOCK: precompileAddress('0x1A'),
  GOVERNANCE:     precompileAddress('0x1D'),
  WIFR:           precompileAddress('0x21'),
};

// ABI selectors: WayChain uses sha256(signature)[:4], NOT keccak256.
const SELECTORS = {
  balanceOf: '0x5b46f8f6',
};

export const waychainRPC = {
  call: async (method, params) => {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'RPC error');
    return json.result ?? null;
  },

  // Wallet P3 panel reads. These call the read-only way_* methods added to
  // waychain-consensus (rpc.go). They throw if the live RPC lacks the method,
  // so callers can fall back to the honest FeaturePending panel.
  getGovernanceProposals: async () => {
    const r = await waychainRPC.call('way_govProposals', []);
    return Array.isArray(r) ? r : [];
  },
  getTwoWayStats: async () => {
    const r = await waychainRPC.call('way_twoWayStats', []);
    if (!r || typeof r !== 'object') throw new Error('no twoWayStats');
    return {
      vaults: hexToNum(r.vaults),
      totalDebt: hexToNum(r.totalDebt),
    };
  },
  getBridgeStats: async () => {
    const r = await waychainRPC.call('way_bridgeStats', []);
    if (!r || typeof r !== 'object') throw new Error('no bridgeStats');
    return {
      committed: hexToNum(r.committed),
      withdrawn: hexToNum(r.withdrawn),
    };
  },

  // WayChain native balance method (per AGENTS.md RPC endpoints)
  getBalance: async (address) => {
    try {
      const res = await waychainRPC.call('way_getBalance', [address]);
      return res;
    } catch {
      // fallback to eth_call on BIJO precompile (sha256 selector)
      const addrHex = address.replace(/^0x/, '').toLowerCase().padStart(64, '0');
      const data = SELECTORS.balanceOf + addrHex;
      return waychainRPC.call('eth_call', [{ to: PRECOMPILES.BIJO, data }]);
    }
  },

  getAddressFromKey: (privateKey) => {
    // Delegate to real derivation; caller should use wallet.deriveFromPrivateKey instead.
    return privateKey;
  },

  // Real wallet creation: BIP39 mnemonic -> Ed25519 -> WayChain address
  generateKeyPair: async (words = 12) => {
    const mnemonic = newMnemonic(words);
    return deriveFromMnemonic(mnemonic);
  },

  sign,

  // ── Per-precompile call layer (issue #11, child of #8) ──
  // Unified read/write entrypoint for all 27 precompiles, built on the
  // shared registry (#9) + real auth (#10) + tx pipeline (tx.js).
  //
  //   precompileCall('0x22', 'createVault', '0x'+vaultId, { write:true, privHex, pub64 })
  //   precompileCall('0x14', 'balanceOf', addrHex)   // read
  //
  // READ:  eth_call to the precompile address with encodeCall(...) data.
  // WRITE: get nonce -> build+sign tx -> eth_sendRawTransaction.
  precompileCall: async (addr1, method, argsHex = '', opts = {}) => {
    const pc = REGISTRY[addr1];
    if (!pc) throw new Error(`Unknown precompile ${addr1}`);
    const m = pc.methods.find((x) => x.name === method);
    if (!m) throw new Error(`Unknown method ${method} on ${pc.name}`);
    const to = precompileAddress(addr1);
    const data = encodeCall(addr1, method, argsHex);

    if (m.kind === 'read' && !opts.write) {
      return waychainRPC.call('eth_call', [{ to, data }]);
    }
    // WRITE path
    if (!opts.privHex || !opts.pub64) throw new Error('write requires { privHex, pub64 }');
    const nonce = await getNonce(opts.pub64);
    const { rawHex } = await buildAndSignTx({
      fromPrivHex: opts.privHex,
      fromPub64: opts.pub64,
      to,
      valueWei: 0,
      nonce,
      data: hexToBytesLocal(data),
    });
    return sendRawTransaction(rawHex);
  },
};

// Local hex->bytes (rpc.js has no Buffer; precompileCall needs it for tx data).
function hexToBytesLocal(hex) {
  const h = hex.replace(/^0x/, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

export default waychainRPC;
