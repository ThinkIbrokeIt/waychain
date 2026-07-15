# WayChain — Umbrella / Archive Index

> **⚠️ NOT THE SOURCE OF TRUTH.**
>
> This monorepo folder is a **historical umbrella** and partially dirty local mirror.
> Do **not** edit protocol code here. Do **not** treat this AGENTS.md as protocol truth.

## Canonical sources (2026-07-15 freeze — consensus issue #23)

| Layer | Canonical home | Branch |
|---|---|---|
| **Protocol code** | [`ThinkIbrokeIt/waychain-consensus`](https://github.com/ThinkIbrokeIt/waychain-consensus) | `master` |
| **Protocol machine SoT** | `waychain-consensus/protocol-manifest.json` (generated from `evm/precompiles.go`) | — |
| **Live deploy** | **AWS `3.89.116.45`** `/usr/local/bin/waychain` + `/home/ubuntu/.waychain/chain.db` | service `waychain.service` |
| **Site** | [`ThinkIbrokeIt/waychain-site`](https://github.com/ThinkIbrokeIt/waychain-site) — local symlink `site/` → `../waychain-site` | **`main`** (not master) |
| **Mobile** | [`ThinkIbrokeIt/waychain-mobile`](https://github.com/ThinkIbrokeIt/waychain-mobile) | `main` |
| **Operator releases** | [`ThinkIbrokeIt/waychain-client`](https://github.com/ThinkIbrokeIt/waychain-client) | release tags from consensus |
| **Contracts** | [`ThinkIbrokeIt/waychain-contracts`](https://github.com/ThinkIbrokeIt/waychain-contracts) | **LEGACY only** |
| **Blueprint / plan** | `projects/WAYCHAIN_BLUEPRINT` | design, not live |
| **Work tracking** | GitHub Issues on the repo that owns the layer | not chat |

## Hard facts (do not re-derive from this tree)

- **27 precompiles** at **0x0C–0x26** (not 20/21/22)
- **0x21 = WIFRGantletRewards** — **not** Keccak256
- Selectors = `sha256(signature)[:4]` everywhere
- EOA account key / `tx.from` / `way_getBalance` = **full 64-hex** ed25519 pubkey; 20-byte is display-only
- Precompile calldata address args = **raw 20-byte**
- coded ≠ deployed ≠ live — AWS binary hash proves deploy; client DOM proves user-facing live

## Local layout (convenience only)

```
waychain/
├── AGENTS.md          ← this file (umbrella demotion notice)
├── consensus/         ← STALE/DIRTY local mirror — use waychain-consensus repo
├── site/              ← symlink → ../waychain-site (edit there)
├── contracts/         ← LEGACY accession of Solidity
├── blueprint/         ← partial copy; prefer WAYCHAIN_BLUEPRINT
└── ...
```

## What agents must do

1. Work in the **canonical GitHub repo** for the layer you touch.
2. File a **GitHub issue** before drift-class fixes (address form, counts, selectors).
3. After protocol merges, **redeploy AWS** and record binary sha256 (issue #27).
4. Never update this monorepo’s `consensus/` and claim the chain was fixed.

Parent tracking: ThinkIbrokeIt/waychain-consensus#23
