# WIFR Certification Gauntlet — Deployment Checklist

## BEFORE ZERO ✅

- [x] WIFR token launched on pump.fun (user confirmed)
- [x] Bridge page deployed to waychain.org/wifr/bridge.html
- [x] Contracts compiled successfully
- [x] Solana burn contract code ready (`wifr-solana/`)
- [x] 48-hour timer scheduled

## BLOCKED (needs manual action)

### WayChain Deployment
```bash
cd ~/projects/waychain-contracts
# Set WAYCHAIN_DEPLOYER_KEY env var
forge script script/DeployWIFRGantlet.s.sol \
  --rpc-url https://api.waychain.org \
  --broadcast \
  --private-key $WAYCHAIN_DEPLOYER_KEY
```
Then fund pools:
- Pool 1: 1,000,000 WAY
- Pool 2: 100,000 WAY (Early Worm)
- Pool 3: 100,000 WAY (Grandmaster)

### Solana Deployment
```bash
npm i -g @coral-xyz/anchor-cli
cd ~/projects/wifr-solana
anchor keys list
anchor build
anchor deploy --provider.network mainnet
```

### Android Build
```bash
npm i -g eas-cli
cd ~/projects/waychain-mobile
eas build --platform android --profile development
adb install ./build-*.apk
```

## AT ZERO (July 11, 22:39)

- [ ] Cron auto-triggers reveal notification
- [ ] Publish pool contract address (from deployment output)
- [ ] Update bridge page with actual WIFR mint address
- [ ] Announce on socials: "WIFR Gauntlet is live"

**Timer Job ID: f63eabe774d5**