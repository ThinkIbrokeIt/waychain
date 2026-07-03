# WayChain Contracts — AGENTS.md

> **For AI agents inheriting this project. Read this first before writing code, running tests, or making architectural decisions.**

---

## 1. Purpose

This repository contains **Solidity smart contracts** for WayChain's protocol components. They were originally written for deployment on **PulseChain**. The contracts implement on-chain attestations, tokenomics, Bitcoin bridging, DEX mechanics, identity badges, inheritance, and perpetual storage funding.

**Important:** These Solidity contracts are now **largely superseded** by native Go-based precompile implementations in the [`waychain-consensus`](https://github.com/waychain/waychain-consensus) repository (under `evm/`). The Go precompiles are the canonical, production implementations of WayChain's protocol. This Solidity codebase is maintained primarily for:

- Cross-chain attestation compatibility
- Reference / audit trail
- Historical record

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

### Critical: Selector Differences

**WayChain uses SHA256 for ABI selectors, NOT keccak256.**

- These Solidity contracts use **keccak256** (standard EVM) for function selectors and event signatures.
- WayChain's native EVM uses **SHA256** for selector computation.
- **Consequence:** These contracts **will not work directly on WayChain**. Calls will hash to the wrong 4-byte selectors and fail.
- **Do not** attempt to deploy these `.sol` files on WayChain without adapting all ABI selectors to SHA256.

### These Are PulseChain Contracts

| Attribute | Value |
|-----------|-------|
| Target chain | PulseChain (EVM-compatible) |
| Selector hash | keccak256 |
| Current status | Superseded by Go precompiles |
| Production deployment | `waychain-consensus/evm/` (Go) |

### Deployment Guidance

- ✅ **Safe to deploy on:** PulseChain, Ethereum, Sepolia, Goerli, or any standard keccak256 EVM.
- ❌ **Do NOT deploy on:** WayChain mainnet/testnet without selector adaptation.
- ✅ **Safe to reference for:** Understanding the protocol design, auditing Go precompiles, writing cross-chain attestation contracts.
- ❌ **Do NOT treat as:** The canonical WayChain protocol implementation.

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