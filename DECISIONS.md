# WayChain Decisions Log

Living record of binding protocol decisions. Every entry is tagged with date + exact source.
When code drifts from a decision below, the code is wrong — fix the code, not this log.
Doctrine: one source of truth, truth-first, no silent drift.

---

## 2026-07-18 — Token roles: WAY vs SWAY (founder, refined)
- **WAY = the PAYMENT token for the economy.** You PAY WAY for tasks, fees,
  and services. The task pool (treasury 0x03) pays workers in WAY; WAY flows to
  ALL participants as payment for economic activity. Genesis dev + base user got
  the initial WAY allocation.
- **SWAY (0x24) = the REWARDS token.** Earned by PARTICIPATION — completing
  tasks, providing DEX liquidity, community contribution. NO insider allocation,
  NO cliff-vesting, NO veModel. Everyone earns SWAY the same way.
- So a task = poster pays WAY, worker is PAID WAY and EARNS SWAY reward.
- Source: founder chat 2026-07-18 ("sway is rewards... WAY is pay for economy").

## 2026-07-18 — SWAY monetary policy + supply (founder approved model, de-VC'd)
- Initial supply: 1,000,000,000 (1B) SWAY = 10× WAY. ("a lot more")
- Hard ceiling: 10,000,000,000 (10B) SWAY (100× WAY) — cannot be crossed;
  safety rail only. (Founder open to dropping the ceiling entirely — TBD.)
- Allocation of initial 1B — ALL SWAY is REWARDS, earned by participation.
  NO team/backer carve-out (that is the VC-world pattern; REJECTED 2026-07-18):
  - Task-completion rewards:  **45% (450M)**
  - DEX LP rewards:            **20% (200M)**
  - Ecosystem / community / contributor rewards: **35% (350M)**
- Emission base — UNDER DISCUSSION. Founder proposed "3% on the yearly
  earnings" (2026-07-18, "idk. 3% on the yearly earnings ?"). Interpreting as:
  mint SWAY = 3% of the economy's yearly earnings (GBP, the WAY-denominated
  output tracked by econo_loop.go), NOT 3% of circulating supply. This makes
  issuance bounded by REAL economic value created (earn-by-value, anti-VC).
  Replaces the earlier 2.5%/yr-of-supply draft. Awaiting founder confirm.
- Burn flywheel: swap-fee share (~20% of the 0.3% swap fee) + task-fee share →
  buyback & burn SWAY. Expansion phase boosts burn rate.
- Vesting / veModel: REJECTED (VC-world mechanics). LP rewards carry a 30-day
  TrustlessLock to mitigate farm-and-dump; future-user rewards earned by
  activity only.
- Source: founder chat 2026-07-18 (approve 1B initial / inflationary-adaptive /
  10B ceiling / rewards-not-pay role; reject team/backer vesting + veModel).

## 2026-07-18 — Economic health model is Go-core, Solidity is app-layer mirror (founder)
- The four indicators + phase + feedback loop are computed by the Go core (econo_loop.go),
  fed by real on-chain events (sha256 core hashing preserved).
- Solidity EconoAnalytics.sol / ProfessionalSBT.sol are the app-layer mirror (oracle-fed),
  not the source of truth.
