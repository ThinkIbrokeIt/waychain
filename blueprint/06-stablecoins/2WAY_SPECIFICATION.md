# 2WAY — WayChain Multi-Stablecoin Protocol

**Version:** 2.0
**Status:** Design Specification — Phase 6 Implementation
**Chain:** WayChain (Chain ID 10008)
**Precompile Address:** 0x18 (2WAY Vault)

---

## 1. Overview

2WAY is WayChain's stablecoin protocol. But 2WAY is not just one stablecoin — it's a **synthetic USD** backed by a basket of real stablecoins from other chains.

### The Problem with Single-Collateral Stablecoins

Existing stablecoins force users to choose:
- **USDC/USDT:** Stable, liquid, but custodial (you trust Circle/Tether)
- **DAI/LUSD:** Trustless, but locked to ETH/ETH-only collateral
- **FRAX/crvUSD:** Complex mechanisms, governance-dependent

WayChain users come from Bitcoin, Ethereum, Solana, Polygon, and other ecosystems. They already hold stablecoins on those chains. They don't want to sell their ETH for DAI, then deposit DAI to mint yet another token.

### The 2WAY Solution

2WAY accepts **real stablecoins from each network** as collateral:

| Network | Stablecoin | Type | Why Accept It |
|---------|-----------|------|---------------|
| Bitcoin | 1WAY (BTC-backed) | Over-collateralized | Bitcoin is the largest crypto asset |
| Ethereum | LUSD | Over-collateralized, trustless | Most trustless stablecoin — pure ETH backing, no admin keys |
| Ethereum | DAI/USDS | Over-collateralized, battle-tested | Largest decentralized stablecoin, $5B+ TVL |
| Ethereum | crvUSD | Over-collateralized, LLAMMA liquidations | Innovative, robust oracle system |
| Ethereum | GHO | Over-collateralized, Aave-governed | Native to largest lending protocol |
| Solana | USDS (Sky) | Over-collateralized | Native Solana deployment of DAI fork |
| Polygon | crvUSD | Over-collateralized | Native Polygon deployment |
| Arbitrum/Optimism/Base | LUSD | Over-collateralized | Native L2 deployments |
| Any chain | USDC/USDT | Custodial (wrapped) | Most liquid, most widely used — accepted with higher collateral ratio |

### How It Works

```
User on Ethereum holds LUSD
  → Bridges LUSD to WayChain (via cross-chain attestation)
  → Deposits LUSD into 2WAY Vault
  → Mints 2WAY at 150% collateral ratio
  → Uses 2WAY on WayChain (transacting, providing liquidity, etc.)
  → To redeem: burn 2WAY → withdraw LUSD → bridge back to Ethereum
```

The key insight: **2WAY is backed by real, yield-bearing, trustless stablecoins** — not volatile crypto. This gives it fundamentally different stability properties than existing CDP stablecoins.

---

## 2. Stability Architecture

### 2.1 Three-Layer Stability Defense

**Layer 1: Primary Redemption (Hard Floor)**
2WAY can always be redeemed for $1 of underlying stablecoin collateral. If 2WAY trades at $0.98, arbitrageurs buy 2WAY and redeem it for $1 of LUSD, pushing the price back to $1. This creates a **hard floor** at $1.

**Layer 2: Stability Pool (Soft Absorption)**
A pool of 2WAY/USDC liquidity absorbs small depegs. If 2WAY drops to $0.99, the pool arbitrages it back to $1. The Stability Pool is funded by:
- Protocol revenue (stability fees + liquidation penalties)
- External LPs earning yield

**Layer 3: Collateral Ratio Adjustment (Monetary Policy)**
If demand for 2WAY increases, the protocol can lower the minimum C-Ratio (e.g., from 150% to 140%) to expand supply. If demand decreases, raise the C-Ratio to contract supply.

### 2.2 Why This Is More Stable Than Single-Collateral CDPs

