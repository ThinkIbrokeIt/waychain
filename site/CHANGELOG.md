# Changelog

## v3.1.1 — 2026-06-26
- Fixed BIJO description: clarified as ecosystem reward token, not fuel token
- Fixed BIJO supply: 369B → 369M (matches on-chain `BijoSupply` in precompiles.go)
- Updated state rent pricing to match 2026 cloud storage benchmarks (S3: $0.023/GB/mo)
- Updated whitepaper HTML (was broken in v3.1.1, restored from v3.1.0 + fixes applied)
- Fixed version footer: v0.1.0 → v3.1.1
- Version header bumped: v3.0 → v3.1.1 throughout

## v3.1.0 — 2026-06-26
- Whitepaper regeneration + 3 new features live (Progressive Staking, Oracle VRF, Mineral Rights)

## v3.0.5 — 2026-06-26
- Sync vercel config for staging previews

## v3.0.4 — 2026-06-25
- Security section added, whitepaper section numbering fixed

## v3.0.2 — 2026-06-24
- Add CHANGELOG, version endpoint live

## v3.0.1 — 2026-06-24
- Added git versioning (was deploying blind via `vercel deploy`)
- Added `version.json` endpoint at https://waychain.org/version.json
- Added `deploy.sh` script for version-bumped deploys
- Added CHANGELOG.md
- Fixed chain ID references: 369 → 10008 (0x2718)

## v3.0.0 — 2026-06-24
- Rewrote whitepaper from 455 lines to 1,469 lines
- Added 12 missing sections: UX Wall, Privacy, Account Model, Oracle Consensus, Cross-Chain, Governance detail, Binary Journal, State Rent, Mineral Rights
- Added honest Status section: 15 live features, 9 spec'd features
- Fixed misleading claims: 1WAY/2WAY marked "Spec'd — Building Phase 6"
- Split precompile section: 5 live vs 8 reserved
- Chain ID changed from 369 (PulseChain) to 10008 (free, digits sum to 9)

## v2.0.0 — 2026-06-23
- All 5 phases complete: tx pipeline, waychain.org, interfaces, WebSocket, hardening
- Dashboard, Explorer, Badge UI deployed
- Cloudflare tunnel for api.waychain.org
- Multi-validator consensus (3 nodes)

## v1.0.0 — 2026-06-20
- Initial design: 19 spec documents, 11,947 lines
- Consensus, EVM, Dox_Dev, Oracle, Tokenomics, Governance specs complete
- Binary Journal integration spec complete
