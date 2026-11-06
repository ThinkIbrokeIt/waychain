// WIFR Door — web surface logic.
// MIRRORS the mobile WIFRScreen (mobile/src/screens/WIFRScreen.js) so both
// surfaces read the SAME on-chain truth:
//   - same RPC endpoint (https://api.waychain.org)
//   - same methods (way_questPoolRemaining, way_questCap, way_questGetAutopilot,
//     way_taskStatus)
//   - same task-id encoding: 'wifr-bridge'.padEnd(32, ' ') (left-aligned ASCII,
//     32 bytes) — MUST match the mobile exactly or the two surfaces disagree.
//
// The Door flow (identical copy on both):
//   1. Burn 1 WIFR on Solana (PUMP.fun) -> sink.
//   2. Dox_Dev attester witnesses it at CrossChainAttestation (0x1F, "solana-waychain").
//   3. wifr-bridge quest (0x23) opens: 50 WAY from treasury (0x03).

const RPC_URL = 'https://api.waychain.org';
const TASK_ID = 'wifr-bridge';

function encodeTaskId(task) {
  // left-aligned ASCII in 32-byte buffer (chain convention) — matches mobile.
  return task.padEnd(32, ' ');
}

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'rpc error');
  return json.result;
}

function fmtWay(hexOrNum) {
  if (hexOrNum == null) return 'n/a';
  let s = String(hexOrNum).trim();
  if (s.startsWith('0x')) {
    try { return BigInt(s).toLocaleString() + ' WAY'; } catch { return s; }
  }
  return s + ' WAY';
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

async function refreshState() {
  setText('rpc-endpoint', RPC_URL);
  // Treasury 0x03 balance (quest pool remaining)
  try {
    const rem = await rpc('way_questPoolRemaining', []);
    setText('pool-remaining', fmtWay(rem));
  } catch (e) {
    setText('pool-remaining', 'n/a');
  }
  // 5% of live supply cap
  try {
    const cap = await rpc('way_questCap', []);
    setText('quest-cap', fmtWay(cap));
  } catch (e) {
    setText('quest-cap', 'n/a');
  }
  // Autopilot (auto-verify objective quests)
  try {
    const ap = await rpc('way_questGetAutopilot', []);
    setText('autopilot', (ap === '0x01' || ap === true || ap === 1) ? 'set' : 'not set');
  } catch (e) {
    setText('autopilot', 'n/a');
  }
  // 0x1F attestation precompile — deployed live (no way_* count method exposed;
  // report availability, not a fabricated number).
  setText('attest-avail', 'live (precompile 0x1F)');
  const note = document.getElementById('node-note');
  if (note) note.textContent = 'Read-only state from the live WayChain node. No wallet needed.';
}

async function checkDoor() {
  const solTx = (document.getElementById('sol-tx')?.value || '').trim();
  const wcAddr = (document.getElementById('wc-addr')?.value || '').trim();
  const out = document.getElementById('door-result');
  if (!solTx || !wcAddr) {
    out.innerHTML = '<p class="placeholder">Enter both your Solana burn tx and your WayChain address.</p>';
    return;
  }
  out.innerHTML = '<p class="placeholder">Checking wifr-bridge quest status…</p>';
  try {
    const st = await rpc('way_taskStatus', [encodeTaskId(TASK_ID)]);
    const status = (typeof st === 'string') ? st : (st && st.result) || 'none';
    out.innerHTML = `<p><b>wifr-bridge status:</b> ${status}</p>` +
      `<p class="note">Burn witnessed by 0x1F (solana-waychain) → quest opens → 50 WAY from treasury 0x03. ` +
      `Task ID encoding matches the mobile app exactly.</p>`;
  } catch (e) {
    out.innerHTML = `<p class="warn">Could not read status: ${e.message}</p>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refresh-btn')?.addEventListener('click', refreshState);
  document.getElementById('check-btn')?.addEventListener('click', checkDoor);
  refreshState();
  const truth = document.getElementById('truth-note');
  if (truth) truth.textContent = 'This page and the mobile WIFR Door read the same on-chain quest (wifr-bridge, 0x23). One truth, two surfaces.';
});
