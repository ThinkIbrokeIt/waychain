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
