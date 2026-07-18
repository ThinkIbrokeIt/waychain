# WayChain Decisions Log

Living record of binding protocol decisions. Every entry is tagged with date + exact source.
When code drifts from a decision below, the code is wrong — fix the code, not this log.
Doctrine: one source of truth, truth-first, no silent drift.

---

## 2026-07-18 — Token roles: WAY vs SWAY (founder, verbal + chat)
- **WAY** (100M fixed genesis supply): incentive token for **genesis dev + base user ONLY**.
- **SWAY** (0x24): the **ecosystem incentive token for ALL FUTURE USERS** (task economy + DEX LP + onboarding).
- WAY routed to the quest pool (treasury 0x03) continues to pay the task economy
  (TaskRegistry 0x23 pulls reward from 0x03). Confirmed already implemented.
- Source: founder chat 2026-07-18 ("sway needs to be the incentive token for the ecosystem...
  only genesis dev and base user will get the WAY... future will get SWAY. the way we have
  going to the pool will used to pay task economy").

## 2026-07-18 — SWAY monetary policy + supply (founder approved model)
Model approved: **inflationary + phase-controlled, with a hard-ceiling safety rail** (NOT a
rigid small cap — runs out of bullets; NOT unbounded — dilution risk).
- **Initial supply: 1,000,000,000 (1B) SWAY** = 10× WAY. ("a lot more")
- **Hard ceiling: 10,000,000,000 (10B) SWAY** (100× WAY) — cannot be crossed; safety rail only.
- **Base emission: ~2–3%/yr of circulating**, ADJUSTED by the econo phase engine (econo_loop.go):
  - Expansion → reduce emission + boost burn.
  - Consolidation → raise emission (stimulus, fund future-user task rewards).
- **Allocation of initial 1B:**
  - Future-user task incentives: **45% (450M)**
  - DEX LP rewards: **20% (200M)**
  - Ecosystem / community fund: **15% (150M)**
  - Core team & contributors: **12% (120M)** — 18mo cliff + 4yr linear
  - Early backers: **8% (80M)** — 12mo cliff + 3yr linear
- **Burn flywheel:** DEX swap-fee share (~20% of the 0.3% swap fee) + task-economy fee share
  → buyback & burn SWAY. Expansion phase boosts burn rate.
- **Vesting:** team/backers vested (cliff + linear per above). Future-user task rewards are
  time-locked (1–4 weeks) to prevent farm-and-dump.
- **veModel (gauge) — Phase 2 optional:** lock SWAY for veSWAY to direct LP emissions.
- Source: founder chat 2026-07-18, approving the proposal in issue #96
  ("yes it is" = approve 1B initial / inflationary-adaptive / 10B ceiling / 45-20-15-12-8 split).

## 2026-07-18 — Economic health model is Go-core, Solidity is app-layer mirror (founder)
- The four indicators + phase + feedback loop are computed by the Go core (econo_loop.go),
  fed by real on-chain events (sha256 core hashing preserved).
- Solidity EconoAnalytics.sol / ProfessionalSBT.sol are the app-layer mirror (oracle-fed),
  not the source of truth.
- Source: founder chat 2026-07-18 ("deploy real Solidity contracts" + "sha256 stays core
  hashing — not an app-layer luxury"). See PR #95 / issue #93.
