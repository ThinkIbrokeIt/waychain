# WAYCHAIN REPO LAW
**Status:** BINDING · **Authority:** Founder directive (stated ≥3 times) + confirmed 2026-07-15 · **Effective:** 2026-07-15  
**Tracked by:** ThinkIbrokeIt/waychain#1 · **Branch:** `feat/one-tree-repo-law`

This is not guidance. This is **law**. Agents and humans who violate it create the drift that has destroyed progress.

> **Authority decision (2026-07-15):** The monorepo `/home/wink/projects/waychain` (remote `ThinkIbrokeIt/waychain`) IS the single source of truth. The former standalone satellites (`waychain-consensus`, `waychain-site`, `waychain-mobile`) are now **ARCHIVED READ-ONLY MIRRORS** (see Article II). This resolves the prior contradiction: their AGENTS.md "monorepo is NOT SoT" language is voided by this law. If you find that stale claim in a satellite AGENTS.md, treat it as legacy text and do not obey it.

## Article I — One working tree

1. There is **one** writable working tree for WayChain product development:
   ```
   /home/wink/projects/waychain
   → https://github.com/ThinkIbrokeIt/waychain
   ```
2. **Branches** express unfinished work. **Extra clones / sibling repos do not.**
3. Creating a new `waychain-*` source repo “for clarity,” “for deploy,” or “temporary” **without Foundation approval** is a law violation.
4. `cd` target for any feature work is the monorepo (or a path **inside** it). Not `~/projects/waychain-consensus`, not a fresh clone of a satellite.

### Layout (the tree)

| Path | Lawful content |
|---|---|
| `consensus/` | Go L1 protocol only |
| `site/` | waychain.org frontend |
| `mobile/` | Expo wallet |
| `contracts/` | **Application layer** (Solidity) — in-scope, NOT legacy. Connects to core via keccak (see Article X). |
| `blueprint/` | Design / plan (not live) |
| `protocol-manifest.json` | Machine SoT for precompile inventory |
| `REPO_LAW.md` | This file |
| `AGENTS.md` | Agent map that **points here** |
| `ops/` (optional) | Deploy notes, binary sha records |
| `archive/` / `backup/` | Only non-edit historical material |

AWS `3.89.116.45` is the **live node** (binary + chain.db). It is **not** a second source tree. Record binary sha after deploys.

---

## Article II — Satellite status (READ-ONLY after combine)

Legacy GitHub remotes may still exist for history. They are **not** edit homes:

| Old standalone | Status under Law |
|---|---|
| `ThinkIbrokeIt/waychain-consensus` | **MIRROR / ARCHIVE** — content lives in monorepo `consensus/` |
| `ThinkIbrokeIt/waychain-site` | **MIRROR / ARCHIVE** — content lives in monorepo `site/` |
| `ThinkIbrokeIt/waychain-mobile` | **MIRROR / ARCHIVE** — content lives in monorepo `mobile/` |
| `ThinkIbrokeIt/waychain-client` | **Release packaging only** — must not diverge protocol source; build FROM monorepo `consensus/` tags |
| `ThinkIbrokeIt/waychain-contracts` | **LEGACY ARCHIVE** |
| `ThinkIbrokeIt/WAYCHAIN_BLUEPRINT` | Spec archive; prefer monorepo `blueprint/` after sync |

**Rule:** If a path is not under `~/projects/waychain/` (except AWS ops and true `~/backups/`), an agent **MUST refuse to edit product code there** and redirect to the monorepo.

True backups are labeled backup (e.g. `~/backups/waychain-*`, `chain.db.bak-*`). Those are not working trees.

---

## Article III — Work unit

1. **Issue first.** No silent patches. `gh issue create` on `ThinkIbrokeIt/waychain` (or child issue linked from a parent).
2. **Branch:** `fix/<topic>` or `feat/<topic>` from monorepo default branch.
3. **PR required** into protected default branch. Status checks gate merge.
4. **One concern per PR** when possible. No “while I was here” multi-tree edits.
5. **Close issues with evidence** (commit, sha, DOM, RPC) — not “done.”

### Article III-A — Downstream staleness MUST have an issue before green (founder directive 2026-07-20)

> Any change to `master` (HEAD) that will cause **any part of the downstream** to become stale — not just precompiles, but **everything downstream**: RPC surface, client/wallet address handling, mobile, site, contracts, deploy scripts, protocol-manifest.json, ops dashboards, docs — **must have a tracking issue filed BEFORE the PR is allowed to go green/merge.**
>
> Rationale (founder, 2026-07-20): "when a change to the head is going to cause any part of the downstream staleness then issue must be created before getting a green on the PR. not just with precompiles. everything down stream. how else will we keep up with whats what downstream."
>
> Procedure:
> 1. Before merging a PR that alters a shared interface, address format, RPC method, precompile, storage key, or deploy contract, the author files (or cites) an issue enumerating **every downstream consumer** that must be reconciled.
> 2. The PR description links that issue. CI/reviewer must confirm the issue exists and lists downstream touch-points.
> 3. The downstream issue stays OPEN until each consumer is reconciled and verified (coded + deployed/live as applicable).
> 4. This is how we keep "what's what downstream" auditable without a daily manual walk — the issue tracker IS the map.
>
> A PR that merges protocol/interface changes without its downstream issue is a law violation (collapses the three states and hides drift).

---

## Article IV — Three states (never collapse)

| Word | Means | Proof |
|---|---|---|
| **coded** | In monorepo, builds/tests | `go test` / `npm test` / file on branch |
| **deployed** | On AWS node | binary **sha256** on `3.89.116.45` + service active + feature strings if claimed |
| **live** | User-path works | browser/mobile DOM or real tx observation — **not** agent curl alone |

