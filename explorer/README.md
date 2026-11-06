# WayChain Explorer — Indexer + API (EXPL-8)

The explorer's data spine: a single Go service that **indexes** WayChain history
from the node and **servates** a REST + WebSocket API. The explorer frontend
talks only to this API — never directly to the node.

```
WayChain node (source of truth)
      │  eth_getBlockByNumber(fullTx) + WS newHeads
      ▼
  explorer  ──►  SQLite (indexed)  ──►  REST/WS API  ──►  Explorer (thin client)
```

## Why this shape
- The node stays a node. Stats/aggregation that the old prototype faked become
  **SQL queries** here — no throwaway node RPCs.
- Pure-Go SQLite (`modernc.org/sqlite`, no CGO) → single-file, self-hostable,
  Blockscout-style.
- Address resolution (64-hex key ↔ 20-byte display) is solved **here**, once,
  at index time: every tx stores both the node key and its display form.

## Build
```bash
cd explorer
go build -o waychain-explorer .
```

## Run
```bash
# defaults: node=http://localhost:9545, db=explorer.db, api=:8080
./waychain-explorer

# against the live node
WAYCHAIN_NODE_URL=https://api.waychain.org \
WAYCHAIN_DB=explorer.db \
WAYCHAIN_API_ADDR=:8080 \
./waychain-explorer
```
On start it replays genesis→head, then tails new blocks over WS. The API is
served concurrently.

## API
| Endpoint | Purpose |
|---|---|
| `GET /api/blocks?limit=&offset=` | recent blocks (desc) |
| `GET /api/block/:n` | block + its transactions |
| `GET /api/tx/:hash` | transaction + its logs |
| `GET /api/address/:addr` | balance (node) + tx history + count (accepts 64-hex or 20-byte) |
| `GET /api/search?q=` | universal search (block # / tx hash / address) |
| `GET /api/stats` | network overview (blocks, txs, addresses, pending) |
| `GET /api/logs?address=&topic0=&fromBlock=&toBlock=&limit=` | indexed EVM logs |
| `WS  /api/ws` | live stream (welcome handshake; newHeads/pendingTx/largeTx wired from tail) |

All responses are JSON; CORS is open for local dev.

## Data notes
- `gasUsed` and `logs` come from `eth_getTransactionReceipt`. They are real only
  on nodes with EXPL-2 (PR #25) deployed; pre-PR nodes return a hardcoded
  `0x5208` and empty logs.
- The node keys accounts by the 64-hex ed25519 pubkey; the wallet displays
  `pub[0:40]`. The indexer stores both, so `/api/address/:addr` resolves either.

## Self-host (docker)
See `docker-compose.yml`. Brings up the indexer+API; point the rebuilt explorer
frontend (Phase 2) at `http://explorer-api:8080`.

## Status
Phase 1 spine (EXPL-8). Phase 2 (rebuild the explorer frontend on this API) and
Phase 3/4 (dev tools, intelligence) build on top. Tracked under issue #24.
