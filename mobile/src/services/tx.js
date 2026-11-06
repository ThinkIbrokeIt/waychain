// WayChain transaction builder + signer (RN/Hermes-safe, no Buffer).
// Format is byte-for-byte compatible with the Go chain (serialize.go / rpc_submit_test.go):
//   hash = sha256("Nonce:From:To:Value:GasLimit:Lane:len(Data):Data:EncryptedData")
//   sig  = ed25519.Sign(priv, hash[:])
//   wire = nonce(u64) fromLen(u16) from toLen(u16) to valueLen(u16) value(u8s)
//          gasLimit(u64) gasPrice(u64) lane(u8) encLen(u32) enc dataLen(u32) data sigLen(u16) sig
import { getPublicKeyAsync, signAsync, verifyAsync } from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';

const CONSENSUS_LANE = 0;

// u64/u32/u16 big-endian writers (Uint8Array).
// NOTE: Hermes/RN DataView may lack setUint64/getUint64 — implement 64-bit manually.
function u64be(v) {
  const hi = Math.floor(Number(v) / 0x100000000);
  const lo = Number(v) >>> 0;
  const b = new Uint8Array(8);
  b[0] = (hi >>> 24) & 0xff; b[1] = (hi >>> 16) & 0xff; b[2] = (hi >>> 8) & 0xff; b[3] = hi & 0xff;
  b[4] = (lo >>> 24) & 0xff; b[5] = (lo >>> 16) & 0xff; b[6] = (lo >>> 8) & 0xff; b[7] = lo & 0xff;
  return b;
}
function u32be(v) { const b = new Uint8Array(4); const n = Number(v) >>> 0; new DataView(b.buffer).setUint32(0, n, false); return b; }
function u16be(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, Number(v) & 0xffff, false); return b; }
function strBytes(s) { return new TextEncoder().encode(s); }
function concatBytes(...arrs) {
  let len = 0; for (const a of arrs) len += a.length;
  const out = new Uint8Array(len); let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// Build the canonical hash input string exactly as Go does.
function hashInput(tx) {
  const dataHex = bytesToHex(tx.data || new Uint8Array(0));
  const encHex = bytesToHex(tx.encryptedData || new Uint8Array(0));
  return [
    tx.nonce,
    tx.from,
    tx.to,
    BigInt(tx.value).toString(),
    tx.gasLimit,
    tx.lane,
    (tx.data || new Uint8Array(0)).length,
    dataHex,
    encHex,
  ].join(':');
}

function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

// Build + sign a transaction. privHex = 0x + 64 hex (32-byte Ed25519 seed).
// fromPub64 = 0x + 64 hex (FULL ed25519 pubkey) — this is the on-wire `from`
// AND the node's account key. ParsePubKey(tx.From) requires 64-hex; the 20-byte
// display address is NOT valid here (verified live 2026-07-14: 20-byte balance=0,
// eth_sendRawTransaction with 20-byte from is rejected). Do NOT pass the 20-byte
// address as fromPub64.
export async function buildAndSignTx({ fromPrivHex, fromPub64, to, valueWei, nonce, gasLimit = 21000, gasPrice = 1, data = new Uint8Array(0), encryptedData = new Uint8Array(0) }) {
  const priv = hexToBytes(fromPrivHex.replace(/^0x/, ''));
  const fromRaw = fromPub64.replace(/^0x/, '');   // 64-hex, no prefix — wire `from`
  const toRaw = (to || '').replace(/^0x/, '');
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
  const hash = sha256(new TextEncoder().encode(hi));
  tx.hash = hash;
  const sig = await signAsync(hash, priv); // ed25519 sign over hash
  tx.signature = sig;

  const raw = serializeTx(tx);
  const rawHex = '0x' + bytesToHex(raw);
  const txHash = '0x' + bytesToHex(hash);
  return { rawHex, txHash, serialized: tx };
}

// Binary wire serialization (matches Go SerializeTx field order).
function serializeTx(tx) {
  const fromB = strBytes(tx.from);
  const toB = strBytes(tx.to || '');
  const valB = bigIntToBytes(tx.value);
  const dataB = tx.data || new Uint8Array(0);
  const encB = tx.encryptedData || new Uint8Array(0);

  return concatBytes(
    u64be(tx.nonce),
    u16be(fromB.length), fromB,
    u16be(toB.length), toB,
    u16be(valB.length), valB,
    u64be(tx.gasLimit),
    u64be(tx.gasPrice),
    new Uint8Array([tx.lane & 0xff]),
    u32be(encB.length), encB,
    u32be(dataB.length), dataB,
    u16be(tx.signature.length), tx.signature,
  );
}

function bigIntToBytes(v) {
  // minimal big-endian byte encoding of a non-negative BigInt
  let hex = v.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  return hexToBytes(hex);
}

function hexToBytes(hex) {
  const h = hex.replace(/^0x/, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}

// Submit via the live node. Returns tx hash on success.
export async function sendRawTransaction(rawHex) {
  const { waychainRPC } = await import('./rpc');
  return waychainRPC.call('eth_sendRawTransaction', [rawHex]);
}

// Get nonce for an address (used to set tx.Nonce correctly).
export async function getNonce(address) {
  try {
    const { waychainRPC } = await import('./rpc');
    const r = await waychainRPC.call('eth_getTransactionCount', [address]);
    if (typeof r === 'string') return parseInt(r, 16) || 0;
    return 0;
  } catch { return 0; }
}
