# RENT LEDGER — community infra pays for itself (WAY, not profit)
**Status:** Design (Step 5 of DECENTRALIZATION-DOCTRINE.md) · **Ratified:** 2026-07-24

## Principle
A member who uses community resources (RPC calls, storage bytes, bandwidth,
frontend hosting) pays **rent in WAY**. Rent is **custodial + non-extractive**:
- Held by the foundation/stewards, spent ONLY on the resource it was collected for.
- Transparent: every debit is an on-chain WAY transfer, publicly auditable.
- Surplus grows capacity (more nodes, more storage) — never pads a treasury.

This is the inverse of the mainstream model: we pay OURSELVES to keep the
lights on, instead of renting our own data back from a corporation.

## Mechanism
1. **Resource metering** — each community service (RPC node, MinIO bucket,
   nginx host) emits usage: bytes stored, requests served, bandwidth.
2. **Rent price** — a flat, low WAY rate per unit (e.g. 1 WAY / 1M req,
   1 WAY / GB-month). Set by governance,可调 down as capacity scales.
3. **Ledger** — a WayChain precompile or contract (0x??) tracks per-account
   balances + debits. `rentDebit(account, resource, amount)` transfers WAY
   from member → steward address (3.89... node ops / foundation 0x03).
4. **Grace** — new members get a free tier (foundation-pays-gas model).
   Unpaid rent past grace → resource throttled, not seized.
5. **Capacity growth** — steward WAY funds new hardware; surplus = expansion.

## Why WAY
WAY is the community's own token — rent circulates inside the economy, not
leaking to fiat/corp. Aligns with 98/2 TrustlessLock + foundation-pays-gas:
the community funds its own survival, no outside lever.

## Deploy (the 1% flip)
- MinIO: `ops/minio-compose.yml` on community hardware.
- Ledger: deploy `contracts/RentLedger.sol` (app layer, keccak selector per
  REPO_LAW Article X) + wire metering daemons to call `rentDebit`.
- Until then: rent is tracked manually; the doctrine stands as the rule.
