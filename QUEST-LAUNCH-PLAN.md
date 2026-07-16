# WayChain Quest Launch — Reality Check + Plan

> Governed by REPO_LAW (single working tree), issue-first workflow (issue → branch → PR),
> and the kanban. This plan is the ONLY authorized sequence. No step executes without
> an issue + branch + PR, and no phase starts until the prior phase is verified.
>
> **FUNDING RULE (founder decision 2026-07-16):** funding the treasury (questFund)
> is the LAST action, executed immediately before the public reveal (Phase 5).
> All build/test/dry-run work (Phases 1–4) happens on the deployed-but-UNFUNDED
> node. The cap is enforced and callable (returns 5M) without real WAY flowing.
> Funding is the capstone switch — do not fund until everything else is proven.

## Reality Check (2026-07-16, verified)

| Component | Status | Evidence |
|-----------|--------|----------|
| 28-quest TaskRegistry program | ✅ merged (PR #7) | in master |
| Autopilot oracle (0x23) | ✅ merged (PR #9) | in master |
| Quest cap = 5% of live supply | ✅ merged (PR #11) | in master |
| Supply-seed-at-genesis fix | ✅ merged (PR #12) | in master |
| Manifest SoT fix | ✅ merged (PR #5) | merged |
| **AWS live node** | ✅ **DEPLOYED + VERIFIED** | 2026-07-16 19:34: way_wayTotalSupply=100M, way_questCap=5M, way_questPoolRemaining=5M |
| Treasury 0x03 | ❌ UNFUNDED (intentional — last step) | live balance 0x0 |
| Autopilot designation | ❌ NOT set | way_questGetAutopilot returns "" |
| Off-chain autopilot BOT | ❌ NOT built | no daemon in repo |
| WIFR → 0x1F → autopilot door | ⚠️ half-wired | wifr-bridge task + SolanaChainID exist; 0x1F exists; NO Solana watcher, NO page deep-link |

## Goal
Make the quest system LIVE and EARNABLE: real users complete real on-chain tasks,
the autopilot verifies objective ones automatically, and the WIFR burn on Solana is
the door that opens the Quest. Validation of what we built, by real users.

## Phases (strict dependency order)

### Phase 1 — Deploy merged master to AWS  ✅ COMPLETE (2026-07-16)
- [x] Rebuild binary linux/amd64 (CGO_ENABLED=1, `go build -a` — cache unreliable)
- [x] Pipe to server, swap /usr/local/bin/waychain, restart waychain.service
- [x] VERIFY live: way_wayTotalSupply=100M, way_questCap=5M, way_questPoolRemaining=5M
- [x] Update OPS-LEDGER: deployed commit 2cffefc + verified facts
- NOTE: two defects caught + fixed during verification (build-cache staleness,
  supply-seed discarded by persisted store). Both merged (PR #11, #12) + redeployed.

### Phase 2 — Designate autopilot (BUILD phase, NO funding yet)
- [ ] Founder calls `questSetAutopilot(<L3 key>)` to designate the autopilot oracle
- [ ] VERIFY `way_questGetAutopilot` returns the addr
- [ ] (treasury stays empty — cap enforcement works without funds; payouts only
      succeed once funded in the final step)
- NOTE: this is a founder-action (your L3 key) but it is NOT funding — safe to do
  now so Phases 3–4 can be tested against the live autopilot designation.

### Phase 3 — Off-chain autopilot BOT
- [ ] Build daemon: poll new blocks → detect taskClaim on auto-eligible task
- [ ] Confirm on-chain condition per task (vault exists, transfer happened, etc.)
- [ ] Call `taskAutoVerify` with autopilot key
- [ ] VERIFY end-to-end on unfunded node: trigger a taskClaim, bot auto-verifies,
      claimant marked verified (balance increase only after funding, but verify
      path must be proven)

### Phase 4 — WIFR door end-to-end
- [ ] Solana WIFR burn watcher feeds 0x1F CrossChainAttestation (witnessEvent)
- [ ] Bot treats `wifr-bridge` proof = valid 0x1F attestation → auto-verifies
- [ ] WIFR page deep-links into the WayChain Quest (copy: "burn WIFR = your key")
- [ ] VERIFY: burn 1 WIFR on Solana → attest → autopilot accepts → Quest opens

### Phase 5 — FUND + REVEAL (capstone)
- [ ] **FINAL STEP — Founder calls `questFund(<amount>)` on 0x23** (last action
      before reveal; this is the switch that makes payouts real)
- [ ] VERIFY `way_questPoolRemaining` > 0 (now reflecting real funded treasury)
- [ ] **Reveal** to WIFR holders (Solana community = crypto-native base)
- [ ] Ops dashboard: pool remaining, claims/day, autopilot health
- [ ] VERIFY real users earning WAY; tune auto-eligible set / rewards from data

## Checklist (final)
- [x] Live node runs merged master (Phase 1 ✅)
- [ ] Autopilot designated (Phase 2)
- [ ] Bot running + proven (Phase 3)
- [ ] WIFR door proven (Phase 4)
- [ ] **Treasury funded** (Phase 5 — LAST)
- [ ] At least 1 real user earned WAY via autopilot
- [ ] OPS-LEDGER reflects all of the above as verified facts
