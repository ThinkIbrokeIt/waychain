# Next Session Plan — WayChain

> Written 2026-11-06 after the structural-unification session. NOT yet executed.
> Review before acting. Truth-first; issue-first.

## Context (what's DONE)
- `main` == `master` (0/0 divergence). `master` re-protected. Single SoT.
- Monorepo severed from `waychain-consensus` mirror (symlinks → real files). Mirror pristine.
- `mobile/` working subtree gitignored (77 real files kept on disk).
- Full compile verified: consensus Go binary ✅, contracts Foundry ✅, site live-tested vs local node ✅.
- `version.json` + `protocol-manifest.json` = 28 precompiles (0x0C–0x27, 0x21=Keccak256, 0x27=GasFaucet), matching live node.
- Local node running on :9545; cloudflared tunnel `waychain-rpc` → api.waychain.org UP.

## Tier 1 — Clear drift-noise backlog (quick)
The 20+ `[DRIFT]`/`Version drift` issues (#181–#204) are AWS-era cron artifacts.
AWS is closed; local node is SoT; drift-checker now treats AWS-down as infra (#204 merged).
- Bulk-close with one note: "AWS closed; local node is SoT; obsolete."
- Goal: board readable, real issues surfaced.

## Tier 2 — Real bugs flagged this session (unresolved)
1. **Wallet balance shows 0** — `wallet/index.html` `refreshBal()` calls
   `way_getBalance([64-hex pubkey])`; live node returns `0x0` for 64-hex, `0x14` for 20-hex.
   Fix: use `w.address` (20-hex) or `eth_getBalance`. Verify vs live node, then patch on branch + PR.
2. **"29 WIFR quests all complete"** — source never located (not in monorepo site).
   Next session: serve site locally, click through WIFR/quests UI; or probe
   `way_taskStatus`/`way_questCap` to find where "complete" is rendered. Identify source first.

## Tier 3 — WIFR-mobile removal (rule lifted, your call)
You wanted WIFR out of mobile. `waychain-mobile` is now editable (read-only rule lifted).
- Target: `waychain-mobile` mirror → remove `WIFRScreen.js`, `App.js` 2 refs,
  `rpc.js` `WIFR: precompileAddress('0x21')`, `precompiles.js` `WIFRGantletRewards`.
- Do on branch, PR. Confirm with user WHICH repo (mobile mirror vs web `waychain-site`) before acting.

## Tier 4 — Housekeeping
- Prune ~50 stale local branches (keep main/master + active few).
- Foundry lint warnings (`WIFRCertificationBadge.sol` unsafe-typecast) — cosmetic, optional.

## Open question for user
Which tier first next session? Recommend Tier 1 (5 min, unblocks the board) → Tier 2 (#1 wallet, real user-facing bug).
