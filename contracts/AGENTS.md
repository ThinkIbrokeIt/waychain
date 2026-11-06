# WayChain Contracts — AGENTS.md

> **⚠️ SUPERSEDED — see `DECISIONS-LEDGER.md` (repo root) for current truth.**
> This file contains stale claims. Specifically: the "do NOT deploy .sol on WayChain
> mainnet until the keccak selector bridge lands" guidance (§6) is **WRONG** — the
> 0x21 Keccak256 precompile is already live (`consensus/evm/keccak_precompile.go`,
> tests passing). The bridge landed; this doc was not updated. Treat `DECISIONS-LEDGER.md`
> as source of truth. File-specific code/structure notes below may still be useful.

> **For AI agents inheriting this project. Read this first before writing code, running tests, or making architectural decisions.**

---

## 1. Purpose

This repository contains **Solidity smart contracts** for WayChain's application layer. They were originally written targeting deployment on **PulseChain** and are being re-pointed at WayChain's app layer. The contracts implement on-chain attestations, tokenomics, Bitcoin bridging, DEX mechanics, identity badges, inheritance, and perpetual storage funding.

**Status (corrected 2026-07-17 per REPO_LAW.md Article X):** These Solidity contracts are the **application layer** of WayChain — **in-scope, NOT legacy/superseded.** The Go precompiles in `consensus/evm/` are the **core protocol**; Solidity contracts are the layer above it (Ethereum-equivalent: Geth core + Solidity dapps). Both ship.

- The application layer that sits above the Go core precompiles (Ethereum-equivalent: Geth core + Solidity dapps).
- Cross-chain attestation contracts compatible with other EVM chains.
- Reference / audit trail for what the Go precompiles implement.

> **Selector note:** WayChain's CORE precompiles dispatch on `sha256(sig)[:4]`; Solidity contracts in this repo use standard **keccak256** selectors. A bridge (keccak precompile / app-layer dispatch) reconciles the two — tracked, not "dead."
---

## 2. Project Structure

```
waychain-contracts/
├── src/                  # Solidity contract source files
│   ├── Attestation.sol
│   ├── BIJO.sol
│   ├── BitcoinRegistry.sol
│   ├── BitcoinSPV.sol
│   ├── DeadMansSwitch.sol
│   ├── DoxDevBadge.sol
│   ├── StorageEndowment.sol
│   ├── TemplateRegistry.sol
│   ├── TrustlessLock.sol
│   ├── WayChainFactory.sol
│   └── WayChainPair.sol
├── test/                 # Test files (Foundry / Hardhat)
├── script/               # Deployment scripts (Foundry)
├── lib/                  # Foundry git dependencies (forge dependencies)
├── foundry.toml          # Foundry configuration
├── hardhat.config.*      # Hardhat configuration
├── package.json          # Node dependencies (Hardhat)
└── README.md             # Original project README
```

**Tooling:**

| Tool       | Purpose                         |
|------------|---------------------------------|
| **Foundry** (forge) | Primary build & test framework |
| **Hardhat**        | Alternative test/deploy framework |
| **Node.js**        | Hardhat dependencies            |

---

## 3. Contracts Overview

All contract source files live in `src/`.

| File | Description | Notes |
|------|-------------|-------|
| `Attestation.sol` | On-chain attestation contract | Cross-chain attestation proofs |
| `BIJO.sol` | Binary Journal token (ERC-20) | Deployed on PulseChain testnet — see Key Context |
| `BitcoinRegistry.sol` | Bitcoin address → EVM address mapping | Bridges BTC identities |
| `BitcoinSPV.sol` | Bitcoin SPV (Simplified Payment Verification) | Verifies BTC transactions on-chain |
| `DeadMansSwitch.sol` | Inheritance / dead man's switch protocol | Time-locked asset recovery |
| `DoxDevBadge.sol` | Identity badge / reputation system | Developer doxxing verification |
| `StorageEndowment.sol` | Perpetual storage funding contract | Endowment model for ongoing storage costs |
| `TemplateRegistry.sol` | Contract template registry | Factory pattern for deploying standard contracts |
| `TrustlessLock.sol` | Trustless liquidity lock | Timelock / liquidity commitment |
| `WayChainFactory.sol` | DEX factory (Uniswap V2–style) | Creates WayChainPair instances |
| `WayChainPair.sol` | DEX pair (Uniswap V2–style) | AMM pair contract |