“Merged on GitHub” ≠ deployed ≠ live.

---

## Article V — Machine SoT (drift must fail CI)

1. Precompile inventory: **`protocol-manifest.json`** generated from `consensus/evm/precompiles.go`.
2. Count is **28** addresses **0x0C–0x27** (GasFaucet added at 0x27). Claims of 20/21/22 without reconciling the manifest are illegal.
3. **0x21 = Keccak256** precompile (app-layer hashing bridge). It was temporarily
   WIFRGantletRewards; that reward pool is RETIRED (function subsumed by the
   wifr-bridge quest at TaskRegistry 0x23, paid from treasury 0x03). Selection
   of this address for Keccak256 is the originally-intended July 4 design.
4. Run before claiming protocol consistency:
   ```bash
   cd consensus && bash scripts/audit-consistency.sh
   cd ../site && bash scripts/check-precompile-count.sh   # when present
   ```
5. Address model (non-negotiable wire truth):
   - EOA account key / `tx.from` / `way_getBalance` = **full 64-hex** ed25519 pubkey  
   - 20-byte form = **display only**  
   - Precompile calldata addresses = **raw 20-byte**  
   - Core precompile selectors = `sha256(sig)[:4]` (see Article X for the app-layer split)

---

## Article VI — Agent duties (alignment protocol)

When the founder says an agent is drifting, or an agent notices dual homes:

1. **STOP** editing.
2. Re-read **`REPO_LAW.md`** and monorepo **`AGENTS.md`**.
3. Answer: which layer, which path under monorepo, coded/deployed/live.
4. Refuse satellite edits. Redirect: “Work in ThinkIbrokeIt/waychain.”
5. File or cite a GitHub issue before continuing.
6. After protocol merges that claim deploy: AWS sha in the issue/PR.

Founder hard interrupt chat block is valid law hearing — obey immediately.

---

## Article VII — Deploy joints (still one tree)

Platform roots are **folders**, not justification for new repos:

| Platform | Root inside monorepo |
|---|---|
| Vercel (waychain.org) | `site/` |
| Expo / mobile builds | `mobile/` |
| Go daemon / CGO CI | `consensus/` |
| AWS binary | **built from** `consensus/` |

Rebind project settings to monorepo paths. Do not “split to make Vercel happy.”

---

## Article X — Layer hash split (core sha256 / app layer keccak256)

Ratified 2026-07-17, correcting stale clauses that read the Solidity app layer as dead. Basis: founder decision 2026-07-04 (add a keccak precompile for the contract layer) and 2026-07-17 ratification ("Go core + Solidity app layer are both in-scope").

1. **Core protocol = sha256.** Blocks, Merkle trees, P2P wire, tx hashes, precompile internal storage keys, and core precompile ABI selectors use `sha256(sig)[:4]`. This is the established, live behavior — do not change it (changing wipes state, per the 2026-07-04 risk assessment).
2. **Application layer (Solidity contracts) = keccak256.** Contract address derivation already uses keccak256 (`consensus/evm/deploy.go` uses `sha3.NewLegacyKeccak256`). The dedicated keccak precompile (planned 2026-07-04) is tracked separately; its `0x` address is assigned when built (0x21 is taken by WIFRGantletRewards).
3. **`contracts/` is in-scope application-layer code, NOT legacy.** The "LEGACY / superseded" framing in `contracts/AGENTS.md` is rescinded. Solidity contracts are the app layer; Go precompiles are the core. Both ship.
4. **Selector mismatch is the open bridge task, not a death sentence.** A standard Solidity contract emits keccak256 selectors; core precompiles dispatch on sha256 selectors. Reconcile via the keccak precompile / app-layer dispatch path — file and track it, do not declare the app layer dead.

---

## Article VIII — Amendment

1. Only the founder amends this law (or an agent under explicit “amend REPO_LAW” order with a PR).
2. Soft docs (handoffs, audits, marketing) **never** override REPO_LAW or `protocol-manifest.json`.
3. If law and convenience conflict, **law wins**. Convenience that recreates dual trees is forbidden.

---

## Article X — Hash law (core sha256 / app keccak256)

Ratified 2026-07-17 (founder directive; work in #59/#60/#63):

1. **CORE protocol = sha256.** All native precompile *selectors* and dispatch use
   `sha256(sig)[:4]`. On-chain storage keys may use any scheme but native
   precompiles MUST NOT rely on keccak for dispatch.
2. **APP LAYER (Solidity) = keccak256.** Contracts under `contracts/` and the
   mobile/web app layer speak Ethereum-compatible keccak256. To let on-chain
   Solidity compute keccak deterministically, the core exposes the
   **Keccak256 precompile at 0x21** (`hash(bytes)` → bytes32, `hash4(bytes)` → bytes4).
   Its *own* selector still uses the core sha256 convention.
3. A mismatch between a Solidity selector (keccak) and a core precompile selector
   (sha256) is **expected and correct** — it is the layer boundary, not a bug.
   Do NOT "fix" it by forcing one hash everywhere.

---

## Article IX — Acceptance test (“is the agent following the law?”)

An agent is compliant only if ALL are true:

- [ ] Working directory under `…/projects/waychain` for product edits  
- [ ] No feature commits to satellites listed Article II  
- [ ] Issue number exists for the work  
- [ ] Precompile / address claims match `protocol-manifest.json` or fail openly  
- [ ] Deploy claims include AWS or are labeled coded-only  
- [ ] Did not invent a new sibling repo  

Fail any → realign; do not ship fiction.

---

**One chain. One tree. Branches for work. Backups labeled backup. Everything else is how we got the mess.**