| Property | Traditional CDP (DAI, LUSD) | 2WAY |
|----------|---------------------------|------|
| Collateral type | Single volatile asset (ETH) | Basket of stablecoins |
| Collateral volatility | High (ETH ±30% swings) | Low (stablecoins ±1-2%) |
| Liquidation cascade risk | High (ETH crash → mass liquidations) | Low (stablecoins don't crash together) |
| Oracle dependency | ETH/USD price | Stablecoin/USD price (simpler) |
| Depeg recovery | Depends on collateral recovery | Depends on any ONE stablecoin maintaining peg |

The critical advantage: **stablecoins are less volatile than ETH.** When ETH drops 30%, DAI and LUSD maintain their peg. 2WAY's collateral doesn't evaporate during market downturns.

### 2.3 Collateral Risk Matrix

| Collateral | Custodial Risk | Depeg Risk | Liquidity | On-Chain Verifiability | C-Ratio |
|-----------|---------------|------------|-----------|------------------------|---------|
| LUSD | None | Low | Medium | Full | 130% |
| DAI/USDS | None | Low | High | Full | 130% |
| crvUSD | None | Low | Medium | Full | 130% |
| GHO | None (Aave governance) | Low | Medium | Full | 130% |
| USDC | Circle | Low | Very High | Attested only | 150% |
| USDT | Tether | Medium | Very High | Attested only | 175% |
| 1WAY (BTC) | None | Low | Low | Full | 150% |

**Custodial stablecoins (USDC/USDT) require higher collateral ratios** because you must trust the issuer. **Trustless stablecoins (LUSD/DAI/crvUSD/GHO) require lower ratios** because the backing is verifiable on-chain.

---

## 3. Vault Architecture

### 3.1 Vault State

```go
type Vault struct {
    Owner           string            // Vault owner address
    Collaterals     map[string]uint256 // stablecoin → amount
    Debt            uint256            // 2WAY minted (in wei)
    UpdatedBlock    uint64            // Last interaction block
    CollateralRatio uint16            // Current ratio (basis points, e.g., 15000 = 150%)
}
```

### 3.2 Core Operations

**Deposit:**
```
deposit(vaultId, stablecoin, amount):
    → Transfer stablecoin from user to vault
    → Update vault.Collaterals[stablecoin] += amount
    → Recalculate collateral ratio
    → Emit Deposited event
```

**Mint:**
```
mint(vaultId, amount):
    → Require vault.CollateralRatio >= MinC-Ratio after minting
    → Mint 2WAY tokens to user
    → vault.Debt += amount
    → Emit Minted event
```

**Withdraw:**
```
withdraw(vaultId, stablecoin, amount):
    → vault.Collaterals[stablecoin] -= amount
    → Require vault.CollateralRatio >= MinC-Ratio after withdrawal
    → Transfer stablecoin back to user
    → Emit Withdrawn event
```

**Burn:**
```
burn(vaultId, amount):
    → Burn 2WAY tokens from user
    → vault.Debt -= amount
    → Emit Burned event
```

### 3.3 Liquidation Flow

```
liquidate(vaultId):
    → Require vault.CollateralRatio < LiquidationRatio
    → Stability Pool absorbs debt first (if sufficient 2WAY available)
    → If Stability Pool insufficient → Auction begins
    → Liquidators bid 2WAY to buy discounted collateral
    → Liquidation penalty (10%) goes to protocol treasury
    → Emit Liquidated event
```

---

## 4. Price Oracle Integration

### 4.1 Stablecoin Price Feeds

2WAY needs to know the USD price of each accepted stablecoin. Since these are stablecoins, the answer should be $1. But during depegs, the price diverges.

**Oracle Sources (via existing 7 oracle precompiles):**

| Feed | Source | Trust Model |
|------|--------|-------------|
| LUSD/USD | Chainlink LUSD/USD | Decentralized |
| DAI/USD | Chainlink DAI/USD | Decentralized |
| USDC/USD | Chainlink USDC/USD | Decentralized |
| USDT/USD | Chainlink USDT/USD | Decentralized |
| crvUSD/USD | Curve internal oracle | Curve governance |
| GHO/USD | Aave oracle | Aave governance |

**Safety mechanism:** If any stablecoin deviates more than 2% from $1, the protocol:
1. Pauses new minting for that collateral type
2. Allows existing vaults to add collateral or repay
3. Prevents liquidations from being unfairly triggered

### 4.2 Collateral Value Calculation

```go
func (v *Vault) TotalCollateralValueUSD() uint256 {
    total := uint256(0)
    for stablecoin, amount := range v.Collaterals {
        price := oracle.GetPrice(stablecoin)  // 8 decimals
        value := (amount * price) / 1e8
        total += value
    }
    return total
}

func (v *Vault) CollateralRatio() uint16 {
    if v.Debt == 0 {
        return type(uint16).max  // No debt = infinite ratio
    }
    collateralUSD := v.TotalCollateralValueUSD()
    return (collateralUSD * 10000) / v.Debt  // basis points
}
```

---

## 5. Stability Pool

### 5.1 Design

The Stability Pool holds 2WAY and USDC in a balanced ratio. It absorbs debt from liquidated vaults before they enter auction.

```
Liquidation occurs:
  1. Stability Pool checks: do we have enough 2WAY to cover this vault's debt?
  2. If YES: Pool absorbs debt, receives collateral at 10% discount
  3. If NO: Vault enters auction, liquidators bid 2WAY for collateral
```

### 5.2 Stability Pool Rewards

LPs who deposit into the Stability Pool earn:
- **Stability fees** from vaults (proportional to their share)
- **Liquidation penalties** (10% of liquidated vault value)
- **2WAY governance rewards** (future)

---

## 6. Cross-Chain Stablecoin Bridge

### 6.1 How Stablecoins Arrive on WayChain

Each accepted stablecoin exists natively on its home chain. To use it on WayChain:

**Option A: Cross-Chain Attestation (Trustless)**
For trustless stablecoins (LUSD, DAI, crvUSD, GHO):
1. User locks stablecoin on source chain (e.g., Ethereum)
2. WayChain oracles attest to the lock event
3. Equivalent amount is minted on WayChain as a "wrapped" version
4. To redeem: burn wrapped version → oracles attest → unlock on source chain

**Option B: Native Bridge (for chains with official bridges)**
For USDC (Circle CCTP), USDT:
1. User burns USDC on source chain via CCTP
2. USDC is minted natively on WayChain
3. No wrapped token — it's the real thing

### 6.2 Wrapped Token Naming Convention

| Source Chain | Original | On WayChain |
|-------------|----------|-------------|
| Ethereum | LUSD | wLUSD (or just LUSD if bridged natively) |
| Ethereum | DAI | wDAI |
| Ethereum | crvUSD | wcrvUSD |
| Ethereum | GHO | wGHO |
| Solana | USDS | wUSDS |
| Any | USDC | USDC (native via CCTP) |
| Any | USDT | USDT (native) |

---

## 7. Revenue Model

### 7.1 Revenue Sources

| Source | Rate | Allocation |
|--------|------|------------|
| Stability Fee | 1.5-3% APR | 80% Treasury, 20% Stability Pool LPs |
| Liquidation Penalty | 10% of liquidated value | 70% Stability Pool, 30% Treasury |
| Redemption Fee | 0.5% | 100% Treasury |
| Flash Mint Fee | 0.05% | 100% Treasury |

### 7.2 Revenue Projections (with stablecoin collateral)

With stablecoin collateral, 2WAY can achieve much higher TVL than volatile-asset CDPs because:
- Users don't fear collateral crashes
- Institutional users can hold stablecoin-backed positions
- Yield from underlying stablecoins (crvUSD LP rewards, GHO staking) can offset stability fees

| TVL | 2WAY Supply | Annual Revenue |
|-----|-------------|---------------|
| $50M | $33M | ~$1.5M |
| $500M | $333M | ~$15M |
| $5B | $3.3B | ~$150M |

---

## 8. Implementation Checklist

### Phase 6A: Core Vault
- [ ] Precompile 0x18: Vault struct, deposit/mint/withdraw/burn
- [ ] Collateral type registry (add/remove accepted stablecoins)
- [ ] Collateral ratio enforcement
- [ ] Oracle price integration (via existing 0x0C-0x10)

### Phase 6B: Liquidation + Stability Pool
- [ ] Liquidation trigger (check C-Ratio < threshold)
- [ ] Stability Pool contract (deposit/withdraw/liquidate)
- [ ] Auction mechanism (fallback when pool insufficient)
- [ ] Liquidation penalty distribution

### Phase 6C: Cross-Chain Integration
- [ ] Cross-chain attestation for LUSD/DAI/crvUSD/GHO
- [ ] CCTP integration for USDC
- [ ] Wrapped token contracts (wLUSD, wDAI, wcrvUSD, wGHO)
- [ ] Redemption flow (burn → unlock → source chain)

### Phase 6D: Governance + Parameters
- [ ] Governance-controlled parameter updates (C-Ratios, fees, debt caps)
- [ ] Emergency pause functionality
- [ ] Treasury management (fee distribution)

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Major stablecoin depeg (e.g., USDC) | Low | High | Pause minting, higher C-Ratio for custodial assets |
| Oracle manipulation | Low | Critical | 7-oracle median, 2% deviation cap |
| Smart contract bug | Low | Critical | 2 audits + formal verification |
| Governance attack | Low | High | Timelock + Dox_Dev-weighted voting |
| Cross-chain bridge exploit | Low | High | Rate limits, daily caps, gradual rollout |
| Stablecoin reserve audit failure | Medium | Medium | Prefer trustless collateral (LUSD/DAI) |

---

## 10. Why This Matters

**For users:** 2WAY lets you use your existing stablecoins on WayChain without selling them. If you hold LUSD on Ethereum, you can bridge it to WayChain and mint 2WAY to transact — while still earning LUSD's ETH backing security.

**For WayChain:** 2WAY brings liquidity from every ecosystem. USDC from Ethereum, USDS from Solana, crvUSD from Arbitrum — all flow into WayChain. This is how WayChain becomes the settlement layer for cross-chain stablecoin activity.

**For stability:** Unlike volatile-collateral CDPs, 2WAY's backing assets are already stable. The protocol doesn't need to liquidate during market crashes because the collateral doesn't crash. This is fundamentally more stable than any single-collateral CDP.
