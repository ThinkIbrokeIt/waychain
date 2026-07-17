// WayChain Explorer — Phase 2 frontend (clean client over the EXPL-8 API).
//
// Truth-first: every number comes from /api/*. Nothing is hardcoded.
// If a field is missing from the API, it renders as "—" (never a fake).
// API surface (see explorer/api/server.go):
//   GET /api/stats                 -> {blocks, transactions, addresses, pending}
//   GET /api/blocks?limit=&offset= -> [BlockRow]
//   GET /api/block/:n              -> {block, transactions}
//   GET /api/tx/:hash             -> {tx, logs}
//   GET /api/address/:addr        -> {address, balance, txCount, txs}
//   GET /api/search?q=            -> {type, result}
//   GET /api/logs?address=&topic0= -> [LogRow]
//
// API_BASE is configurable for cross-origin deployment (static site on Vercel
// calling the API service). Default: same-origin "/api". Override with
// ?api=https://explorer-api.waychain.org or set window.EXPLORER_API_BASE.

const params = new URLSearchParams(window.location.search);
const API_BASE = (window.EXPLORER_API_BASE
  || params.get('api')
  || '/api').replace(/\/?$/, '/');

const REFRESH_MS = 8000;
const BLOCKS_TO_SHOW = 20;

// ── helpers ──
function $(id) { return document.getElementById(id); }

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

