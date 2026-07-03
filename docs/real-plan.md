# WayChain REAL Plan

**Honesty policy:** No item is "done" until a real user can submit a real transaction through the real interface and see the real result. No fake hashes. No empty blocks. No taped-together demos called production.

**Goal:** A working L1 where you connect via browser → waychain.org → submit a signed transaction → see it mined in a real block → verify it on a block explorer.

---

## The Real State

The chain produces 28,652 empty blocks. `eth_sendRawTransaction` returns `time.Now().UnixNano()` as a "tx hash" and never puts anything in the pool. Every single component that looks finished is built on top of blocks that contain nothing.

**The entire chain needs one thing to become real: a working transaction pipeline.** Everything else — explorer, badge UI, WebSocket — is polish on top of empty data. We do them in order: real pipeline first, then interfaces on real data, then hardening.

---

## PHASE 1 — Transaction Pipeline (makes the chain real)

Everything below is blocked until this works. A user must be able to:
1. Craft a transaction
2. Sign it (Ed25519, WayChain's native crypto)
3. Submit via `eth_sendRawTransaction`
4. See it in `chain.Pool`
5. See it mined in the next block
6. Look it up via `eth_getTransactionByHash`
7. Confirm receipt via `eth_getTransactionReceipt`

### 1.1 — Fix eth_sendRawTransaction
**File:** `rpc.go` — replace the fake hash with real processing.

Current (line 243-265):
```go
case "eth_sendRawTransaction":
    // ... validates deployer level ...
    txHash := fmt.Sprintf("0x%x", time.Now().UnixNano())  // ← FAKE
    return txHash, nil
```

**What it must do:**
- Accept params as `["0xhex_encoded_tx"]` (standard eth_sendRawTransaction format — one param, the signed raw tx)
- Deserialize the hex into a `Transaction` struct (we define the binary format — WayChain uses Ed25519, not secp256k1 RLP)
- Validate: signature, nonce, sender balance, deploy gate (if `To == ""`)
- `chain.Pool.Add(tx)` — actually add it
- Return `0x` + hex of `tx.Hash` — the REAL hash, not time

**Verification:** `eth_sendRawTransaction` → pool has 1 tx → next block has 1 tx → `eth_getBlockByNumber` shows it.

**Binary format for the raw tx (6 fields, gob-encoded, hex-wrapped):**
```
[nonce:8][from_len:1][from:var][to_len:1][to:var][value:var][gasLimit:8][gasPrice:8][data_len:4][data:var][sig_len:1][sig:var]
```
Simple, fixed-width where possible, easy to encode/decode without external deps.

### 1.2 — Add eth_getTransactionByHash
**File:** `rpc.go`

Scans blocks for a matching tx hash. Returns the transaction fields as JSON.

### 1.3 — Add eth_getTransactionReceipt
**File:** `rpc.go`

Returns `{transactionHash, blockHash, blockNumber, from, to, status (0x1=success), gasUsed, logs}`.

### 1.4 — Store Full Tx Data in Blocks + BoltDB
**Files:** `chain.go`, `store/store.go`

Current `BlockData` stores only metadata (height, proposer, tx count). Full tx data must be serialized alongside the block.

- `store.go`: Add `SaveTransaction(height, tx)` and `LoadTransactions(height)` methods
- `chain.go`: On `ProduceBlock`, persist txs to store. On `OpenStore`, restore full blocks including tx data.
- `Sync()` call includes tx persistence

### 1.5 — Wire P2P Propagation
**File:** `p2p_daemon.go` — already has `OnTx` callback that adds to pool and `BroadcastTransaction` function.

- When a tx enters the pool via RPC, broadcast to peers
- When a block is produced, broadcast full block to peers (not just `block:#N:hash:xxxx` placeholder)
- Peers receiving blocks apply them to local state

**Verification:** 2 nodes running → submit tx to node A → tx appears in node B's pool → both nodes mine the tx.

---

## PHASE 2 — waychain.org Live

### 2.1 — Fix Cloudflare SSL
**Problem:** waychain.org times out on HTTPS. Port 80 is blocked at provider edge. Cloudflare proxy should handle TLS termination.

Options (in priority order):
1. **Cloudflare Tunnel** (cloudflared) — no open ports needed, CF connects to daemon via outbound tunnel. Best long-term.
2. **Cloudflare Proxy DNS** — orange-cloud the A record, CF terminates TLS, passes HTTP to origin on port 80. Provider blocks 80 at edge — won't work.
3. **Vercel frontend** — host dashboard HTML on Vercel, point waychain.org DNS there, dashboard talks to RPC via API endpoint.

**Recommendation:** Cloudflare Tunnel. One daemon process, outbound-only, no port forwarding needed, automatic TLS.

### 2.2 — Verify End-to-End
```
Browser → https://waychain.org → dashboard.js → /rpc → waychain daemon :9545 → chain
```

Submit a tx from the dashboard. See it in a block. Get the receipt.

---

## PHASE 3 — Interfaces on Real Data

### 3.1 — Block Explorer
**File:** `waychain-explorer.html` served at `/explorer`

Only after Phase 1 produces real blocks with real txs.

- Latest blocks table (height, hash, proposer, tx count, timestamp)
- Click a block → block detail (parent hash, state root, full tx list)
- Click a tx → tx detail (from, to, value, gas, calldata, status, receipt)
- Account lookup (balance, nonce, Dox_Dev level)
- Search bar (by address, tx hash, block height)
- Live updates via WebSocket (once Phase 4 enables WS)

### 3.2 — Badge UI
**File:** `waychain-badge.html` served at `/badge`

- Check address badge level (read-only — calls `way_getDoxLevel`)
- Info: what each level means, how to get verified
- Curator section: issue a badge (requires signing a tx — needs MetaMask or manual JSON export for now)
- Application placeholder: instructions for contacting curators

### 3.3 — Dashboard Upgrade
**File:** update `waychain-dashboard.html`

- Replace polling with WS push (post-WebSocket)
- Real wallet balance display
- Network health panel (validator count, block latency, pool size)
- "Submit a TX" sandbox for testing (sign via JS Ed25519 lib)

---

## PHASE 4 — WebSocket RPC

### 4.1 — Add WS Support to RPCServer
**Files:** `rpc.go` (new file or additions), `go.mod` (add `nhooyr.io/websocket`)

- WS upgrade handler on `/rpc` (same path, differentiate via Upgrade header)
- `eth_subscribe`: newHeads, newPendingTransactions
- Subscription manager: sub_id → channel; cleanup on disconnect
- NGINX: add WS proxy headers

### 4.2 — Wire Dashboard to WS
- Dashboard connects via WebSocket on page load
- Subscribes to `newHeads` — pushes block updates in real-time
- No more polling

---

## PHASE 5 — Multi-Validator & Hardening

### 5.1 — Real Multi-Node Devnet
- Run 3 nodes: validator-1, validator-2, validator-3
- Each with own BoltDB, own P2P listener, own RPC port
- Full consensus rounds with real round timeouts
- Validator-set tracked on-chain

### 5.2 — Rate Limiting
- Per-IP request budget (50 req/s default)
- Configurable in env var

### 5.3 — Structured Logging
- Replace `fmt.Printf` with `slog` (Go 1.21+ stdlib)
- Log levels: debug, info, warn, error
- JSON output for machine parsing

---

## Dependency Chain

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
 (pipeline)   (public)    (UI)       (real-time)  (hardening)
     │            │           │            │           │
     ▼            ▼           ▼            ▼           ▼
  Real txs     Public URL   Explore,     Push        Validator
  mined in     accessible   badge,       updates     mesh
  blocks                    dashboard
```

**Nothing in Phases 2-5 works without Phase 1.** Block explorer with empty blocks is a demo. Badge UI without real txs is a form. WebSocket without real data is a heartbeat.

---

## Effort Estimate

| Step | Files | Est. Time | Makes Real? |
|------|-------|-----------|-------------|
| 1.1 Fix eth_sendRawTransaction | rpc.go, chain.go | 1h | ✅ YES — first real tx |
| 1.2 Add tx query APIs | rpc.go | 30min | ✨ Users can verify |
| 1.3 Store tx data in blocks | chain.go, store.go | 1h | 🔄 Persist across restart |
| 1.4 Wire P2P propagation | p2p_daemon.go | 30min | 🌐 Multi-node |
| 2.1 Cloudflare Tunnel | infra | 30min | 🌍 Public access |
| 3.1 Block explorer | HTML/CSS/JS | 2h | 👁️ Visible proof |
| 3.2 Badge UI | HTML/CSS/JS | 1h | 🛡️ Trust UX |
| 3.3 Dashboard upgrade | HTML/CSS/JS | 1h | 📊 Real data |
| 4.1 WebSocket | rpc.go, go.mod, nginx | 1.5h | ⚡ Real-time |
| 5.1 Multi-validator | node.go, consensus.go | 2h | 🏗️ Actual network |
| 5.2 Rate limiting | rpc.go | 30min | 🛡️ Production safety |

**Total to REAL first tx: ~2-3 hours.** Everything after Phase 1.1 is wrapping.

---

## How We Verify "Done"

| Item | Pass/Fail Test |
|------|---------------|
| Real tx pipeline | `curl -X POST .../rpc -d '{"method":"eth_sendRawTransaction",...}'` → tx in next block → `eth_getTransactionReceipt` returns status 0x1 |
| Persistent tx | Restart daemon → `eth_getTransactionByHash` still returns the tx |
| Public access | Browser at https://waychain.org shows live block count > 0 |
| Block explorer | Explorer page at /explorer shows recent blocks with non-zero tx counts |
| Badge check | /badge page shows correct Dox_Dev level for any address |
| WebSocket | `wscat -c wss://waychain.org/rpc` subscribes to newHeads, receives pushes |
| Multi-validator | 3 nodes, each producing blocks, state converges |