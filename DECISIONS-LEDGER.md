# WayChain Decisions Ledger (shorthand, with source)

> Running record of founder decisions + where/when made. Truth-first: if code
> disagrees with a line here, the line here wins UNTIL the founder reverses it.
> Update this file the moment a decision is made — not after.

## Genesis / Supply
- **[2026-07-17] 100M total supply** — `genesis.go:43` Supply: 100_000_000. LIVE.
- **[2026-07-17] treasury 0x03 = 10M, ecosystem = 13.5M seeded; rest (76.5M) deferred to inflation** — `genesis.go:52-54`. LIVE IN CODE.
- **[2026-07-17] "equal per human" distribution = SHELVED** — founder: "thats because it doesnt make sense and why it got shelved." NOT in code, NOT to be implemented. Roadmap doc (`NEW_CHAIN_SUPPLY_ROADMAP.md`) still falsely claims 100M equal-per-human — DOC DRIFT, fix pending.
- **[2026-07-17] 95M treasury + 5% live decision** — founder: "95 million just happened yesterday when we decide a live 5% would be better for short and longterm." REPLACES the 10M/13.5M/76.5M model. **NOT YET IN CODE.** Action: edit genesis.go → treasury 95M (long-term), 5M live (ecosystem/liquid). Faucet seed comes from live pool or treasury.
- **[2026-07-17] Inflation 7%→3% floor, bounds 3–9%** — `inflation.go`. LIVE.

## Gas / Faucet
- **[2026-07-18] WAY is gas, charged per-tx (GasUsed×gasPrice+value from sender WAY balance)** — `chain.go:480-507`. LIVE.
- **[2026-07-18] Quest trackers + new users need gas; no faucet existed** — founder flagged.
- **[2026-07-18] Build GasFaucet precompile 0x27** — drip WAY to caller, rate-limited, reserve seeded from treasury. CODED (`consensus/evm/faucet.go`) but NOT registered in PrecompilesTable + NOT seeded at genesis + node NOT rebuilt/redeployed. Issue #90. BLOCKER for deploy (founder has no gas to approve).

## Creator Badge (L-9)
- **[2026-07-17] WayChainCreatorBadge.sol = soulbound NFT, NOT a precompile** — founder: "its not a precompile its some we decided we be best for launch so if any thing goes wrong we have control until creator badge is retired." LIVE IN `contracts/src/WayChainCreatorBadge.sol`.
- **[2026-07-17] Founder control until retired, then AUCTION (collectors)** — contract encodes: mintCreator (creator-only) → rank ladder → retireCreator (needs stability≥50) → auctionable. Line 9: "No god mode — pure bragging rights and future auction value."
- **[2026-07-18] Drop clue "L-9" ON the badge** — founder: "i say we drop another clu on the badge itselve. clue...L-9". DONE: `clue="L-9"` + `dropClue()` founder-only + Clue trait in tokenURI.
- **[correction 2026-07-18] Keccak bridge = NOT a blocker.** 0x21 Keccak256 precompile ALREADY live (`keccak_precompile.go` + `keccak_precompile_test.go` passing; `precompiles.go:148`). `contracts/AGENTS.md` says "do NOT deploy .sol until bridge lands" — STALE, bridge (0x21) has landed. Real status: badge mainnet = untested integration (deploy + keccak-selector call), NOT blocked by missing primitive. Needs a deploy+call test, not new code. Drift source: I trusted the stale AGENTS.md doc over the live code.

## Mobile App
- **[2026-07-18] Scan-to-Pay camera crash FIXED** — root cause: `useCameraPermission()` returns OBJECT in vision-camera 4.6.4, was array-destructured. v0.1.1. PR #89. LIVE on device.
- **[2026-07-18] Staking tab = 2 sections (2WAY vault + WAY operator staking)** — founder: "should be native staking as well." v0.1.2. Built, NOT yet PR'd.
- **[2026-07-18] Version was stuck at 0.1.0/code 1** — now 0.1.2. Founder questioned why unchanged.

## Explorer / Infra
- **[2026-07-18] waychain-explorer.service died at 05:01 (node bounce), no auto-restart** — RESTARTED; added `PartOf=waychain.service` + existing `Restart=always` so node restart pulls explorer up. LIVE.

## Web / Site
- **[2026-07-18] Home needs a menu; mobile hamburger menu is broken** — founder. PENDING.
- **[2026-07-18] Getting-started walkthrough needs realignment with SoT** — founder. PENDING.
- **[2026-07-18] Each web page must align with mobile wallet UI** — founder. PENDING.
- **[2026-07-18] Post working APK download on the wallet page** — founder. PENDING (APK v0.1.2 built, not yet hosted/linked).
- **[2026-07-18] Web "Get Test WAY" button is BROKEN** — hits `RPC + '/faucet'` (explorer endpoint that doesn't exist). Must rewire to 0x27 drip once node has it.

## Open pre-deploy actions (in order)
1. Edit genesis.go: 95M treasury + 5M live (+ faucet seed). [from 95M decision]
2. Register 0x27 in PrecompilesTable + seed faucet reserve at genesis. [faucet]
3. Build + REDEPLOY node (AWS 3.89.116.45) with new genesis + faucet. [reset, no users yet]
4. Wire mobile + web "Get Test WAY" to 0x27 drip.
5. Web tidy: home menu, fix hamburger, walkthrough realignment, APK link on wallet page, web↔mobile alignment.
6. Patch roadmap doc: remove false "equal per human 100M genesis" claim. [shelved decision]
7. Keccak bridge: blocker for creator badge mainnet. [separate task]
