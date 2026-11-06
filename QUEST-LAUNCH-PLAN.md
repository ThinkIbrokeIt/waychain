# WayChain Quest Launch — Reality Check + Plan

> Governed by REPO_LAW (single working tree), issue-first workflow (issue → branch → PR),
> and the kanban. This plan is the ONLY authorized sequence. No step executes without
> an issue + branch + PR, and no phase starts until the prior phase is verified.

## Reality Check (2026-07-16, verified)

| Component | Status | Evidence |
|-----------|--------|----------|
| 28-quest TaskRegistry program | ✅ merged to master (PR #7), ❌ not deployed | git log origin/master shows #7 merged; live node `way_getBalance`/RPC lacks `way_taskStatus` |
| Autopilot oracle (0x23) | ✅ merged to master (PR #9), ❌ not deployed | same — code in master, not on AWS |
| Manifest SoT fix | ✅ merged (PR #5) | merged |
| 1.1M WAY quest pool | ❌ NOT funded | no `questFund` call ever; live `way_getBalance(0x03)` = `0x0` |
| Autopilot designation | ❌ NOT set | no `questSetAutopilot` call; `way_questGetAutopilot` returns "" |
| Off-chain autopilot BOT | ❌ NOT built | no daemon in repo |
| WIFR → 0x1F → autopilot door | ⚠️ half-wired | `wifr-bridge` task + `SolanaChainID` exist in code; 0x1F precompile exists; NO Solana watcher, NO page deep-link |
| AWS live node | ❌ running OLD binary | pre-#7/#9 code; `way_taskStatus` unknown to it |
| Treasury 0x03 genesis | ✅ 10,000,000 WAY seeded | genesis.go:52 (general treasury, separate from quest pool) |

## Goal
Make the quest system LIVE and EARNABLE: real users complete real on-chain tasks,
the autopilot verifies objective ones automatically, and the WIFR burn on Solana is
the door that opens the Quest. Validation of what we built, by real users.

## Phases (strict dependency order)

### Phase 1 — Deploy merged master to AWS
- [ ] Rebuild binary linux/amd64 from origin/master (CGO_ENABLED=1)
- [ ] Pipe to server, swap /usr/local/bin/waychain, restart waychain.service
- [ ] VERIFY live node: `way_taskStatus` responds, `way_questGetAutopilot` responds,
      `way_questPoolRemaining` returns 0 (unfunded but callable)
- [ ] Update OPS-LEDGER: deployed commit + version

### Phase 2 — Activate the quest economy (founder actions)
- [ ] Founder calls `questFund(1100000)` on 0x23 to fund the pool
- [ ] Founder calls `questSetAutopilot(<L3 key>)` to designate the autopilot
- [ ] VERIFY `way_questPoolRemaining` > 0 and `way_questGetAutopilot` returns the addr
- [ ] VERIFY a manual taskVerify (human path) pays WAY to a test account

### Phase 3 — Off-chain autopilot BOT
- [ ] Build daemon: poll new blocks → detect taskClaim on auto-eligible task
- [ ] Confirm on-chain condition per task (vault exists, transfer happened, etc.)
- [ ] Call `taskAutoVerify` with autopilot key
- [ ] VERIFY end-to-end: trigger a taskClaim, bot auto-verifies, claimant balance increases

### Phase 4 — WIFR door end-to-end
- [ ] Solana WIFR burn watcher feeds 0x1F CrossChainAttestation (witnessEvent)
- [ ] Bot treats `wifr-bridge` proof = valid 0x1F attestation → auto-verifies
- [ ] WIFR page deep-links into the WayChain Quest (copy: "burn WIFR = your key")
- [ ] VERIFY: burn 1 WIFR on Solana → attest → autopilot accepts → Quest opens

### Phase 5 — Social reveal + validation monitoring
- [ ] Reveal to WIFR holders (Solana community = crypto-native base)
- [ ] Ops dashboard: pool remaining, claims/day, autopilot health
- [ ] VERIFY real users earning WAY; tune auto-eligible set / rewards from data

## Checklist (final)
- [ ] Live node runs merged master (not old binary)
- [ ] Pool funded + autopilot designated + bot running
- [ ] At least 1 real user earned WAY via autopilot
- [ ] WIFR door proven (burn → attest → accept)
- [ ] OPS-LEDGER reflects all of the above as verified facts
