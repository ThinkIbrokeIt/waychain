# Dox_Dev — WayChain's Soulbound Identity Badge System

**Live on Chain ID 10008** — Visit `waychain.org/badge` to start verification.

## The Three Levels

### Level I: The Lantern
- **Purpose**: Basic proof of existence as a unique human — a new beginning
- **Verification**: Video or ZK-based; supports full anonymity
- **Privileges**: Entry-level participation as verified human
- **Slogan**: "The light begins. A verified human. A new beginning."

### Level II: The Compass  
- **Requirements**: 100 WAY bond + 2 curator endorsements
- **Purpose**: Demonstrates integrity and active contribution
- **Privileges**: DeFi participation, validator operations, oracle work, smart contract deployment
- **Slogan**: "Integrity Is Your Compass. Truth. Serve. Learn. Build."

### Level III: The Lighthouse
- **Requirements**: 5,000 WAY bond, 90-day elected term as Curator
- **Purpose**: Stewardship and governance responsibilities
- **Privileges**: Issue/revoke badges, curate professionals, full accountability, guide others
- **Slogan**: "Tend the light. Guide others. Leave a legacy."

## How It Integrates

**3-Layer Deploy Gate**: Enforces identity at RPC, block, and opcode levels. Level II+ required for contract deployment (precompile 0x13).

**Professional Oracles**: Level III curators verify experts (geologists, lawyers, etc.) for on-chain attestations (Mineral Rights Tokenization at 0x20).

**Privacy & Accountability**: 
- Identity encrypted, stored securely
- Disclosure only via court-ordered escrow with community vote
- Badge revocation + cross-chain blacklisting for bad actors

**RPC Example**: `way_getDoxLevel` queries any address's verification level.

## The Vision

Dox_Dev replaces plutocratic governance (stake-weighted) with human-verified reputation. It solves:
- Sybil attacks (one human, one vote)
- Rug pulls (verified deployers only)
- Anonymous bad behavior (permanent accountability)

Badges are **non-transferable**, **non-replicable**, and **tied to verified humans**. Cross-chain attestation enables resume verification across chains without exposing home addresses.

**Resume portability**: Validate any address across projects. Lost credentials? Permanent address migration available.

This badge system integrates with all 27 precompiles (0x0C–0x26), including Trustless Lock, Binary Journal, 1WAY stablecoin, TaskRegistry, SWAY, SwapRoute, and TemplateRegistry.
