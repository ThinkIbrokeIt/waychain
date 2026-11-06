# Mobile Wallet Chore List

## 1. Home page cleanup — reduce tabs + actionable alerts

**Current tabs (6):** Wallet | DEX | Stake | Bridge | Governance | WIFR

**Goal:** Slim to essential. Move secondary into sub-menus / WalletScreen grid. **Actionable items (votes, quest verifications, pending tasks) must surface on Wallet home — not require searching.**

**Core principle:** if there's something a user needs to act on (new governance vote, quest verification request, pending task), it appears as a card/banner/alert on the Wallet home screen automatically. The user never has to dig through tabs to find what needs their attention.

**Proposal — 3 tabs max:**

| Tab | What it shows | Rationale |
|---|---|---|
| **Wallet** | Balance, Send/Receive, Faucet, quick-grid to all screens, **actionable alerts** (pending votes, quest verifications, task claims) | The hub — all actions surface here |
| **Bridge** | BTC vault + 1WAY bridge | Critical path for onboarding |
| **Quest** | Quests, Dox_Dev level, rewards | User engagement loop |

DEX → accessible via WalletScreen button or grid icon
Stake → accessible via WalletScreen button or grid icon
Governance → accessible via WalletScreen button or **alert card when vote active**
WIFR → sub-page or quest tab section

## 2. SwapRoute / DEX — pending settlement integration

SwapRouteScreen exists and is wired to the DEX tab, but settlement (actual on-chain swap execution) is NOT integrated. The screen shows the interface but doesn't call the SwapRoute precompile (0x25) to execute trades. Settlement integration requires:

- [ ] Wire SwapRoute 0x25 `swap()` selector to the DEX submit flow
- [ ] Add liquidity pool data reads (TVL, APR, pool balances) via precompile reads
- [ ] Add swap confirmation UI (rate, slippage, gas estimate)
- [ ] Wire the signed tx to `eth_sendRawTransaction`

## 3. Full manual testing walkthrough — all quest paths

### Prerequisites
- Mobile wallet installed on phone
- Active wallet with some WAY (use faucet first)
- Node running at api.waychain.org

### Test Paths

#### Path A: Onboarding
1. Open app → landing screen shows
2. Create wallet (12-word mnemonic)
3. Verify mnemonic backup prompt
4. Import existing wallet (paste phrase)
5. Import via QR scan
6. Set PIN → save PIN works
7. Lock app → unlock with PIN

#### Path B: Faucet → gas
1. Navigate to Wallet screen
2. Tap "Faucet Drip (gas WAY)"
3. Verify success message
4. Check balance increased (refresh)
5. Attempt second drip within cooldown → rate-limited (silent 0)

#### Path C: Balances & Tokens
1. Wallet shows WAY balance correctly
2. Tap Tokens → see BIJO, 1WAY, SWAY balances
3. Stablecoin screen reads 1WAY price info
4. Bridge screen shows vault lock status
5. ScanPay opens camera correctly

#### Path D: Send/Receive
1. Tap Receive → see address QR
2. Tap Send → enter address + amount → sign → submit
3. Check History shows the tx
4. Address Book: save address → reuse

#### Path E: Quests & Dox_Dev
1. Open Quest tab
2. See list of available quests
3. Check Dox_Dev level display
4. (If Level 0) Apply for verification

#### Path F: DEX / SwapRoute
1. Open DEX tab
2. See token pair selectors
3. Enter swap amount
4. [Pending settlement] — interface shows but swap not executed

#### Path G: Stake
1. Open Stake screen
2. See 2WAY vault info
3. See WAY operator staking display

#### Path H: Settings
1. Open Settings
2. Switch network RPC endpoint
3. About screen shows version
4. Wallet management (export/remove)

#### Path I: Explorer connectivity
1. Open explorer.waychain.org on companion device
2. Verify blocks loading
3. Verify transaction search works
4. Verify address lookup works

## Priority order

1. **Home page tabs cleanup** — reduces confusion, immediate UX win
2. **Faucet fix verification** — ensure zero-balance users can onboard
3. **Manual testing walkthrough** — validate every path before quest launch
4. **DEX settlement integration** — non-blocking, pending design