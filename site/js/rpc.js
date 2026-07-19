// WayChain web RPC — real node connection (issue #10/#11, child of #8).
// Depends on js/precompiles.js (registry) + js/wallet.js (auth) + js/tx.js (signer).
(function (global) {
  'use strict';
  const RPC = global.WayChainWallet ? global.WayChainWallet.RPC_URL : 'https://api.waychain.org';
  const REGISTRY = global.WayChainPrecompiles || (global.PRECOMPILES);
  const call = async (method, params) => {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json.result ?? null;
  };
  const hexToNum = (hex) => {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    try { return Number(BigInt('0x' + hex.replace(/^0x/, ''))); } catch { return 0; }
  };
  const api = {
    call,
    // Balance / nonce MUST use the 64-hex pubkey (node keys EOA accounts by full
    // pubkey; the 20-byte display address returns 0x0). If a 20-byte display address
    // is passed and it matches the connected account, resolve to its 64-hex pubkey.
    getBalance: async (addr) => {
      const a = (addr || '').replace(/^0x/, '');
      let lookup = a;
      if (a.length === 40) {
        const acc = global.waychainAccount || (global.WayChainWallet && global.WayChainWallet.load && global.WayChainWallet.load());
        if (acc && (acc.address || '').replace(/^0x/, '') === a && acc.publicKey) lookup = acc.publicKey.replace(/^0x/, '');
      }
      return call('way_getBalance', ['0x' + lookup]);
    },
    getNonce: async (pub64Hex) => {
      const r = await call('eth_getTransactionCount', [pub64Hex]);
      return typeof r === 'string' ? (parseInt(r, 16) || 0) : 0;
    },
    // Dox_Dev badge level (0 unverified → 1 basic → 2 professional → 3p/3t).
    // MUST use the 64-hex pubkey (node keys EOA accounts by full pubkey; the
    // 20-byte display address returns 0x0). If a 20-byte display address is
    // passed and it matches the connected account, resolve to its 64-hex pubkey.
    getDoxLevel: async (addrOrAccount) => {
      const raw = addrOrAccount?.publicKey || addrOrAccount || '';
      const a = raw.replace(/^0x/, '');
      let lookup = a;
      if (a.length === 40) {
        const acc = global.waychainAccount || (global.WayChainWallet && global.WayChainWallet.load && global.WayChainWallet.load());
        if (acc && (acc.address || '').replace(/^0x/, '') === a && acc.publicKey) lookup = acc.publicKey.replace(/^0x/, '');
      }
      const r = await call('way_getDoxLevel', ['0x' + lookup]);
      const n = parseInt(r, 16);
      return Number.isFinite(n) ? n : 0;
    },
    getBlockCount: () => call('way_getBlockCount', []),
    getGovernanceProposals: async () => { const r = await call('way_govProposals', []); return Array.isArray(r) ? r : []; },
    getTwoWayStats: async () => {
      const r = await call('way_twoWayStats', []);
      if (!r || typeof r !== 'object') throw new Error('no twoWayStats');
      return { vaults: hexToNum(r.vaults), totalDebt: hexToNum(r.totalDebt) };
    },
    getBridgeStats: async () => {
      const r = await call('way_bridgeStats', []);
      if (!r || typeof r !== 'object') throw new Error('no bridgeStats');
      return { committed: hexToNum(r.committed), withdrawn: hexToNum(r.withdrawn) };
    },
    // Quest / TaskRegistry live reads (0x23). Use way_* RPCs (public RPC blocks
    // eth_call to precompiles). Keeps web + mobile in sync (no silent drift).
    questStatus: async (taskIdHex, claimantHex) => {
      const r = await call('way_taskStatus', [taskIdHex, claimantHex]);
      return typeof r === 'string' ? r : 'none';
    },
    questPoolRemaining: async () => {
      const r = await call('way_questPoolRemaining', []);
      return hexToNum(r);
    },
    questGetAutopilot: async () => {
      const r = await call('way_questGetAutopilot', []);
      return typeof r === 'string' ? r : '';
    },
    wayTotalSupply: async () => {
      const r = await call('way_wayTotalSupply', []);
      return hexToNum(r);
    },
    questCap: async () => {
      const r = await call('way_questCap', []);
      return hexToNum(r);
    },

    // ── Per-precompile call layer (issue #11) ──
    // READ for all 28 precompiles via eth_call + the shared registry.
    // WRITE requires the unlocked wallet (ephemeral seed) + tx.js signer.
    precompileCall: async (addr1, method, argsHex = '', opts = {}) => {
      const reg = (global.WayChainPrecompiles && global.WayChainPrecompiles.PRECOMPILES) || null;
      if (!reg) throw new Error('precompile registry not loaded');
      const pc = reg[addr1];
      if (!pc) throw new Error(`Unknown precompile ${addr1}`);
      const m = pc.methods.find((x) => x.name === method);
      if (!m) throw new Error(`Unknown method ${method} on ${pc.name}`);
      const to = '0x' + '0'.repeat(24) + addr1.replace(/^0x/, '').toLowerCase();
      const data = global.WayChainPrecompiles.encodeCall(addr1, method, argsHex);
      if (m.kind === 'read' && !opts.write) {
        return call('eth_call', [{ to, data }]);
      }
      // WRITE path — only when wallet is unlocked (ephemeral seed in memory).
      if (!global.WayChainWallet || !global.WayChainWallet.isUnlocked || !global.WayChainWallet.isUnlocked()) {
        throw new Error('Wallet locked. Unlock the wallet to sign this transaction.');
      }
      // The precompile address on the wire is the to-field; data carries selector+args.
      return global.WayChainWallet.sendTx({ to, valueWei: opts.valueWei || 0, data, gasLimit: opts.gasLimit || 21000 });
    },
  };
  global.WayChainRPC = api;
})(window);
