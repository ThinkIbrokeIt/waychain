# Vendored front-end libraries — WayChain community host
# Served from OUR host (no jsdelivr/unpkg/CDN). Refresh with update-vendored.sh.

| File | Purpose | Source pkg | Global |
|---|---|---|---|
| tweetnacl.min.js | ed25519 signing | tweetnacl (latest) | `nacl` |
| scure-bip39.esm.js | BIP39 mnemonic | @scure/bip39 (latest) | ESM import |
| scure-bip39-english.esm.js | English wordlist | @scure/bip39 (latest) | ESM import |
| jsQR.js | QR scan | jsqr (latest) | `jsQR` |
| qrcode.min.js | QR gen (toCanvas) | qrcode (latest) | `QRCode` |
| ethers.min.js | Ethereum lib (WIFR bridge) | ethers@6.12.1 | `ethers` |
| solana-web3.iife.js | Solana lib (WIFR bridge) | @solana/web3.js@1.91.0 | `solanaWeb3` |
| soljson-0.8.26.js | Solidity compiler wasm | solc@0.8.26 | loaded by solcSetup |

**Fonts:** still served from Google Fonts (fonts.googleapis.com) as a documented
stopgap. Self-hosted woff2 is the end-state (see DECENTRALIZATION-DOCTRINE.md
Article XI). Fontsource tarballs don't bundle woff2; the update script will
pull from the fontsource GitHub release when we cut fonts over.

**Rule (founder 2026-07-24):** vendored libs track STABLE, never a dead/hardcoded
pin. The site previously referenced bip39@3.0.12 and jsQR@1.4.0 paths that NEVER
EXISTED on the CDN — silent failure. Always verify a vendored file is real JS,
not an error page.
