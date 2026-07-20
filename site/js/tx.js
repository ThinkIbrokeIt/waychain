// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WayChain web transaction builder + signer (browser port of mobile tx.js).
// Format is byte-for-byte compatible with the Go chain (serialize.go):
//   hash = sha256("nonce:from:to:value:gasLimit:lane:len(data):data:enc")
//   sig  = ed25519.Sign(priv, hash)            // priv = 32-byte seed
//   wire = nonce(u64) fromLen(u16) from toLen(u16) to valueLen(u16) value(u8s)
//          gasLimit(u64) gasPrice(u64) lane(u8) encLen(u32) enc dataLen(u32) data sigLen(u16) sig
//
// CRITICAL (verified live 2026-07-14): the Go node keys EOA accounts by the
// FULL 64-hex public key and runs ParsePubKey(tx.From) on submit — so `from`
// on the wire MUST be the 64-hex pubkey, NOT the 20-byte display address.
// The 20-byte form is display-only. See wallet.js (Option X).
//
// Depends on globals loaded before this file: `nacl` (tweetnacl, ed25519 sign).
// Uses Web Crypto (crypto.subtle.digest) for SHA-256 (available on https).
(function (global) {
  'use strict';

  const CONSENSUS_LANE = 0;
  const RPC = global.WAYCHAIN_RPC || 'https://api.waychain.org';

  // ── big-endian writers ──
  function u64be(v) {
    const n = Number(v);
    const hi = Math.floor(n / 0x100000000);
    const lo = n >>> 0;
    const b = new Uint8Array(8);
    b[0] = (hi >>> 24) & 0xff; b[1] = (hi >>> 16) & 0xff; b[2] = (hi >>> 8) & 0xff; b[3] = hi & 0xff;
    b[4] = (lo >>> 24) & 0xff; b[5] = (lo >>> 16) & 0xff; b[6] = (lo >>> 8) & 0xff; b[7] = lo & 0xff;
    return b;
  }
  function u32be(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, Number(v) >>> 0, false); return b; }
  function u16be(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, Number(v) & 0xffff, false); return b; }
  function strBytes(s) { return new TextEncoder().encode(s); }
  function concat(...arrs) {
    let len = 0; for (const a of arrs) len += a.length;
    const out = new Uint8Array(len); let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
  }
  function bytesToHex(bytes) { let s = ''; for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0'); return s; }
  function hexToBytes(hex) {
    const h = hex.replace(/^0x/, '');
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function bigIntToBytes(v) {
    let hex = v.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return hexToBytes(hex);
  }

  // Build the canonical hash input string EXACTLY as Go's SerializeTx/DeserializeTx:
  //   "%d:%s:%s:%s:%d:%d:%d:%x:%x"
  function hashInput(tx) {
    const dataHex = bytesToHex(tx.data || new Uint8Array(0));
    const encHex = bytesToHex(tx.encryptedData || new Uint8Array(0));
    return [
      tx.nonce,
      tx.from,                       // 64-hex pubkey (wire account key)
      tx.to,                         // 64-hex pubkey OR precompile hex OR '' (empty = contract create)
      BigInt(tx.value).toString(),
      tx.gasLimit,
      tx.lane,
      (tx.data || new Uint8Array(0)).length,
      dataHex,
      encHex,
    ].join(':');
  }

  async function sha256Bytes(bytes) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return new Uint8Array(buf);
  }

  // Build + sign a tx. privSeed = 0x + 64 hex (32-byte ed25519 seed).
  // fromPub64 = 0x + 64 hex (the FULL pubkey — wire `from`).
  // Returns { rawHex, txHash, serialized }.
  async function buildAndSignTx({ fromPrivSeedHex, fromPub64Hex, to, valueWei, nonce, gasLimit = 21000, gasPrice = 1, data = new Uint8Array(0), encryptedData = new Uint8Array(0) }) {
    if (!global.nacl || !global.nacl.sign) throw new Error('tweetnacl not loaded (need nacl.sign)');
    const priv = hexToBytes(fromPrivSeedHex.replace(/^0x/, ''));
    const fromRaw = fromPub64Hex.replace(/^0x/, '');   // 64-hex, no prefix
    const toRaw = (to || '').replace(/^0x/, '');        // 64-hex / precompile hex / ''
    const tx = {
      nonce: Number(nonce),
      from: fromRaw,
      to: toRaw,
      value: BigInt(valueWei),
      gasLimit: Number(gasLimit),
      gasPrice: Number(gasPrice),
      lane: CONSENSUS_LANE,
      data: data instanceof Uint8Array ? data : new Uint8Array(0),
      encryptedData: encryptedData instanceof Uint8Array ? encryptedData : new Uint8Array(0),
    };

    const hi = hashInput(tx);
    const hash = await sha256Bytes(new TextEncoder().encode(hi));
    tx.hash = hash;
    // ed25519 sign over hash with the 32-byte seed (tweetnacl accepts seed or full secret)
    const sig = global.nacl.sign.detached(hash, priv);
    tx.signature = sig;

    const raw = concatBytes(
      u64be(tx.nonce),
      u16be(fromRaw.length), strBytes(fromRaw),
      u16be(toRaw.length), strBytes(toRaw),
      u16be(bigIntToBytes(tx.value).length), bigIntToBytes(tx.value),
      u64be(tx.gasLimit),
      u64be(tx.gasPrice),
      new Uint8Array([tx.lane & 0xff]),
      u32be(tx.encryptedData.length), tx.encryptedData,
      u32be(tx.data.length), tx.data,
      u16be(tx.signature.length), tx.signature,
    );

    return { rawHex: '0x' + bytesToHex(raw), txHash: '0x' + bytesToHex(hash), serialized: tx };
  }

  // Submit via the live node. Returns tx hash on success.
  async function sendRawTransaction(rawHex) {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_sendRawTransaction', params: [rawHex] }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json.result ?? null;
  }

  // Get nonce for an address (used to set tx.Nonce correctly).
  async function getNonce(address64) {
    try {
      const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [address64] }),
      });
      const json = await res.json();
      if (typeof json.result === 'string') return parseInt(json.result, 16) || 0;
      return 0;
    } catch { return 0; }
  }

  global.WayChainTx = { buildAndSignTx, sendRawTransaction, getNonce, bytesToHex, hexToBytes, hashInput };
})(window);
