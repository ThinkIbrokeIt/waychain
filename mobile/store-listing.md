# WayChain Mobile — Google Play Store Listing

> Ready to paste into Google Play Console once the first APK/AAB ships.

## App name
WayChain Wallet

## Short description (80 chars)
Self-custody WayChain wallet — WAY, 1WAY, quests, oracle & validator tools.

## Full description (4000 chars max)
WayChain Wallet is the self-custody mobile wallet for WayChain — a Bitcoin-pegged, energy-themed Layer 1 built for real-world asset settlement and professional attestation.

Carry your keys, your WAY, and your on-chain identity in your pocket:

• NON-CUSTODIAL — Ed25519 keys generated on-device. You own your seed; we never see it.
• WAY & 1WAY — hold, send, and receive WAY. Mint 1WAY (Bitcoin-backed) by creating a vault and depositing BTC.
• QUESTS — earn WAY from the foundation airdrop pool by testing real WayChain flows (wallet backup, transfers, governance votes, Dox_Dev badges, oracle setup, validator uptime).
• DOX_DEV IDENTITY — soulbound badges gate deployment, oracle, and governance access. Earn Level 2 to unlock vaults and oracle participation.
• ORACLE & VALIDATOR TOOLS — bond as an oracle, track your 72-hour validator uptime, and climb the top-tier ladder for lifetime rewards.
• TRUSTLESS LOCKS — create time/release-locked positions.
• ENERGY TIDE JOURNAL — anchor permanent, encrypted truths on-chain.

WayChain Wallet is open source. Audit the code, build it yourself, or download the signed APK.

Illuminate. Navigate. Arrive.

## Category
Finance

## Tags
crypto, wallet, blockchain, bitcoin, defi, web3, self-custody

## Content rating
Everyone (finanace/crypto — regional restrictions may apply)

## Privacy policy URL
https://waychain.org/privacy   (see privacy-policy.md — host before submission)

## Screenshots needed (submit 2–8 phone screens)
1. Wallet home — balance + send/receive
2. Quests list — earn WAY
3. 1WAY Stablecoin vault — mint screen
4. Dox_Dev badge / identity
5. Oracle bond / validator uptime
6. TrustlessLock create

## Build commands
- Internal APK:  `npx eas build -p android --profile preview`
- Play AAB:      `npx eas build -p android --profile production`
- Package:       org.waychain.mobile