async function api(path) {
  const res = await fetch(API_BASE + path, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function hexToNum(h) {
  if (h === null || h === undefined) return 0;
  if (typeof h === 'number') return h;
  const s = String(h).startsWith('0x') ? String(h).slice(2) : String(h);
  if (!s) return 0;
  const n = parseInt(s, 16);
  return isNaN(n) ? 0 : n;
}

// Convert a hex value (in smallest unit) to a human WAY string.
// WayChain native unit: 1 WAY = 1e18 (same as ETH-style 18-decimals per the
// node's big.Int text encoding). We show fractional only when meaningful.
function toWAY(hexVal) {
  const s = String(hexVal || '0x0').startsWith('0x') ? String(hexVal).slice(2) : String(hexVal);
  if (!s) return '0';
  // value is hex of a big.Int; parse as BigInt for precision.
  let bi;
  try { bi = BigInt('0x' + s); } catch { return '0'; }
  const WAY = 1000000000000000000n;
  const whole = bi / WAY;
  const frac = bi % WAY;
  if (frac === 0n) return whole.toString();
  // up to 6 decimal places
  let f = frac.toString().padStart(18, '0').slice(0, 6).replace(/0+$/, '');
  return f ? whole.toString() + '.' + f : whole.toString();
}

function ago(unixSec) {
  const sec = Math.floor(Date.now() / 1000 - unixSec);
  if (!isFinite(sec) || sec < 0) return '—';
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
  return Math.floor(sec / 86400) + 'd ago';
}

function short(h, len = 10) {
  if (!h) return '—';
  const s = h.replace('0x', '');
  if (s.length <= len * 2) return h;
  return '0x' + s.slice(0, len) + '…' + s.slice(-len);
}

// addrLink renders a clickable address (→ showAddress). Truth-first: an empty
// value (contract creation) renders as plain text, never a dead link.
function addrLink(addr, len = 8) {
  if (!addr) return '—';
  const a = String(addr);
  if (a.startsWith('<span')) return a; // already-rendered placeholder
  return `<a class="addr clickable" onclick="showAddress('${encodeURIComponent(a)}')">${short(a, len)}</a>`;
}

function log(msg, cls = 'info') {
  const box = $('log');
  const d = el('div', cls, `[${new Date().toLocaleTimeString()}] ${msg}`);
  box.prepend(d);
  while (box.children.length > 60) box.removeChild(box.lastChild);
}

// Status pill is driven by two independent signals:
//   - REST API reachability -> "Connected" (blocks load via polling)
//   - WebSocket established  -> "Live" (real-time new-block push)
// A dead WebSocket must NOT flip the pill to "Offline" — polling still
// serves live data. "Offline" means REST itself is unreachable.
let restUp = false;
let restChecked = false;
let wsLive = false;

function renderStatus() {
  const dot = $('statusDot'), txt = $('statusText');
  if (!dot || !txt) return;
  if (!restChecked) { txt.textContent = 'Connecting…'; return; }
  if (!restUp) {
    dot.className = 'status-dot offline';
    txt.textContent = 'Offline';
    return;
  }
  dot.className = 'status-dot online';
  txt.textContent = wsLive ? 'Live' : 'Connected';
}

function setStatus(online) {
  restUp = online;
  restChecked = true;
  renderStatus();
}

// ── rendering ──
function renderStats(s) {
  $('statBlocks').textContent = (s.blocks ?? 0).toLocaleString();
  $('statTxs').textContent = (s.transactions ?? 0).toLocaleString();
  $('statAddrs').textContent = (s.addresses ?? 0).toLocaleString();
  $('statPending').textContent = (s.pending ?? 0).toLocaleString();
}

function renderBlocks(blocks) {
  const tb = $('blocksTable');
  tb.innerHTML = '';
  if (!blocks || blocks.length === 0) {
    tb.innerHTML = '<tr><td colspan="5" style="color:var(--fg2);text-align:center">No blocks indexed yet</td></tr>';
    return;
  }
  blocks.forEach(b => {
    const tr = el('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => showBlock(b.Height);
    tr.innerHTML = `
      <td><a>${b.Height?.toLocaleString() ?? '—'}</a></td>
      <td class="hash">${short(b.Hash, 10)}</td>
      <td>${b.Proposer || '—'}</td>
      <td>${b.TxCount ?? 0}</td>
      <td style="color:var(--fg2)">${ago(hexToNum(b.Timestamp))}</td>`;
    tb.appendChild(tr);
  });
}

function showBlock(n) {
  api('/block/' + n).then(d => {
    const b = d.block;
    if (!b) { openDetail('Block #' + n, '<div class="red">Not found</div>'); return; }
    const txs = d.transactions || [];
    let txHtml = '<div style="color:var(--fg2);font-size:.75em">No transactions in this block</div>';
    if (txs.length) {
      txHtml = '<table><thead><tr><th>Hash</th><th>From</th><th>To</th><th>Value</th></tr></thead><tbody>';
      txs.forEach(t => {
        txHtml += `<tr onclick="showTx('${t.Hash}')" style="cursor:pointer">
          <td class="hash clickable">${short(t.Hash, 10)}</td>
          <td class="addr">${addrLink(t.From, 8)}</td>
          <td class="addr">${addrLink(t.To, 8)}</td>
          <td>${toWAY(t.Value)} WAY</td></tr>`;
      });
      txHtml += '</tbody></table>';
    }
    openDetail('⧫ Block #' + b.Height?.toLocaleString(), `
      <div class="detail">
        <div class="row"><div class="label">Height</div><div class="value">${b.Height?.toLocaleString()}</div></div>
        <div class="row"><div class="label">Hash</div><div class="value hash-value">${b.Hash || '—'}</div></div>
        <div class="row"><div class="label">Parent</div><div class="value hash-value">${b.Parent || '—'}</div></div>
        <div class="row"><div class="label">Proposer</div><div class="value">${addrLink(b.Proposer, 12) || '—'}</div></div>
        <div class="row"><div class="label">Time</div><div class="value">${ago(hexToNum(b.Timestamp))}</div></div>
        <div class="row"><div class="label">Txs</div><div class="value">${b.TxCount ?? 0}</div></div>
      </div>
      <h3 style="margin-top:15px">Transactions</h3>
      ${txHtml}`);
  }).catch(e => openDetail('Block #' + n, `<div class="red">${e.message}</div>`));
}

function showTx(hash) {
  api('/tx/' + encodeURIComponent(hash)).then(d => {
    const t = d.tx;
    if (!t) { openDetail('Transaction', '<div class="red">Not found</div>'); return; }
    const fee = (BigInt(hexToNum(t.GasUsed)) * BigInt(hexToNum(t.GasPrice))).toString();
    let feeStr = '—';
    try { feeStr = toWAY('0x' + BigInt(fee).toString(16)) + ' WAY'; } catch {}
    const logs = d.logs || [];
    let logHtml = '<div style="color:var(--fg2);font-size:.75em">No logs</div>';
    if (logs.length) {
      logHtml = '<table><thead><tr><th>Address</th><th>Topics</th><th>Data</th></tr></thead><tbody>';
      logs.forEach(l => {
        logHtml += `<tr>
          <td class="addr">${addrLink(l.Address, 8)}</td>
          <td class="addr">${(l.Topics || []).map(x => short(x, 6)).join('<br>')}</td>
          <td class="addr">${short(l.Data, 6)}</td></tr>`;
      });
      logHtml += '</tbody></table>';
    }
    openDetail('⧫ Transaction', `
      <div class="detail">
        <div class="row"><div class="label">Hash</div><div class="value hash-value">${t.Hash}</div></div>
        <div class="row"><div class="label">From</div><div class="value hash-value">${addrLink(t.From, 12)}</div></div>
        <div class="row"><div class="label">To</div><div class="value hash-value">${t.To ? addrLink(t.To, 12) : '<span class="yellow">Contract Creation</span>'}</div></div>
        <div class="row"><div class="label">Value</div><div class="value">${toWAY(t.Value)} WAY</div></div>
        <div class="row"><div class="label">Nonce</div><div class="value">${t.Nonce ?? '—'}</div></div>
        <div class="row"><div class="label">Gas Used</div><div class="value">${(t.GasUsed ?? 0).toLocaleString()}</div></div>
        <div class="row"><div class="label">Gas Price</div><div class="value">${hexToNum(t.GasPrice).toLocaleString()} wei</div></div>
        <div class="row"><div class="label">Fee (native)</div><div class="value">${feeStr}</div></div>
        <div class="row"><div class="label">Fiat</div><div class="value">—</div></div>
      </div>
      <h3 style="margin-top:15px">Logs</h3>${logHtml}`);
  }).catch(e => openDetail('Transaction', `<div class="red">${e.message}</div>`));
}

function showAddress(addr) {
  api('/address/' + encodeURIComponent(addr)).then(d => {
    const bal = d.balance || '0x0';
    const balNum = hexToNum(bal);
    const isZero = balNum === 0;
    const rows = (d.txs || []).map(t => `
      <tr onclick="showTx('${t.Hash}')" style="cursor:pointer">
        <td class="hash clickable">${short(t.Hash, 10)}</td>
        <td class="addr">${addrLink(t.From, 8)}</td>
        <td class="addr">${addrLink(t.To, 8)}</td>
        <td>${toWAY(t.Value)} WAY</td>
        <td style="color:var(--fg2)">${ago(hexToNum(t.Timestamp))}</td>
      </tr>`).join('');
    const txHtml = rows || '<div style="color:var(--fg2);font-size:.75em">No transactions</div>';
    openDetail('⧫ Account', `
      <div class="detail">
        <div class="row"><div class="label">Address</div><div class="value hash-value">${addr}</div></div>
        <div class="row"><div class="label">Balance</div><div class="value">${toWAY(bal)} WAY${isZero ? ' <span style="color:var(--fg2)">(no activity / zero)</span>' : ''}</div></div>
        <div class="row"><div class="label">Tx Count</div><div class="value">${d.txCount ?? 0}</div></div>
      </div>
      <h3 style="margin-top:15px">Transactions</h3>
      <table><thead><tr><th>Hash</th><th>From</th><th>To</th><th>Value</th><th>Time</th></tr></thead><tbody>${txHtml}</tbody></table>`);
  }).catch(e => openDetail('Account', `<div class="red">${e.message}</div>`));
}

function openDetail(title, html) {
  $('detailView').style.display = 'block';
  $('detailTitle').textContent = title;
  $('detailContent').innerHTML = html;
  window.scrollTo({ top: $('detailView').offsetTop - 20, behavior: 'smooth' });
}

// ── search ──
function doSearch() {
  const q = $('searchInput').value.trim();
  if (!q) return;
  api('/search?q=' + encodeURIComponent(q)).then(d => {
    if (d.type === 'block') return showBlock(d.result.Height);
    if (d.type === 'tx') return showTx(d.result.Hash);
    if (d.type === 'address') return showAddress(q);
    openDetail('Search', `<div class="red">No match for "${q}"</div>`);
  }).catch(e => openDetail('Search', `<div class="red">${e.message}</div>`));
}

// ── logs browser (Phase 3) ──
let logPage = 0;
const LOGS_PER_PAGE = 25;

function loadLogs() {
  const addr = $('logAddr').value.trim();
  const topic0 = $('logTopic').value.trim();
  const from = $('logFrom').value.trim();
  const to = $('logTo').value.trim();
  const q = new URLSearchParams();
  if (addr) q.set('address', addr);
  if (topic0) q.set('topic0', topic0);
  if (from) q.set('fromBlock', from);
  if (to) q.set('toBlock', to);
  q.set('limit', String(LOGS_PER_PAGE + 1)); // fetch one extra to detect "more"
  q.set('offset', String(logPage * LOGS_PER_PAGE));
  api('/logs?' + q.toString()).then(logs => {
    const tb = $('logsTable');
    tb.innerHTML = '';
    if (!logs || logs.length === 0) {
      tb.innerHTML = '<tr><td colspan="5" style="color:var(--fg2);text-align:center">No logs match this filter</td></tr>';
      $('logMore').style.display = 'none';
      $('logPrev').disabled = logPage === 0;
      return;
    }
    const hasMore = logs.length > LOGS_PER_PAGE;
    const rows = hasMore ? logs.slice(0, LOGS_PER_PAGE) : logs;
    rows.forEach(l => {
      const tr = el('tr');
      tr.innerHTML = `
        <td class="addr">${addrLink(l.Address, 8)}</td>
        <td class="addr">${(l.Topics || []).map(x => short(x, 6)).join('<br>')}</td>
        <td class="addr">${short(l.Data, 6)}</td>
        <td><a onclick="showBlock(${l.Block})" style="cursor:pointer">${l.Block?.toLocaleString()}</a></td>
        <td><a class="addr clickable" onclick="showTx('${encodeURIComponent(l.TxHash)}')">${short(l.TxHash, 8)}</a></td>`;
      tb.appendChild(tr);
    });
    $('logPrev').disabled = logPage === 0;
    $('logMore').style.display = hasMore ? 'inline-block' : 'none';
    $('logPageLabel').textContent = 'Page ' + (logPage + 1);
  }).catch(e => {
    $('logsTable').innerHTML = `<tr><td colspan="5" class="red">${e.message}</td></tr>`;
  });
}

window.loadLogs = loadLogs;
window.logPrev = () => { if (logPage > 0) { logPage--; loadLogs(); } };
window.logNext = () => { logPage++; loadLogs(); };
window.logReset = () => { logPage = 0; loadLogs(); };

// ── precompiles (Phase 3) ──
function renderPrecompiles(list) {
  const tb = $('precompileTable');
  tb.innerHTML = '';
  (list.precompiles || []).forEach(p => {
    const tr = el('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => showPrecompile(p.addr);
    tr.innerHTML = `
      <td><a>${p.addr}</a></td>
      <td>${p.name}</td>`;
    tb.appendChild(tr);
  });
  $('precompileCount').textContent = '(' + ((list.precompiles || []).length) + ')';
}

async function loadPrecompiles() {
  try {
    const list = await api('/precompiles');
    renderPrecompiles(list);
  } catch (e) {
    $('precompileTable').innerHTML = `<tr><td colspan="2" class="red">${e.message}</td></tr>`;
  }
}

// ── Tokens view (#53) ──────────────────────────────────────
function showTokens() {
  // hide the main explorer sections, show tokens
  const main = document.querySelectorAll('#blocksSection, #logsSection, #precompileSection, #activitySection');
  main.forEach(s => { if (s) s.style.display = 'none'; });
  $('tokensSection').style.display = 'block';
  loadTokens();
  window.scrollTo(0, 0);
}

function hideTokens() {
  $('tokensSection').style.display = 'none';
  ['blocksSection', 'logsSection', 'precompileSection', 'activitySection'].forEach(id => {
    const s = $(id); if (s) s.style.display = 'block';
  });
  window.scrollTo(0, 0);
}

async function loadTokens() {
  const tb = $('tokenTable');
  tb.innerHTML = '<tr><td colspan="5" style="color:var(--fg2);text-align:center">Loading tokens…</td></tr>';
  try {
    const tokens = await api('/tokens');
    tb.innerHTML = '';
    (tokens || []).forEach(t => {
      const tr = el('tr');
      tr.style.cursor = 'pointer';
      tr.onclick = () => showPrecompile(t.addr);
      const supply = t.totalSupply != null
        ? hexToNum(t.totalSupply).toLocaleString() + ' ' + t.symbol
        : '— <span style="color:var(--fg2)">(not exposed)</span>';
      tr.innerHTML = `
        <td><strong>${t.symbol}</strong></td>
        <td>${t.name}</td>
        <td><a>${t.addr}</a></td>
        <td>${supply}</td>
        <td style="font-size:.8em;color:var(--fg2);max-width:420px">${t.purpose}</td>`;
      tb.appendChild(tr);
    });
    $('tokenCount').textContent = '(' + (tokens || []).length + ')';
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="5" class="red">${e.message}</td></tr>`;
  }
}

// Render a way_* stat value truthfully: hex amounts -> decimal, objects shown as JSON.
function fmtStat(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') {
    const s = v.startsWith('0x') ? v.slice(2) : v;
    if (/^[0-9a-fA-F]+$/.test(s) && s.length > 0) {
      try { return BigInt('0x' + s).toString() + ' (0x' + s + ')'; } catch {}
    }
    return v || '—';
  }
  return JSON.stringify(v);
}

function showPrecompile(addr) {
  api('/precompile/' + encodeURIComponent(addr)).then(d => {
    if (d.error) { openDetail('Precompile', `<div class="red">${d.error}</div>`); return; }
    const descHtml = d.desc ? `<p style="color:var(--fg2);font-size:.9em;margin:8px 0 0">${d.desc}</p>` : '';
    const scopeHtml = d.accountScoped
      ? `<div class="row"><div class="label">Scope</div><div class="value" style="color:var(--yellow)">Account-scoped — no global stat; query by address</div></div>`
      : `<div class="row"><div class="label">Scope</div><div class="value" style="color:var(--green)">Protocol-level — live state below</div></div>`;
    let statsHtml = '<div style="color:var(--fg2);font-size:.75em">No live stats for this precompile</div>';
    const stats = d.stats || {};
    const keys = Object.keys(stats);
    if (keys.length) {
      statsHtml = '<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>';
      keys.forEach(method => {
        const val = stats[method];
        if (val && typeof val === 'object' && val.error) {
          statsHtml += `<tr><td>${method}</td><td class="red">${val.error}</td></tr>`;
        } else if (val && typeof val === 'object') {
          Object.entries(val).forEach(([k, v]) => {
            statsHtml += `<tr><td>${method}.${k}</td><td class="addr">${fmtStat(v)}</td></tr>`;
          });
        } else {
          statsHtml += `<tr><td>${method}</td><td class="addr">${fmtStat(val)}</td></tr>`;
        }
      });
      statsHtml += '</tbody></table>';
    }
    const callsHtml = (d.statCalls && d.statCalls.length)
      ? `<div style="color:var(--fg2);font-size:.72em;margin-top:10px">Backed by node read(s): ${d.statCalls.join(', ')}</div>`
      : '';
    const acctHtml = d.accountScoped
      ? `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
           <div style="font-size:.8em;color:var(--fg2);margin-bottom:6px">Query by address (${d.addr === '0x13' ? 'Dox_Dev level' : 'balance'})</div>
           <input id="pcAddr" placeholder="0x… (64-hex key or 20-byte)" style="width:100%;padding:6px;background:var(--bg3);color:var(--fg);border:1px solid var(--border);border-radius:4px;font-family:monospace">
           <button onclick="queryPrecompileAccount('${d.addr}')" style="margin-top:6px;padding:6px 12px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer">Query</button>
           <div id="pcResult" style="margin-top:8px"></div>
         </div>`
      : '';
    openDetail('⬡ Precompile ' + d.addr, `
      <div class="detail">
        <div class="row"><div class="label">Address</div><div class="value hash-value">${d.addr}</div></div>
        <div class="row"><div class="label">Name</div><div class="value">${d.name}</div></div>
        ${scopeHtml}
      </div>
      ${descHtml}
      <h3 style="margin-top:15px">Live State</h3>
      ${statsHtml}
      ${callsHtml}
      ${acctHtml}`);
  }).catch(e => openDetail('Precompile', `<div class="red">${e.message}</div>`));
}

function queryPrecompileAccount(addr) {
  const q = $('pcAddr').value.trim();
  if (!q) return;
  const box = $('pcResult');
  box.innerHTML = '<div style="color:var(--fg2);font-size:.75em">querying…</div>';
  api('/precompile/' + encodeURIComponent(addr) + '/account?address=' + encodeURIComponent(q)).then(d => {
    if (d.error) { box.innerHTML = `<div class="red">${d.error}</div>`; return; }
    const res = d.results || {};
    const keys = Object.keys(res);
    if (!keys.length) { box.innerHTML = '<div style="color:var(--fg2)">no data</div>'; return; }
    let h = '<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>';
    keys.forEach(label => {
      const v = res[label];
      if (v && typeof v === 'object' && v.error) {
        h += `<tr><td>${label}</td><td class="red">${v.error}</td></tr>`;
      } else {
        h += `<tr><td>${label}</td><td class="addr">${fmtStat(v)}</td></tr>`;
      }
    });
    h += '</tbody></table>';
    box.innerHTML = h;
  }).catch(e => { box.innerHTML = `<div class="red">${e.message}</div>`; });
}
window.queryPrecompileAccount = queryPrecompileAccount;

window.showPrecompile = showPrecompile;
window.showAddress = showAddress;

// ── live WebSocket ──
let ws = null;
// wsLive is declared up top (shared with the status pill logic).

function wsURL() {
  const base = API_BASE.replace(/\/$/, '');        // https://api.waychain.org/api
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return scheme + '//' + base.split('://')[1] + '/ws';
}

function prependBlock(b) {
  const tb = $('blocksTable');
  // If the placeholder row is showing, clear it first.
  if (tb.querySelector('td') && tb.querySelector('td').colSpan) tb.innerHTML = '';
  const tr = el('tr');
  tr.style.cursor = 'pointer';
  tr.onclick = () => showBlock(b.Height);
  tr.innerHTML = `
    <td><a>${b.Height?.toLocaleString() ?? '—'}</a></td>
    <td class="hash">${short(b.Hash, 10)}</td>
    <td>${b.Proposer || '—'}</td>
    <td>${b.TxCount ?? 0}</td>
    <td style="color:var(--fg2)">${ago(hexToNum(b.Timestamp))}</td>`;
  // Flash the new row so "live" is visible.
  tr.style.transition = 'background 0.6s';
  tr.style.background = 'rgba(255,191,0,0.18)';
  setTimeout(() => { tr.style.background = ''; }, 600);
  tb.insertBefore(tr, tb.firstChild);
  // Trim to BLOCKS_TO_SHOW rows.
  while (tb.children.length > BLOCKS_TO_SHOW) tb.removeChild(tb.lastChild);
}

function setWsStatus(live) {
  // A dead WS does NOT mean the explorer is offline — REST polling still
  // serves live data. Only flip the "Live" tag; never force "Offline" here.
  wsLive = live;
  renderStatus();
}

let wsReconnectAttempts = 0;
function connectWS() {
  if (wsReconnectAttempts > 10) {
    log('WS unavailable (Cloudflare Tunnel on free plan does not proxy WebSocket upgrades) — using polling only', 'err');
    return;
  }
  try {
    ws = new WebSocket(wsURL());
  } catch (e) {
    wsLive = false; renderStatus();
    return;
  }
  ws.onopen = () => { wsReconnectAttempts = 0; setWsStatus(true); log('WS connected (live)', 'ok'); };
  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'newHead' && msg.block) {
      if (msg.stats) renderStats(msg.stats);
      prependBlock(msg.block);
    }
  };
  ws.onclose = () => {
    wsLive = false; renderStatus();
    wsReconnectAttempts++;
    // Back off: the poll loop keeps data fresh meanwhile.
    setTimeout(connectWS, 15000);
  };
  ws.onerror = () => { try { ws.close(); } catch {} };
}

// ── poll loop ──
async function refresh() {
  try {
    const [stats, blocks] = await Promise.all([
      api('/stats'),
      api('/blocks?limit=' + BLOCKS_TO_SHOW + '&offset=0'),
    ]);
    renderStats(stats);
    renderBlocks(blocks);
    setStatus(true);
  } catch (e) {
    setStatus(false);
    log('refresh failed: ' + e.message, 'err');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  $('searchBtn').onclick = doSearch;
  $('searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  $('clearBtn').onclick = () => { $('searchInput').value = ''; $('detailView').style.display = 'none'; };
  $('logSearchBtn').onclick = () => { logPage = 0; loadLogs(); };
  $('logAddr').addEventListener('keydown', e => { if (e.key === 'Enter') { logPage = 0; loadLogs(); } });
  $('logTopic').addEventListener('keydown', e => { if (e.key === 'Enter') { logPage = 0; loadLogs(); } });
  log('Explorer initialized → ' + API_BASE);
  refresh();
  loadLogs();
  loadPrecompiles();
  connectWS();              // live updates; falls back to polling on close
  setInterval(refresh, REFRESH_MS); // polling keeps data fresh if WS drops
});
