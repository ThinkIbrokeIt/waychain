# WayChain OPS LEDGER — single source of truth (local)

This file is the ONE place where repo state, deployed AWS state, and operational
facts are recorded together. Disagreement between this file and the live node =
a drift to fix, not a "maybe." Update it after every deploy, fund, or config
change. Verify claims against the live node before writing them here.

## Deployed node (AWS 3.89.116.45)
- **Live binary version:** ___ (fill after first deploy of merged master)
- **Deployed commit:** ___ (git rev-parse origin/master after deploy)
- **Last deploy:** ___ (date)
- **Public RPC:** https://api.waychain.org

## Token facts (VERIFY before believing)
- 1WAY = BTC-pegged stablecoin, minted by BTC deposit (way_stablecoin.go)
- 2WAY = CDP minted by TwoWayVault 0x18
- WAY = reward/quest token (1.1M quest pool cap defined, NOT yet funded)
- SWAY = staking token 0x24
- WIFR = Solana memecoin (PUMP.fun) — the DOOR token, NOT on WayChain

### Quest pool (the 1.1M)
- **Old assumption: 1.1M fixed cap — WRONG.** That was a hardcoded constant
  (QUEST_TOTAL_BUDGET) that was DEAD CODE (never enforced). Replaced 2026-07-16.
- **CURRENT RULE (approved option B):** quest payout cap = **5% of LIVE total WAY
  supply**, recomputed at every payout, scales with inflation.
- At 100M starting supply the cap OPENS at **5,000,000 WAY** (5% of 100M).
- Live supply is tracked on-chain (slot 0x41 of 0x23): seeded at genesis to 100M,
  incremented as validator block rewards mint (7%/yr). So the cap RISES over time.
- Enforced in verifyAndPay: cumulative paid > 5% of live supply → verify rejected.
- RPC reads: way_questCap (current cap), way_wayTotalSupply (live supply),
  way_questPoolRemaining (cap − paid).
- **Funded?** ❌ NO — treasury 0x03 still unfunded; founder must call questFund.
- **Autopilot set?** ❌ NO — questSetAutopilot not called.

## Precompile addresses (from protocol-manifest.json, SoT)
1WAY=0x22, WAY(n/a), SWAY=0x24, 2WAY=0x18, treasury=0x03,
TaskRegistry=0x23, CrossChainAttestation=0x1F (NOT 0x26 — 0x26 is TemplateRegistry),
WIFRGantletRewards=0x21, Oracle=0x0C-0x10, DoxDevBadge=0x13,
BitcoinRegistry=0x16, TwoWayVault=0x18, StabilityPool=0x1E, SwapRoute=0x1D,
BinaryJournal=0x11, TrustlessLock=0x12, MineralRights=0x20, DeadMansSwitch=0x14,
AccountRecovery=0x15, StateRent=0x17, PrivacyZK=0x19, TemplateRegistry=0x26.

## Quest program (merged: PR #5→#7→#9, master)
- 28 canonical quests in TaskRegistry (0x23). Auto-eligible set = 17 objective.
- Autopilot oracle: auto-verifies objective quests. Designated via questSetAutopilot.
- wifr-bridge (50 WAY) = THE DOOR: burn 1 WIFR on Solana → 0x1F attest → autopilot accepts.
- SolanaChainID sentinel = "solana-waychain" (fixed string for 0x1F source-chain).

## Open operational gaps (truth-first)
1. ❌ 1.1M quest pool NOT funded (no questFund yet).
2. ❌ Autopilot NOT designated (no questSetAutopilot yet).
3. ❌ Off-chain autopilot BOT not built (watches chain → calls taskAutoVerify).
4. ❌ Merged master NOT deployed to AWS (live node still old binary).
5. ❌ Live 0x03 balance = 0x0 (old node / empty treasury).

## How to verify a fact (don't trust memory)
- Live balance:  curl -s -X POST https://api.waychain.org -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"way_getBalance","params":["<20-byte hex>"],"id":1}'
- Deployed version: ssh ubuntu@3.89.116.45 'waychain version' (or check binary sha)
- Manifest: cat protocol-manifest.json | grep precompile_count