- Source: founder chat 2026-07-18 ("deploy real Solidity contracts" + "sha256 stays core
  hashing — not an app-layer luxury"). See PR #95 / issue #93.

## 2026-07-18 — First dapps deployed: Mission Control + real DEX (founder "Go!")
- Founder 2026-07-18: "web 3 is all about apps or dapps. we havent touched the
  surface of that yet" then "Go!" — web wallet + a really good DEX are TOP priority.
- Deployed to Vercel (waychain-site project) via `vercel deploy --prod --project
  waychain-site` from site/:
  - Mission Control (/mission-control): live economy dashboard, reads way_econo*
    RPCs directly. PR #99 (merged to master).
  - DEX (/dex): REBUILT as a real dapp — swap + addLiquidity call SwapRoute 0x25
    on-chain with verified calldata. PR #102 (merged to master).
  - Web wallet (/wallet): audited, already correct (js/wallet.js uses 64-hex
    pubkey; BIJO 0x14 is a distinct token from SWAY 0x24 — no rename). Issue #100
    closed verified-OK.
- CAVEAT (truth-first): the live node (api.waychain.org) must run the PR #95
  binary for way_econo* RPCs + current swap_route.go to be live. Site pages deploy
  regardless; they show "node unreachable" until the node is redeployed with #95.
  Node redeploy is a SEPARATE step — held pending explicit founder go (prior
  founder has stopped redeploys mid-flight).
- Source: founder chat 2026-07-18 ("Go!" x2 on dapps + deploy).

## 2026-07-19 — Mobile versionCode drift resolved (founder directive)
- SYMPTOM: device (SM-S918U, S22) had `org.waychain.mobile` versionCode **3** installed,
  but the repo's `mobile/android/app/build.gradle` declared versionCode **1**. A rebuild
  from `master` failed to install with `INSTALL_FAILED_VERSION_DOWNGRADE` (device v3 > repo v1).
- ROOT CAUSE: the v3 build was produced from an UNTRACKED local change to versionCode that was
  never committed. Git history shows NO versionCode change ever — pure silent drift, the exact
  failure mode REPO_LAW forbids.
- FIX (truth-first, no silent drift):
  - Installed the current repo-built APK (versionCode 1, versionName 0.1.2) to the device via
    `adb uninstall` + `adb install` (fresh install, app data cleared on device).
  - Bumped repo `build.gradle` versionCode **1 → 4** so the next `master` build is strictly
    ABOVE everything ever installed (max seen = 3), permanently preventing the downgrade trap.
  - versionName stays 0.1.2.
- RULE GOING FORWARD: any versionCode bump must be committed to `master` with a decision entry
  here. No untracked local version changes. A build's versionCode is canonical only if it's in
  the repo.
- Source: founder chat 2026-07-19 ("there should be the last built version saved to repo").

## 2026-07-19 — Node auto-deploys on green master build (founder directive, overrides manual gate)
- PRIOR STATE: `redeploy-node` CI job was MANUAL-ONLY (workflow_dispatch + type "REDEPLOY-NODE").
  Mission Control (and any feature behind way_econo* etc.) stayed DOWN until a human
  manually triggered it. This caused repeat outages (e.g. PR #95 merged 2026-07-19 but
  node never redeployed → Mission Control showed "node unreachable").
- NEW RULE (founder, 2026-07-19, "I want that binary to always update immediately after
  successful build... we have NO live users"): on a SUCCESSFUL `push` to `master`
  (build-test + strix-security green), the node MUST auto-redeploy:
    build linux/amd64 CGO_ENABLED=1 binary → pipe to AWS /usr/local/bin/waychain →
    sudo systemctl restart waychain.service → verify new sha256.
- RATIONALE: no live users = zero disruption risk; the cost of a stale node (dead features,
  false "node unreachable" outages) now exceeds the cost of auto-deploy. Manual gate removed.
- SAFEGUARD KEPT: deploy runs ONLY after build-test + strix-security pass (not on PR, not on
  failure). Still verifies the live binary sha256 post-restart so a bad push is detectable.
- Source: founder chat 2026-07-19.

## 2026-07-19 — Mission Control outage root cause (truth-first record)
- SYMPTOM: waychain.org/mission-control showed "The economy engine may not be deployed to the
  live node yet, or the RPC is down. Details: Failed to fetch."
- ROOT CAUSE (verified live): RPC node is UP (way_validatorCount=3), but the live binary
  predates PR #95 — way_econoIndicators / way_econoPolicy / way_swayEmissionProjection return
  "method not found". The page calls those three; they don't exist on the running node.
- FIX: auto-deploy rule above resolves this permanently. Once a green master build runs, the
  node gets the #95 binary and Mission Control comes back up on its own.
