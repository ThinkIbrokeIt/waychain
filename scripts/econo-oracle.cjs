#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// WayChain EconoOracle — pushes the Go-core economic-health snapshot into the
// app-layer Solidity mirror (EconoAnalytics.feedSnapshot).
//
// ISSUE #97. This bot does NOT hold keys and does NOT broadcast. It polls the
// Go node RPCs (way_econoIndicators / way_econoPolicy), builds the exact
// feedSnapshot calldata, and prints the payload for the founder to sign +
// broadcast — matching the house convention in scripts/prepare-quest-fund.cjs
// (agent never holds the founder's private key).
//
// DEPLOY DEPENDENCY (truth-first): EconoAnalytics.sol must be deployed to a
// known address first. Until ECONO_ANALYTICS_ADDR is set, the bot runs, prints
// the computed snapshot + calldata, and exits 0 — it does NOT pretend to have
// pushed anything on-chain. WayChain's Solidity deploy path is not yet proven
// on the live node, so this is intentional, not a gap.
//
// Usage:
//   node econo-oracle.cjs                 # one-shot: poll, print payload
//   ECONO_ANALYTICS_ADDR=0x.. node econo-oracle.cjs
//   RPC_URL=http://localhost:9545 node econo-oracle.cjs
//   POLL_SECONDS=30 node econo-oracle.cjs # loop every 30s
// ═══════════════════════════════════════════════════════════════════════════

const RPC_URL = process.env.RPC_URL || 'http://localhost:9545';
const ECONO_ADDR = process.env.ECONO_ANALYTICS_ADDR || ''; // set after deploy
const POLL_SECONDS = parseInt(process.env.POLL_SECONDS || '0', 10);
const FEED_SELECTOR = 'f763afbb'; // feedSnapshot(uint256,uint256,uint256,uint256,uint8)

// ── RPC helpers (WayChain uses JSON-RPC; params are positional arrays) ──
async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method} error: ${JSON.stringify(json.error)}`);
  return json.result;
}

function toHex32(bn) {
  const h = BigInt(bn).toString(16);
  if (h.length > 64) throw new Error('value too large for uint256');
  return h.padStart(64, '0');
}

function toHex8(n) {
  return BigInt(n).toString(16).padStart(2, '0');
}

// Build feedSnapshot(uint256,uint256,uint256,uint256,uint8) calldata.
function buildCalldata(ind, pol) {
  const gbp = ind.gdpEquivalent ?? ind.grossBlockchainProduct ?? 0;
  const employmentBps = ind.employmentBps ?? 0;
  const velocityBps = ind.velocityBps ?? 0;
  const yieldSpreadBps = ind.yieldSpreadBps ?? 0;
  const phase = pol.phase ?? ind.phase ?? 0;
  const data =
    FEED_SELECTOR +
    toHex32(gbp) +
    toHex32(employmentBps) +
    toHex32(velocityBps) +
    toHex32(yieldSpreadBps) +
    toHex8(phase);
  return { gbp, employmentBps, velocityBps, yieldSpreadBps, phase, data: '0x' + data };
}

async function runOnce() {
  const [ind, pol] = await Promise.all([
    rpc('way_econoIndicators', []),
    rpc('way_econoPolicy', []),
  ]);
  const snap = buildCalldata(ind, pol);

  console.log('══════════════════════════════════════════════════════════');
  console.log(' WayChain EconoOracle — snapshot @', new Date().toISOString());
  console.log('────────────────────────────────────────────────────────────');
  console.log(' GBP (gdpEquivalent) :', snap.gbp.toString());
  console.log(' Employment (bps)     :', snap.employmentBps.toString());
  console.log(' Velocity (bps)       :', snap.velocityBps.toString());
  console.log(' Yield spread (bps)   :', snap.yieldSpreadBps.toString());
  console.log(' Phase                :', snap.phase, `(${pol.phaseLabel || (snap.phase == 1 ? 'Expansion' : 'Consolidation')})`);
  console.log(' calldata             :', snap.data);

  if (!ECONO_ADDR) {
    console.log('');
    console.log(' ⚠ DEPLOY DEPENDENCY: EconoAnalytics.sol is not deployed yet.');
    console.log('   Set ECONO_ANALYTICS_ADDR=<deployed addr> after deploy.');
    console.log('   Bot is READ-ONLY here — no on-chain push performed.');
    console.log('   (Deploy path on WayChain L1 is not yet proven; see issue #97.)');
    return;
  }

  console.log('');
  console.log(' Tx wire (founder signs, then eth_sendRawTransaction([hexWire])):');
  console.log('   to    =', ECONO_ADDR, '(EconoAnalytics)');
  console.log('   data  =', snap.data);
  console.log('   value = 0');
  console.log('   from  = <oracle 64-hex ed25519 pubkey>');
  console.log('   lane  = 0 (consensus)');
  console.log('');
  console.log(' Verify after broadcast (eth_call getIndicators on', ECONO_ADDR + '):');
  console.log('   expect gbp =', snap.gbp.toString(), '| phase =', snap.phase);
}

(async () => {
  try {
    if (POLL_SECONDS > 0) {
      console.log(`EconoOracle looping every ${POLL_SECONDS}s (Ctrl-C to stop).`);
      for (;;) {
        await runOnce();
        await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
      }
    } else {
      await runOnce();
    }
  } catch (e) {
    console.error('EconoOracle failed:', e.message);
    process.exit(1);
  }
})();
