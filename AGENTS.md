# WayChain — Agent entry (ONE TREE)

> **Read `REPO_LAW.md` first. It is binding.**
>
> Working tree: `/home/wink/projects/waychain` · Remote: `ThinkIbrokeIt/waychain`
>
> **PROVISIONAL — not yet law.** This monorepo is an UNPUSHED combine draft (branch `feat/one-tree-repo-law`, local-only). The satellites `waychain-consensus` / `waychain-site` / `waychain-mobile` are still the working canonical. Do NOT treat them as read-only mirrors yet — see the STATUS notice at the top of `REPO_LAW.md`. Work in the satellites until the combine is pushed AND a founder authority decision is recorded.

---

## Map

```
waychain/
├── REPO_LAW.md              ← BINDING law (one tree, three states, issue-first)
├── AGENTS.md                ← you are here
├── protocol-manifest.json   ← machine SoT (27 precompiles 0x0C–0x26)
├── consensus/               ← Go L1 (canonical protocol)
│   ├── evm/precompiles.go
│   ├── scripts/audit-consistency.sh
│   └── …
├── site/                    ← waychain.org (Vercel root = site/)
├── mobile/                  ← Expo wallet (Expo root = mobile/)
├── contracts/               ← LEGACY Solidity (do not deploy as protocol)
├── blueprint/               ← plan/spec (not live)
├── docs/ scripts/ assets/   ← supporting
└── …
```

## Canonical facts

| Fact | Value |
|---|---|
| Chain ID | 10008 (`0x2718`) |
| Precompiles | **27** @ **0x0C–0x26** |
| 0x21 | **WIFRGantletRewards** (not Keccak) |
| Selectors | `sha256(sig)[:4]` |
| EOA key / balance / tx.from | **64-hex** pubkey; 20-byte display only |
| Live node | AWS **3.89.116.45** `waychain.service` |
| Public RPC | `https://api.waychain.org` |
| Public site | `https://waychain.org` |

## Commands (from monorepo root)

```bash
# Protocol
cd consensus && go test ./...
cd consensus && bash scripts/audit-consistency.sh

# Site count SoT
cd site && bash scripts/check-precompile-count.sh

# Mobile mdrifts
cd mobile && npm test
```

## Workflow

1. Issue on `ThinkIbrokeIt/waychain`
2. Branch `fix/…` or `feat/…`
3. Edit only under this tree
4. PR + CI
5. If protocol change claims deploy → AWS binary sha on the issue
6. Live claim → client path proof

## Coded ≠ deployed ≠ live

Never collapse them. AWS sha proves deployed. User client proves live.

## Refuse these

- `git clone` a new waychain satellite for “cleanliness”
- Feature work in old standalone repos
- Treating monorepo `blueprint/` as live chain
- Deploying `contracts/` as WayChain mainnet protocol
- Hardcoding marketing tier numbers as on-chain truth without asking

**Doctrine:** truth first · one voice per layer · no silent drift · REPO_LAW supersedes chat memory.
