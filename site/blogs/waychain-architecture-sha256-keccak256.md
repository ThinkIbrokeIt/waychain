# WayChain Architecture: SHA256 + Keccak256

## Why WayChain Chose SHA256

Most blockchains use Keccak256 for function selectors and hashing. WayChain chose SHA256 for three reasons:

1. **Bitcoin Compatibility** - SHA256 is the cryptographic primitive of Bitcoin, the most secure blockchain
2. **Tooling Maturity** - Every developer knows SHA256, every cloud provider supports it
3. **Auditable Consensus** - SHA256 is simpler, faster, and more auditable than Keccak256

## The 0x21 Precompile Bridge

While SHA256 is native, we recognize developers need EVM compatibility. Precompile `0x21` provides Keccak256 for app-layer choice.

```javascript
// Native WayChain: SHA256 selectors
const hash = sha256(data);

// EVM compatibility via 0x21 precompile
const keccak = waychain.call('0x21', 'keccak256', data);
```

## Economic Loop

```
BITCOIN (digital gold)
    ↓ mint (Treasury)
1WAY (stablecoin, $1 = 1 BTC)
    ↓ burn
BITCOIN

REAL GOLD CLAIM
    ↓ extinguish
1WAY (payment)

COMMUNITY WORK
    ↓ earn
WAY (community-backed token)
    ↓ swap via DEX
1WAY (stable value)
```

## Call to Action

**Oracles** (Level 2 geologists): Verify data → Earn WAY → Swap to 1WAY

**Validators** (Level 2+): Run node → Earn WAY → Swap to 1WAY via DEX

**Curators** (Level 3, 90-day terms): Govern protocol → Earn WAY

**Influencers** (Communicators): Build community → Earn WAY → Swap via DEX

**Developers** (Level 2): Build apps → Earn WAY → Swap to any stable coin

[Get badge at /badge](https://waychain.org/badge) | [Docs](https://waychain.org/docs)