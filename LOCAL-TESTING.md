# Local Testing Setup — WayChain

AWS account is closed. The chain now runs **locally** and the site talks to it
through a Cloudflare tunnel. This doc is the canonical setup for verifying the
site + wallet + faucet against the live local node.

## Prerequisites
- Local WayChain node running on `localhost:9545` (chain ID `10008`).
- `cloudflared` installed (`/usr/local/bin/cloudflared`).
- `vercel` CLI installed (for site deploys).
- `python3` (for serving the site locally).

## 1. Start the local node
The node must be producing blocks on `localhost:9545` before anything else.
Verify:
```bash
curl -s -X POST http://localhost:9545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# → {"result":"0x2718"}
```

## 2. Start the Cloudflare tunnel (local node ←→ api.waychain.org)
Config: `~/.cloudflared/config.yml` maps `api.waychain.org` → `http://localhost:9545`.
```bash
cloudflared tunnel run waychain-rpc
```
Verify the public RPC now hits your local node:
```bash
curl -s -X POST https://api.waychain.org -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# → {"result":"0x2718"}  (was Cloudflare error 1033 while AWS was down)
```
> Note: `cloudflared` may log a `ping_group_range` warning — that only disables
> ICMP ping and is harmless for HTTP.

## 3. Serve the site locally (real browser test)
Vercel anonymous/temporary deploys get bot-blocked (403). Serve the site from
the monorepo symlink and browser-test against the tunnel.
```bash
cd waychain-site        # = monorepo site/ symlink
python3 -m http.server 8090 --bind 127.0.0.1
```
Open `http://127.0.0.1:8090/` in a browser. All pages point at
`api.waychain.org`, which the tunnel routes to your local node.

### What to verify
| Flow | Method | Expected |
|---|---|---|
| Faucet | `way_fundGenesis([addr, "0xa"])` | returns `0xa`, balance increases |
| Wallet balance | `eth_getBalance([addr, "latest"])` | returns funded balance |
| Wallet balance (alt) | `way_getBalance([addr])` | returns funded balance |
| Wallet create | page "Create New Wallet" | derives 20-byte addr, shows phrase |

> The wallet page loads BIP39 from `@scure/bip39@1.2.2/+esm` (the old
> `bip39@3.0.12/dist/index.browser.min.js` UMD was removed in v3 and 404s).
> See waychain-site PR #12.

## 4. Deploy to Vercel (when authenticated)
Anonymous deploys are blocked by Vercl's bot wall. Log in first:
```bash
vercel login
cd waychain-site && vercel --prod
```
Then browser-test the real `waychain.org` URL the same way.

## Troubleshooting
- **`api.waychain.org` returns 1033** → tunnel not running or node down. Check step 1–2.
- **Faucet "✓ Sent!" but balance 0x0** → you checked before the async fund landed
  (race). Re-query `eth_getBalance` a moment later.
- **Wallet "Create" does nothing** → `window.bip39` undefined → BIP39 CDN failed
  to load (see PR #12).
- **Vercel 403 on anonymous deploy** → expected; use authenticated `vercel login`.
