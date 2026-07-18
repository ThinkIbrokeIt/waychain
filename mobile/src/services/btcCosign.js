// btcCosign.js — air-gapped BTC co-sign codec (our own implementation).
//
// Model (inspired by Cardware's QR air-gap pattern, reimplemented cleanly —
// their lib is GPLv3/WASM and NOT copied): the watch-only companion (computer)
// builds an unsigned PSBT, splits it into scannable QR frames; the signer (phone)
// scans, signs, and returns signed-PSBT QR frames; the companion scans those and
// broadcasts. Neither device alone moves BTC.
//
// We use the OPEN UR framing (Blockchain Commons `ur:crypto-psbt` style) with our
// own chunking so frames are scannable + reassemblable. No external GPL code.

const FRAME_PREFIX = 'ur:crypto-psbt/';
const FRAME_SIZE = 120; // chars per QR frame (safe for most scanners)

function bytesToB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  // eslint-disable-next-line no-undef
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(bytes).toString('base64');
}

// Split a PSBT base64 string into numbered UR frames:
//   ur:crypto-psbt/1-3/<chunk>  ... ur:crypto-psbt/3-3/<chunk>
export function encodePsbtFrames(psbtBase64) {
  const total = Math.ceil(psbtBase64.length / FRAME_SIZE);
  const frames = [];
  for (let i = 0; i < total; i++) {
    const chunk = psbtBase64.slice(i * FRAME_SIZE, (i + 1) * FRAME_SIZE);
    frames.push(`${FRAME_PREFIX}${i + 1}-${total}/${chunk}`);
  }
  return frames;
}

// Reassemble PSBT base64 from scanned frames (any order, dedup by index).
export function decodePsbtFrames(frames) {
  const map = {};
  let total = 0;
  for (const f of frames) {
    const m = f.match(/^ur:crypto-psbt\/(\d+)-(\d+)\/(.+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    total = Math.max(total, parseInt(m[2], 10));
    map[idx] = m[3];
  }
  if (Object.keys(map).length !== total || total === 0) return null;
  let out = '';
  for (let i = 1; i <= total; i++) out += map[i] || '';
  return out;
}

// Build a compact co-sign request payload (what the phone shows / computer scans).
// Contains the target + amount + a nonce id; the actual signing uses the PSBT.
export function buildCosignRequest(target, amountBtc, id) {
  return `waychain:cosign/${id}/${target}/${amountBtc}`;
}
