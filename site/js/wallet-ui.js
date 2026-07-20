// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WayChain web core wallet UI (issue #12.1, child of #8/#12).
// Renders a live address + WAY balance widget using the real auth (#10)
// + call layer (#11). Drop a <div id="wallet-widget"></div> on any page.
(function (global) {
  'use strict';

  function el(id) { return document.getElementById(id); }

  async function renderBalance(addr) {
    const out = el('wc-balance');
    if (!out || !global.WayChainRPC) return;
    try {
      const raw = await global.WayChainRPC.getBalance(addr);
      // way_getBalance returns hex wei; format to WAY (assume 1e18, show raw if small)
      let way = '0';
      try {
        const v = BigInt(raw || '0x0');
        way = (v / 10n ** 18n).toString();
        if (way === '0' && v > 0n) way = v.toString() + ' wei';
      } catch { way = String(raw); }
      out.textContent = way + ' WAY';
    } catch (e) {
      out.textContent = 'balance unavailable';
      out.title = e.message;
    }
  }

  async function mount(containerId) {
    const root = el(containerId || 'wallet-widget');
    if (!root) return;
    root.innerHTML = `
      <div class="wc-card">
        <div class="wc-row"><span class="wc-label">Wallet</span>
          <button class="wc-btn" id="wc-connect">Connect</button></div>
        <div class="wc-addr" id="wc-addr">not connected</div>
        <div class="wc-bal"><span id="wc-balance">—</span></div>
      </div>`;
    const btn = el('wc-connect');
    btn.addEventListener('click', async () => {
      if (!global.WayChainWallet) { alert('Wallet module not loaded.'); return; }
      btn.textContent = 'Connecting…';
      try {
        const acc = await global.WayChainWallet.connect();
        el('wc-addr').textContent = acc.address;
        btn.textContent = 'Connected';
        // way_getBalance requires the FULL 64-hex pubkey (20-byte display addr returns 0x0).
        await renderBalance(acc.publicKey);
      } catch (e) {
        btn.textContent = 'Connect';
        alert('Wallet error: ' + e.message);
      }
    });
  }

  global.WayChainWalletUI = { mount, renderBalance };
  // Auto-mount if a widget container exists on load.
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if (el('wallet-widget')) mount('wallet-widget');
    });
  }
})(window);
