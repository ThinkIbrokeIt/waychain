# Genesis Launch Checklist — WayChain

Status as of 2026-07-24. Truth-first: each item is marked DONE only if verified against the live node or merged master.

## Node (LIVE — verified 2026-07-24)

- [x] **Binary deployed to AWS `3.89.116.45`** — master binary built `CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -a`, shipped via cat|ssh, swapped at `/usr/local/bin/waychain`, `systemctl restart waychain.service` → active (running).
- [x] **Genesis seed fired (SeedAllGenesis, idempotent)** — verified live balances:
  - Founder `e5da0c28804c512ac7e0f4a53ad8d6fd13f81e76` = 1,000,000 WAY
  - Treasury `0x03` = 10,000,000 WAY
  - Faucet reserve `0x27` = 1,000,000 WAY
- [x] **GasFaucet precompile live (0x27)** — `drip()` selector `0x2a7ab5da`. Reserve seeded. Note: `way_getFaucetBalance` is NOT a top-level RPC method — it is a precompile selector (`getFaucetBalance` = `0x1ac9c1d0`); mobile/web call it via ABI, confirmed by on-chain reserve balance.
- [x] **WIFR→quest Dox_Dev flow** — full end-to-end test passing (burn WIFR → CrossChainAttestation 0x1F witness → autopilot taskAutoVerify → 50 WAY from treasury). Test in `consensus/evm/wifr_quest_flow_test.go`.

## Mobile (APK — building on AWS instance)

- [x] **QR wallet import (#149)** — merged to master (`WalletScreen.js` "📷 QR Import" → ScanPay import mode).
- [x] **QR chain-selection (#152)** — merged to master (`scanMode` BTC/WayChain on ScanPayScreen).
- [x] **Faucet Drip button** — branch `feat/wallet-faucet-button` (PR pending; GitHub PR API transient error). Calls GasFaucet 0x27 `drip()` from active wallet.
- [ ] **APK built + on founder S23** — building on AWS instance `i-0fcbaf5fa38596405` (3.220.174.56) from `feat/wallet-faucet-button`, versionCode 6. Install: `adb install -r app-release.apk`.

## Repo hygiene

- [x] **CI auto-deploy pulled (#154)** — node/site deploy jobs removed from `ci.yml` (runner can't reach AWS/Vercel). Deploys run from local box.
- [x] **Open issues reconciled** — #145 (downstream audit) closed; #150 (founder seed) superseded by #155; #149/#152 kept until APK installed; #97 (EconoOracle bot) kept for testing.
- [x] **AWS Agent Toolkit set up** — CLI v2.36.7, `aws login` (acct 654363240810), 16 skills, rules file `AWS-AGENT-RULES.md` (#158 merged).

## Outstanding (not blockers)

- [ ] **Build instance teardown** — AWS `i-0fcbaf5fa38596405` left running for APK builds; stop when idle to avoid cost (`aws ec2 terminate-instances --instance-ids i-0fcbaf5fa38596405`).
- [ ] **Multiple RPC endpoints** — only `api.waychain.org` live; founder preferred a second endpoint. Cloudflare can front another node.
- [ ] **Node-build skill** — `waychain-ops` §2b/§2a already documents the cargo subdir + `go build -a` + `LD_LIBRARY_PATH` recipe correctly. No change needed.

## Deploy recipe (for next time)

```
cd consensus/revm-ffi && cargo build --release
cd consensus && CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -a -o /tmp/waychain-master .
# open SG :22 for 172.59.90.138/32, then:
cat /tmp/waychain-master | ssh -i ~/Downloads/WayChain.pem ubuntu@3.89.116.45 'cat > /tmp/waychain-new && chmod +x /tmp/waychain-new'
ssh -i ~/Downloads/WayChain.pem ubuntu@3.89.116.45 'sudo cp /usr/local/bin/waychain /home/ubuntu/waychain-backup-$(date +%s) && sudo mv /tmp/waychain-new /usr/local/bin/waychain && sudo systemctl restart waychain.service'
# verify: curl way_getBalance founder == 0xde0b6b3a7734240; then revoke SG rule
```
