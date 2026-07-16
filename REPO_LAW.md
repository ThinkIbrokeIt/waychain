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
| `contracts/` | **LEGACY** PulseChain-era Solidity (reference only) |
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
2. Count is **27** addresses **0x0C–0x26**. Claims of 20/21/22 without reconciling the manifest are illegal.
3. **0x21 = WIFRGantletRewards**, never Keccak256.
4. Run before claiming protocol consistency:
   ```bash
   cd consensus && bash scripts/audit-consistency.sh
   cd ../site && bash scripts/check-precompile-count.sh   # when present
   ```
5. Address model (non-negotiable wire truth):
   - EOA account key / `tx.from` / `way_getBalance` = **full 64-hex** ed25519 pubkey  
   - 20-byte form = **display only**  
   - Precompile calldata addresses = **raw 20-byte**  
   - Selectors = `sha256(sig)[:4]`

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

## Article VIII — Amendment

1. Only the founder amends this law (or an agent under explicit “amend REPO_LAW” order with a PR).
2. Soft docs (handoffs, audits, marketing) **never** override REPO_LAW or `protocol-manifest.json`.
3. If law and convenience conflict, **law wins**. Convenience that recreates dual trees is forbidden.

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
