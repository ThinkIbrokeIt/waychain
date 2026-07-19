# WayChain Session Handoff — 2026-07-18

## Where we are (VERIFIED, not claimed)
- **Node redeployed** to AWS 3.89.116.45 with merged master (`04c75b5`). Service `active (running)`. Live `api.waychain.org` confirmed serving `way_econoIndicators` + `way_swayEmissionProjection` (returns `hardCeiling: 5000000000` = 5B ✓).
- **Dapps LIVE on https://waychain.org** (Vercel, `waychain-site` project):
  - `/mission-control` — economy dashboard, reads econo RPCs directly (PR #99, merged).
  - `/dex` — REBUILT real DEX: swap + addLiquidity call SwapRoute 0x25 on-chain with verified calldata (PR #102, merged). Was a brochure before.
  - `/wallet` — audited, already correct (js/wallet.js uses 64-hex pubkey; BIJO 0x14 is a DISTINCT token from SWAY 0x24, no rename). Issue #100 closed verified-OK.

## Key decisions (in DECISIONS.md, dated)
- WAY = pay for the economy; SWAY (0x24) = rewards earned by participation. NO team/backer vesting, NO veModel (VC-world rejected).
- SWAY: 1B initial, **5B hard ceiling**, allocation 45% tasks / 20% DEX LP / 35% ecosystem.
- Emission: 3%-of-GBP PROPOSED, READ-ONLY projection (`way_swayEmissionProjection`), NOT hardcoded ("see numbers first").
- Dapps are top priority per founder ("web3 is dapps").

## CRITICAL lesson this session (drift caught)
- Three edits (5B ceiling, `SwayProjectedEmissionFromGBP`, `way_swayEmissionProjection` RPC) were applied as working-tree edits, NEVER committed, then wiped by `git reset --hard`. They did NOT reach the squashed PR #95. Re-applied + committed in PR #104 (merged). **Always commit before reset; issue-first discipline exists for this.**
- Git lesson: local `master` ref got tangled (stray DECISIONS.md commits, divergent). `vercel deploy` + node redeploy use established scripts (`scripts/redeploy-master.sh`); scp is BROKEN → use `cat|ssh`.

## Open threads (next session)
1. **Task marketplace UI** (TaskRegistry 0x23 already built) — natural next dapp.
2. **Oracle bot deploy** (issue #97): `scripts/econo-oracle.cjs` done + verified, but `EconoAnalytics.sol` NOT deployed yet (Solidity deploy path unproven on WayChain L1). Bot is deploy-ready, no-ops until `ECONO_ANALYTICS_ADDR` set.
3. **3% emission**: still proposal, not hardcoded (founder wants numbers first).
4. Open PRs: #103 (DECISIONS log — master protected, needs merge), #89/#85 (mobile scan-pay). Open issues #90/#92/#91/#94 (GasFaucet, treasury split, faucet bug) — these are protocol, separate from dapps.

## Repo state
- SoT monorepo: `/home/wink/projects/waychain` (ThinkIbrokeIt/waychain), branch `master`.
- Site deploys from `site/` via `vercel deploy --prod --project waychain-site` (NOT the archived `waychain-site` GitHub repo — push 403).
- Node: AWS 3.89.116.45, `waychain.service`, key `~/Downloads/WayChain.pem`.
- Build: `cd consensus && GOOS=linux GOARCH=amd64 CGO_ENABLED=1 go build -a -o /tmp/waychain-new .` (use `-a`, cache unreliable). Ship via `cat /tmp/waychain-new | ssh ... 'cat > /home/ubuntu/waychain-new'`.

## Founder directives reinforced
- Truth-first: verify against live node, never claim "shipped" without proof.
- Issue-first: file GitHub issue BEFORE code; PR per fix.
- One working tree (REPO_LAW); no satellite edits.
- "Go!" = execute the planned step; don't re-ask. But honor mid-flight stops (redeploy was halted before, then "redeploy" given).
- Compaction: auto-compress at 50% context — it failed to fire this session (context fatigue). Start fresh sessions; re-orient from DECISIONS.md + this file.
