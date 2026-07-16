# Cross-Chain Token Spec for WayChain

## Goal
Enable WAY/1WAY to flow to any EVM chain without supply inflation.

## Core Principle
**No new tokens minted on other chains.** Tokens are representations of locked WayChain tokens, verified via CrossChainAttestation.

## Architecture

### Token Flow (Lock & Represent)
```
WayChain
└─ Lock WAY in Treasury Contract
   └─ CrossChainAttestation event emitted (0x1F)
      └─ Target Chain mints representation token 1:1

Target Chain  
└─ Burn representation token
   └─ CrossChainAttestation proof submitted
      └─ WayChain Treasury releases locked WAY
```

### Supply Invariant
- WayChain: 100M WAY (fixed)
- Sum of locked WAY + free WAY = 100M
- Each chain's representation token ≤ locked WAY
- No inflation possible

## Implementation

### Phase 1: Treasury Contract (WayChain)
```solidity
// Precompile 0x13 already exists for identity
// Add: Treasury.lockForRepresentation(bytes32 chainId, uint256 amount)
event LockedForRepresentation(
    address indexed user,
    bytes32 indexed targetChain,
    uint256 amount,
    bytes32 attestationId
);
```

### Phase 2: Representation Token (Any EVM Chain)
```solidity
contract WayChainRepresentationToken {
    mapping(bytes32 => bool) public attestedLocks;
    
    function mint(address to, uint256 amount, bytes calldata proof) external {
        // Verify WayChain attestation via CrossChainAttestation (0x1F)
        // proof = signed attestation from 3+ WayChain validators
        require(attestedLocks[keccak256(abi.encodePacked(to, amount, proof))], "Not attested");
        _mint(to, amount);
    }
}
```

### Phase 3: Bridge Contract (WayChain)
```solidity
// Bridge.unlockForRelease(address to, bytes32 targetChain, uint256 amount)
// Called when representation token burned on target chain
event ReadyForRelease(
    address indexed user,
    bytes32 indexed targetChain,
    uint256 amount,
    bytes32 releaseId
);
```

## CrossChainAttestation Usage

### Current (0x1F)
- Verifies external chain state
- Used for cross-chain deployer blacklists

### Extended for Tokens
```
Attestation Request:
way_submitAttestation(
    chainId: "0x2718" (WayChain),
    contract: "Treasury",
    method: "lockForRepresentation", 
    params: {user, targetChain, amount},
    signature: validatorSignatures[3+]
)

Verification:
way_verifyAttestation(attestationId) → returns (bool valid, bytes data)
```

## Supported Representations

| Chain | Token | Contract Address | Notes |
|-------|-------|------------------|-------|
| WayChain (native) | WAY | - | 100M supply |
| Ethereum | XWAY | TBD | Uses 0x21 keccak256 |
| PulseChain | PWAY | TBD | Existing ecosystem |
| Arbitrum | AWAY | TBD | Base/Ethereum alignment |

## Key Guarantees

1. **Supply fixed at 100M** - No token can exceed locked amount
2. **Trustless verification** - 3-of-5 curator multisig attests locks
3. **Redeemable anytime** - Burn representation → get WAY back
4. **No slippage** - 1:1 backing, not algorithmic

## Integration Points

- **0x1F CrossChainAttestation** - Verify locks across chains
- **0x1D Governance** - Parameter changes, chain additions
- **0x13 Dox_Dev** - Only verified humans can bridge large amounts
- **0x1A TrustlessLock** - Optional time-locks for large bridges

## Launch Sequence

1. Deploy Treasury contract with lock function
2. Deploy representation tokens on target chains
3. Register bridge endpoints in governance
4. Enable minting via attested locks
5. Add to wallet UI (waychain.org/wallet)

## Risk Mitigation

- **Validator collusion**: 3-of-5 multisig across 5 jurisdictions
- **Chain halt**: Locked tokens accessible via community vote
- **Smart contract bugs**: Pausable, upgradeable via governance
- **No KYC**: Dox_Dev Level 2 minimum for bridging (non-custodial)

## See Also
- `/whitepaper#9-precompile-architecture` - Precompile specs
- `/whitepaper#13-cross-chain-attestations` - Cross-chain flow  
- `/whitepaper#5-1way` - Stablecoin model for reference