// WayChain web wallet — REAL Ed25519 auth (issue #10) + write signer (Option X).
//
// ADDRESS MODEL (verified live 2026-07-14):
//   - publicKey  = full 64-hex ed25519 pubkey  -> THIS is the on-wire `from`
//                   AND the account key the node uses (ParsePubKey requires 64-hex).
//   - address    = 20-byte (40-hex) form `pub.slice(0,40)` -> DISPLAY ONLY.
//   - way_getBalance / nonce lookups use the 64-hex pubkey (20-byte returns 0x0).
//   The prior 20-byte-as-account-key assumption was wrong; this file fixes it.
//
// CONFIRM-GATE + EPHEMERAL SIGN (user choice 2026-07-14):
//   - The private seed is persisted to localStorage ONLY as the recovery secret.
//   - It is loaded into in-memory `unlockedSeed` ONLY after the user unlocks,
//     shown a tx-confirm modal, and cleared immediately after broadcast (lock()).
//   - No signing happens without the modal Confirm.
//
// Depends on globals from CDN (loaded before this file):
//   nacl   (tweetnacl)        — ed25519 keygen/sign
//   bip39  (bip39 dist)       — mnemonic <-> seed
// Uses Web Crypto (crypto.subtle.digest) for SHA-256.

(function (global) {
  'use strict';

  const RPC_URL = global.WAYCHAIN_RPC || 'https://api.waychain.org';
  const LS_KEY = 'waychain_account_v1';

  // Ephemeral in-memory seed — set on unlock, cleared on lock/broadcast.
  let unlockedSeed = null;

  function toHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }
  function fromHex(h) {
    h = h.replace(/^0x/, '');
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  const sha256Hex = async (bytes) => {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return toHex(new Uint8Array(buf));
  };

  // Derive { mnemonic, privateKey(0x..64hex seed), publicKey(0x..64hex), address(0x..40hex) }
  async function deriveFromMnemonic(mnemonic) {
    const seed = bip39.mnemonicToSeed(mnemonic.trim(), '');
    const seedBytes = (seed instanceof Uint8Array) ? seed : new Uint8Array(seed);
    const h = await sha256Hex(seedBytes.slice(0, 32).buffer || seedBytes.slice(0, 32));
    const seed32 = fromHex(h).slice(0, 32);
    const kp = nacl.sign.keyPair.fromSeed(seed32);
    const pubHex = toHex(kp.publicKey);
    return {
      mnemonic: mnemonic.trim(),
      privateKey: '0x' + toHex(kp.secretKey),   // 64-hex full secret (seed is first 32)
      seed: '0x' + toHex(seed32),                // 32-byte seed (what we sign with)
      publicKey: '0x' + pubHex,                  // 64-hex — WIRE `from` / account key
      address: '0x' + pubHex.slice(0, 40),       // 20-byte — DISPLAY ONLY
    };
  }

  async function deriveFromPrivateKey(privateKeyHex) {
    let hex = privateKeyHex.replace(/^0x/, '').trim();
    if (hex.length >= 128) hex = hex.slice(0, 64); // 64-byte secret -> take priv part
    if (hex.length !== 64) throw new Error('Private key must be 32 bytes (64 hex chars)');
    const kp = nacl.sign.keyPair.fromSecretKey(fromHex(hex));
    const pubHex = toHex(kp.publicKey);
    return {
      privateKey: '0x' + toHex(kp.secretKey),
      seed: '0x' + toHex(fromHex(hex).slice(0, 32)),
      publicKey: '0x' + pubHex,
      address: '0x' + pubHex.slice(0, 40),
    };
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
  }
  // Persist ONLY non-secret display + recovery mnemonic. The seed is held in memory after unlock.
  function save(acc) {
    localStorage.setItem(LS_KEY, JSON.stringify({
      mnemonic: acc.mnemonic,
      publicKey: acc.publicKey,
      address: acc.address,
      backedUp: acc.backedUp || false,
    }));
    localStorage.setItem('waychain_a', acc.address);
  }
  function clear() { localStorage.removeItem(LS_KEY); unlockedSeed = null; }

  // Unlock: load the seed into memory (ephemeral). Requires either a stored
  // account (re-derive seed from mnemonic) or an explicit private key.
  async function unlock(maybePrivHex) {
    let acc = load();
    if (!acc) throw new Error('No wallet. Connect first to create one.');
    if (maybePrivHex) {
      const d = await deriveFromPrivateKey(maybePrivHex);
      unlockedSeed = d.seed;
      return d;
    }
    if (acc.mnemonic) {
      const d = await deriveFromMnemonic(acc.mnemonic);
      unlockedSeed = d.seed;
      return d;
    }
    throw new Error('Cannot unlock: no mnemonic or private key available.');
  }
  function lock() { unlockedSeed = null; }
  function isUnlocked() { return !!unlockedSeed; }

  async function connect(buttonId) {
    let acc = load();
    if (!acc) {
      const mnemonic = bip39.generateMnemonic
        ? bip39.generateMnemonic()
        : bip39.entropyToMnemonic(toHex(crypto.getRandomValues(new Uint8Array(16))));
      acc = await deriveFromMnemonic(mnemonic);
      acc.mnemonic = mnemonic;
      acc.backedUp = false;
      save(acc);
    }
    global.waychainAccount = acc;
    const btn = buttonId ? document.getElementById(buttonId) : null;
    if (btn) {
      btn.textContent = acc.address.slice(0, 10) + '…' + acc.address.slice(-6) + ' ✓';
      btn.style.borderColor = 'var(--green, #2ecc71)';
      btn.style.color = 'var(--green, #2ecc71)';
    }
    document.dispatchEvent(new CustomEvent('waychain:connected', { detail: acc }));
    return acc;
  }

  // ── Tx confirm modal (injected once) ──
  let modalEl = null;
  function ensureModal() {
    if (modalEl) return modalEl;
    const wrap = document.createElement('div');
    wrap.id = 'wc-tx-modal';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:9999;font-family:Inter,system-ui,sans-serif';
    wrap.innerHTML = `
      <div style="background:#1E1E1E;border:1px solid #3A3A3A;border-radius:12px;max-width:440px;width:92%;padding:22px;color:#E8E4DD;box-shadow:0 10px 40px rgba(0,0,0,.5)">
        <h3 style="margin:0 0 4px;font-size:20px;color:#FFF8F0">Confirm Transaction</h3>
        <p style="margin:0 0 14px;font-size:13px;color:#9A9A9A">Review before broadcasting. Your key stays in memory only for this action.</p>
        <div id="wc-tx-body" style="font-size:14px;line-height:1.7"></div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button id="wc-tx-cancel" style="flex:1;padding:11px;border-radius:8px;border:1px solid #3A3A3A;background:#2A2A2A;color:#E8E4DD;cursor:pointer;font-size:14px">Cancel</button>
          <button id="wc-tx-confirm" style="flex:1;padding:11px;border-radius:8px;border:none;background:#B87333;color:#FFF8F0;cursor:pointer;font-size:14px;font-weight:600">Confirm &amp; Send</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    modalEl = wrap;
    return wrap;
  }

  // Show confirm modal; resolves true on Confirm, false on Cancel.
  function showConfirm(details) {
    return new Promise((resolve) => {
      const m = ensureModal();
      const body = m.querySelector('#wc-tx-body');
      body.innerHTML = details.map(([k, v]) =>
        `<div style="display:flex;justify-content:space-between;gap:12px"><span style="color:#9A9A9A">${k}</span><span style="color:#E8E4DD;word-break:break-all;text-align:right">${v}</span></div>`
      ).join('');
      const close = (val) => { m.style.display = 'none'; resolve(val); };
      m.querySelector('#wc-tx-cancel').onclick = () => close(false);
      m.querySelector('#wc-tx-confirm').onclick = () => close(true);
      m.style.display = 'flex';
    });
  }

  // High-level: build + (confirm) + sign + send a tx. Uses ephemeral unlocked seed.
  // params: { to, valueWei, data?, gasLimit?, gasPrice? }
  // Returns { txHash } on success. Throws if not unlocked or user cancels.
  async function sendTx(params) {
    if (!unlockedSeed) throw new Error('Wallet locked. Call unlock() first.');
    const acc = global.waychainAccount || load();
    if (!acc) throw new Error('No wallet account.');
    const nonce = await global.WayChainTx.getNonce(acc.publicKey);
    const ok = await showConfirm([
      ['From', acc.address],
      ['To', params.to ? (params.to.slice(0, 10) + '…' + params.to.slice(-6)) : '(contract create)'],
      ['Value', String(params.valueWei || 0) + ' wei'],
      ['Nonce', String(nonce)],
      ['Gas', String(params.gasLimit || 21000)],
      ['Data', params.data ? ('0x' + (params.data.length > 16 ? params.data.slice(2, 18) + '…' : params.data.slice(2))) : '0x'],
    ]);
    if (!ok) { lock(); throw new Error('User cancelled'); }

    const built = await global.WayChainTx.buildAndSignTx({
      fromPrivSeedHex: unlockedSeed,
      fromPub64Hex: acc.publicKey,
      to: params.to || '',
      valueWei: params.valueWei || 0,
      nonce,
      gasLimit: params.gasLimit || 21000,
      gasPrice: params.gasPrice || 1,
      data: params.data ? global.WayChainTx.hexToBytes(params.data) : new Uint8Array(0),
    });
    const txHash = await global.WayChainTx.sendRawTransaction(built.rawHex);
    lock(); // clear ephemeral key immediately after broadcast
    return { txHash, rawHex: built.rawHex };
  }

  global.WayChainWallet = {
    RPC_URL, deriveFromMnemonic, deriveFromPrivateKey,
    load, save, clear, connect, unlock, lock, isUnlocked, sendTx,
    toHex, fromHex, sha256Hex,
  };
})(window);
