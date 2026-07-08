# WayChain — Monorepo AGENTS.md

> **One chain. One repo. One source of truth.**
> Read this before making any cross-component changes.

---

## Project Structure

```
waychain/
├── AGENTS.md              ← You are here. Read first.
├── consensus/             ← Go L1 daemon (chain, EVM, precompiles, P2P, RPC)
│   ├── chain.go           ← Block production, tx pool, staking
│   ├── rpc.go             ← JSON-RPC server (HTTP + WS)
│   ├── serialize.go       ← Binary tx format
│   ├── evm/               ← EVM interpreter, 20 precompiles (0x0C-0x20)
│   ├── store/             ← BoltDB persistence (accounts, blocks, tx_index)
│   └── AGENTS.md          ← Detailed consensus agent briefing
├── site/                  ← Frontend (Vercel-hosted at waychain.org)
│   ├── index.html         ← Dashboard (homepage) — lighthouse hero image
│   ├── assets/            ← Brand images, favicon, badge NFTs
│   ├── wallet/            ← Web wallet (Ed25519 keygen, faucet, send)
│   ├── badge/             ← Dox_Dev badge system (lookup, apply, curator)
│   ├── binary-journal/    ← Truth anchoring + Dead Man's Switch
│   ├── locks/             ← TrustlessLock UI (time/vesting locks)
│   ├── dex/               ← Swap Route DEX interface
│   ├── declaration/       ← July 4th Digital Independence declaration
│   ├── whitepaper/        ← Whitepaper (index.md + index.html, 13 sections)
│   ├── explorer/          ← Block explorer
│   ├── docs/              ← Getting started + run-a-node guides
│   ├── plan/              ← Launch plan page
│   ├── vercel.json        ← Vercel deployment config
│   └── AGENTS.md          ← Detailed site agent briefing
├── contracts/             ← Solidity contracts (PulseChain-era, superseded)
│   └── AGENTS.md          ← Detailed contracts agent briefing
├── blueprint/             ← Full spec documents (29+ files)
├── assets/                ← Logos, brand assets
├── scripts/               ← Tx submission scripts, tunnel test
└── version.json           ← Root-level version tracker
```

---

## Quick Reference

| What | Where |
|------|-------|
| Start the daemon | `cd consensus && ./waychain start` |
| Build consensus | `cd consensus && go build .` |
| Run consensus tests | `cd consensus && go test ./...` |
| Deploy site | `cd site && ./deploy.sh patch "message"` |
| Check live version | `https://waychain.org/version.json` |
| Check RPC health | `curl https://api.waychain.org -X POST -d '{"method":"eth_chainId"}'` |
| Whitepaper source | `site/whitepaper/index.md` |
| 1WAY stablecoin spec | `blueprint/06-stablecoins/1WAY_STABLECOIN_SPEC.md` |
| Mineral rights spec | `blueprint/07-special-topics/NEW_CHAIN_MINERAL_RIGHTS_TOKENIZATION.md` |
| Original vision | `blueprint/01-vision/NEW_CHAIN_VISION.md` |

---

## Architecture Summary

**WayChain** is a Layer 1 blockchain written in Go with:
- **Custom BFT consensus** — 1s block time, instant finality, 200-validator cap
- **EVM interpreter** — Full bytecode execution with WayChain-native opcodes (0xF0-0xFF)
- **20 precompiles** (0x0C-0x20) — Oracle, Identity, Stablecoins, Mineral Rights, Governance, Privacy
- **BoltDB state** — Persistent accounts, blocks, tx index
- **P2P networking** — libp2p-based gossip mesh
- **SHA256-based selectors** — NOT keccak256 (critical difference from standard EVM)

**Key innovations (what makes WayChain different):**
1. **Professional Oracle Badges** — Geologists, lawyers, surveyors, engineers earn WAY
2. **Native Oracle Consensus** — Attesters = validators, not third-party
3. **Mineral Rights Tokenization** — MRT precompile (0x20)
4. **1WAY Bitcoin-backed stablecoin** — BTC in 3-of-5 Dox_Dev multi-sig
5. **Binary Journal / 3·6·9** — Self-sovereign knowledge vault
6. **Dox_Dev Identity** — One human = one vote. Deploy gate at 3 layers.

---

## Architecture Recommendation: SHA-256 / Keccak-256 Split — Implemented

**Core consensus uses SHA-256** (block hashing, Merkle trees, P2P wire, tx hashes) — Go stdlib `crypto/sha256` for max throughput.

**Smart contracts use Keccak-256 via precompile 0x21** — added at address `0x0000000000000000000000000000000000000021`. Call with arbitrary bytes, returns 32-byte Ethereum-compatible keccak256 hash. Gas: 30 + 6 per 32-byte word.

This is the correct split: consensus stays fast with SHA-256, contracts get EVM tooling compatibility without touching any existing state.

---

## Live Infrastructure

| Component | URL / Access | Status |
|-----------|-------------|--------|
| WayChain daemon | `localhost:9545` (VPS) | ✅ Running (height ~794k+) |
| RPC (public) | `https://api.waychain.org` | ✅ Via Cloudflare tunnel (systemd) |
| Frontend | `https://waychain.org` | ✅ Vercel v4.1.21 |
| Tunnel | `cloudflared tunnel run waychain-rpc` | ✅ systemd, auto-restart |
| Nginx | `localhost/rpc` → daemon | ✅ RPC proxy only |
| GitHub (monorepo) | `ThinkIbrokeIt/waychain` | ✅ |
| GitHub (frontend) | `ThinkIbrokeIt/waychain-site` | ✅ Single source of truth |
| **Frontend repo** | **`waychain/site/` is a symlink → `waychain-site/`** | **⛔ Never edit waychain/site/ directly** |

---

## Critical Pitfalls for Agents

1. **Spec'd ≠ Built ≠ Live** — Always verify on-chain before claiming a feature works.
2. **SHA256 vs Keccak256** — Core consensus uses SHA256 (blocks, Merkle, P2P). Smart contracts use Keccak256 via precompile 0x21 (added July 2026). See "Architecture Recommendation" above.
3. **Chain ID 10008** (0x2718), not 369 (PulseChain).
4. **BIJO supply: 369M**, not 369B.
5. **Precompiles are Go, not Solidity** — Contracts in `contracts/` are PulseChain-era and superseded.
6. **Deploy gate** — Cannot deploy contracts without Dox_Dev Level 2+. Affects testing.
7. **Vercel deploys from GitHub** — Local changes must be committed before deploy.
8. **DNS for api.waychain.org** must be DNS-only (gray cloud), never proxied.

---

## Version Tracking

Root-level `version.json` tracks the monorepo version. The site subdirectory has its own `version.json` for the Vercel-deployed frontend. These should stay in sync.

Current version: v4.0.0 (whitepaper rebuilt with innovations as centerpiece)