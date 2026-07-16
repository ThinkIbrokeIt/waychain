# WayChain OPS LEDGER — single source of truth (local)

This file is the ONE place where repo state, deployed AWS state, and operational
facts are recorded together. Disagreement between this file and the live node =
a drift to fix, not a "maybe." Update it after every deploy, fund, or config
change. Verify claims against the live node before writing them here.

## Deployed node (AWS 3.89.116.45)
- **Live binary version:** WayChain v0.1.0
- **Deployed commit (master):** 2cffefc (post #11 + #12 merge)
- **First deploy:** 2026-07-16 19:15 UTC — FAILED (Go build cache served stale
  rpc; way_questCap absent). Redeployed 19:32 UTC with `go build -a` + supply
  seed fix (PR #12).
- **Genesis reset:** 2026-07-16 19:32 UTC — deleted .waychain/chain.db so the
  100M supply seed re-ran at genesis (~27 blocks of history lost; dev/test net).
- **VERIFIED LIVE (2026-07-16 19:34 UTC):**
  - way_wayTotalSupply = 100,000,000 (0x5f5e100) ✅
  - way_questCap = 5,000,000 (0x4c4b400 = 5% of supply) ✅
  - way_questPoolRemaining = 5,000,000 (cap − 0 paid) ✅
  - eth_blockNumber advancing (node producing) ✅
- **Public RPC:** https://api.waychain.org
- **Build cmd (USE -a, cache unreliable):** CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -a -o waychain .

## Deploy procedure (verified working)
1. git checkout master && git pull (confirm code present)
2. CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -a -o waychain .   ← USE -a
3. ssh stop waychain.service
4. cat binary | ssh 'cat > /home/ubuntu/waychain-new'  (scp broken → pipe)
5. sudo mv waychain-new /usr/local/bin/waychain
6. [if genesis seed changed] sudo rm -rf /home/ubuntu/.waychain/chain.db
7. sudo systemctl start waychain.service
8. VERIFY: curl way_wayTotalSupply (100M), way_questCap (5M), way_questPoolRemaining (5M)

## Token facts (VERIFY before believing)
- 1WAY = BTC-pegged stablecoin, minted by BTC deposit (way_stablecoin.go)
- 2WAY = CDP minted by TwoWayVault 0x18
- WAY = reward/quest token. Total starting supply = 100,000,000 (WAYStartingSupply).
- SWAY = staking token 0x24
- WIFR = Solana memecoin (PUMP.fun) — the DOOR token, NOT on WayChain

### Quest pool (the cap)
- **1.1M fixed cap was DEAD CODE** (never enforced). Replaced 2026-07-16.
- **CURRENT RULE (approved option B):** quest payout cap = **5% of LIVE total WAY
  supply**, recomputed at each payout, scales with inflation.
- At 100M starting supply the cap OPENS at **5,000,000 WAY** (verified live).
- Live supply tracked on-chain (slot 0x41 of 0x23): seeded at genesis to 100M,
  incremented as validator block rewards mint (7%/yr). Cap RISES over time.
- Enforced in verifyAndPay: cumulative paid > 5% of live supply → verify rejected.
- RPC reads: way_questCap, way_wayTotalSupply, way_questPoolRemaining.
- **Funded?** ❌ NO — treasury 0x03 still unfunded; founder must call questFund.
- **Autopilot set?** ❌ NO — questSetAutopilot not called.

## Precompile addresses (from protocol-manifest.json, SoT)
1WAY=0x22, WAY(n/a), SWAY=0x24, 2WAY=0x18, treasury=0x03,
TaskRegistry=0x23, CrossChainAttestation=0x1F (NOT 0x26 — 0x26 is TemplateRegistry),
WIFRGantletRewards=0x21, Oracle=0x0C-0x10, DoxDevBadge=0x13,
BitcoinRegistry=0x16, TwoWayVault=0x18, StabilityPool=0x1E, SwapRoute=0x1D,
BinaryJournal=0x11, TrustlessLock=0x12, MineralRights=0x20, DeadMansSwitch=0x14,
AccountRecovery=0x15, StateRent=0x17, PrivacyZK=0x19, TemplateRegistry=0x26.

## Quest program (merged: PR #5→#7→#9→#11→#12, master)
- 28 canonical quests in TaskRegistry (0x23). Auto-eligible set = 17 objective.
- Autopilot oracle: auto-verifies objective quests. Designated via questSetAutopilot.
- wifr-bridge (50 WAY) = THE DOOR: burn 1 WIFR on Solana → 0x1F attest → autopilot accepts.
- SolanaChainID sentinel = "solana-waychain" (fixed string for 0x1F source-chain).

## Open operational gaps (truth-first)
1. ❌ Treasury 0x03 NOT funded — founder must call questFund (cap is enforced but pool empty until funded).
2. ❌ Autopilot NOT designated (no questSetAutopilot yet).
3. ❌ Off-chain autopilot BOT not built (watches chain → calls taskAutoVerify).
4. ✅ Merged master + cap fix DEPLOYED to AWS (verified live 2026-07-16 19:34).
5. ❌ Live 0x03 balance = 0x0 (treasury unfunded).

## How to verify a fact (don't trust memory)
- Live supply/cap:  curl -s -X POST https://api.waychain.org -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"way_questCap","params":[],"id":1}'
- Live balance:  curl -s -X POST https://api.waychain.org -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","method":"way_getBalance","params":["<20-byte hex>"],"id":1}'
- Deployed commit: ssh ubuntu@3.89.116.45 'sudo sha256sum /usr/local/bin/waychain'
- Manifest: cat protocol-manifest.json | grep precompile_count