---

## 4. Key Context (Read Before Acting)

### Supersession Status

- **WayChain protocol functionality is now implemented natively in Go** as EVM precompiles in `waychain-consensus/evm/`.
- These Solidity contracts are the **original PulseChain-era implementations** and are **not** used in WayChain's current production EVM.
- The Go precompiles are the **source of truth** for how WayChain's protocol currently works.

### BIJO Deployment

- **BIJO** was deployed on **PulseChain testnet** at:
  ```
  0xfe17ae138d442DCa9Ee130240D32Dce46701df81
  ```
- **Ownership was renounced** — no further modifications to that deployed instance are possible.

### When These Contracts Are Still Relevant

- **Cross-chain attestation**: `Attestation.sol` may be useful for bridging attestations from other EVM chains to WayChain.
- **Reference**: The Solidity code provides a readable, commented reference for what the Go precompiles implement.
- **Audit trail**: Understanding the original design intent helps audit the Go precompile implementations.

---

## 5. Build Commands

```bash
# Compile all contracts with Foundry
forge build

# Run Foundry tests (verbose)
forge test -v

# Run a specific test file
forge test --match-path test/SomeTest.t.sol -v

# Deploy using Foundry script
forge script script/Deploy.s.sol

# Gas report
forge test --gas-report

# Hardhat commands (if hardhat.config exists)
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.js --network pulsetestnet
```

**Dependencies:**
- Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Install Node deps: `npm install`

---

## 6. ⚠️ Pitfalls & Warnings

### Selector Differences (bridge task, NOT a dead end)

WayChain's CORE precompiles dispatch on `sha256(sig)[:4]`; these Solidity contracts use standard **keccak256** selectors (Ethereum-equivalent app layer).

- This repo is the **application layer** of WayChain (see REPO_LAW.md Article X) — in-scope, not legacy.
- **Current gap:** a standard Solidity contract's keccak256 selector does not match the core precompile's sha256 dispatch. This is a tracked bridge task (keccak precompile + app-layer dispatch), **not** a reason to discard the contracts.
- **Do not** deploy these `.sol` files on WayChain mainnet *blindly* — but the keccak selector bridge (0x21 Keccak256 precompile) **has already landed** (`consensus/evm/keccak_precompile.go`, tests passing). A Solidity contract's keccak256 selectors are now derivable via 0x21. What remains UNTESTED is the end-to-end deploy+call of a `.sol` contract on the live node — that needs a real deploy+call test, not a missing primitive. See `DECISIONS-LEDGER.md`.

### Deployment Guidance

- ✅ **Safe to deploy on:** PulseChain, Ethereum, Sepolia, Goerli, or any standard keccak256 EVM.
- ✅ **WayChain mainnet:** keccak bridge (0x21) is LIVE. Deploy + keccak-selector call is now an *integration test*, not a blocked task. Test before relying on it. See `DECISIONS-LEDGER.md`.
- ✅ **Safe to reference for:** Understanding the protocol design, auditing Go precompiles, writing cross-chain attestation contracts.
- ✅ **This IS** the WayChain application layer (alongside the Go core). Both ship.
---

## 7. Related Repositories

| Repository | Description |
|------------|-------------|
| `waychain-consensus` | Go-based consensus client with native precompiles (CANONICAL) |
| `waychain-client` | EVM client / node software |
| `waychain-relay` | Cross-chain relay infrastructure |

---

## 8. Quick Checklist for AI Agents

When tasked with this repo:

1. [ ] **Identify your goal.** Are you deploying, auditing, testing, or referencing?
2. [ ] **Check the purpose.** If deploying — which chain? If WayChain, stop and redirect to Go precompiles.
3. [ ] **Use forge, not hardhat** (unless hardhat-specific testing is needed).
4. [ ] **Remember the selector issue** — keccak256 ≠ SHA256.
5. [ ] **Look in `waychain-consensus/evm/`** for the real production implementations.
6. [ ] **BIJO**: deployed at `0xfe17ae138d442DCa9Ee130240D32Dce46701df81` on PulseChain testnet — ownership renounced.