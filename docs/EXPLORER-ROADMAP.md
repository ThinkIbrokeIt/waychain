# WayChain Explorer — Roadmap (Build it right the first time)

> **Status:** Planning. Per `REPO_LAW.md`, every code change is tracked by a GitHub issue + PR.
> **Source of truth:** `site/explorer/index.html` (prototype frontend), `consensus/rpc.go` (node RPC surface), `protocol-manifest.json` (27 precompiles).
> **Doctrine:** truth first · no silent drift · coded ≠ deployed ≠ live · **build substance before show, once, correctly**.
> **Context:** zero users today. No demand pressure. The goal is the *correct architecture*, not a faster demo. Avoid throwaway patches that get ripped out later.

---

## 0. Philosophy

The current `site/explorer/index.html` is a **prototype**, not the product. It queries the live node directly with 20 sequential `eth_getBlockByNumber` calls every 5s and fakes several stats. That approach does not scale and cannot show the data a real explorer needs (tx history, logs, token flows).

The correct design is the standard one used by every serious explorer (Etherscan, Blockscout, Otterscan):

```
WayChain node (source of truth)
      │  eth_getBlockByNumber(fullTx) + WS newHeads
      ▼
  Indexer  ──►  indexed store (SQL)  ──►  REST/WS API  ──►  Explorer (thin client)
```

- The **node** stays a node. It should not serve aggregated stats or search.
- The **indexer** replays from genesis + tails live, building a queryable store.
- The **API** is the only thing the explorer talks to.
- The **explorer** is a clean client over the API — replaceable, cacheable, fast.

Everything we'd be tempted to "patch into the node" (validator count, account count, total txs) instead becomes a **SQL query in the indexer**. That's the right-first-time call: one spine, no throwaway node RPCs.

---

## 1. Current-state audit (verified against `consensus/rpc.go`, 865 lines)

### What the node actually serves today
| Method | Real? | Notes |
|---|---|---|
| `eth_blockNumber` | ✅ | `len(chain.Blocks)` |
| `eth_getBlockByNumber` | ✅ | supports `fullTx=true` → full tx objects (feed for indexer) |
| `eth_getBalance` / `eth_getTransactionCount` | ✅ | keys by raw string passed |
| `eth_getTransactionByHash` | ✅ | pool → in-mem blocks → persistent store |
| `eth_getTransactionReceipt` | ⚠️ | **`gasUsed` hardcoded `0x5208`**, `logs: []` always |
| `eth_getLogs` | ❌ | **stub → always returns `[]`** |
| `eth_gasPrice` | ⚠️ | hardcoded `0x9502f900` (2.5 gwei) |
| `_subscribe` (WS) | ✅ | newHeads etc. — tail feed for indexer |
| `way_getDoxLevel` / `way_getBalance` | ✅ | 64-hex key (live-proven) |
| `way_govProposals` / `way_twoWayStats` / `way_bridgeStats` | ✅ | precompile reads |
| `way_quest*` / `way_wayTotalSupply` / `way_questCap` | ✅ | TaskRegistry reads |
| **stats RPCs (validators/accounts/totalTx/pending)** | ❌ | none exist |

### What the prototype explorer claims vs. reality
| Claim | Reality |
|---|---|
| Block Height | ✅ real |
| Total Txs | ❌ fake — sum of last 20 blocks, mislabeled |
| Pending Txs | ❌ hardcoded `0` |
| Accounts | ❌ hardcoded `0` |
| Validators | ❌ hardcoded `200` |
| Address view | ⚠️ balance/nonce/Dox_Dev only — no tx history, no tokens |
| Tx fee | ❌ not computed; gasPrice unit mislabeled |

### Latent bug
Web wallet shows **20-byte display addresses**; explorer queries with the raw input. Node keys accounts by **64-hex** (live-proven 2026-07-14) → 20-byte search returns `0x0`/error. Resolution belongs in the API layer (display→key reverse lookup), not scattered through node RPCs.

---

## 2. Foundational constraints (the facts that shape the design)

1. **The indexer can replay everything from genesis** via `eth_getBlockByNumber(fullTx=true)` and tail via WS `eth_subscribe`. Address history, tx lists, token transfers (from `to`/`value`) are all derivable from block replay — **no node changes needed for those.**
2. **Event logs and real gasUsed CANNOT come from the node today.** `eth_getLogs` is a stub and `buildReceipt` hardcodes `gasUsed`/`logs`. The indexer ingests receipts, so this is a **node-correctness** dependency (EXPL-2), not an "unblocker." It must be fixed *before* the indexer can store correct logs/fees — but it is correctness work, not a demo patch.
3. **Address resolution (20-byte→64-hex)** is an API-layer concern. The API exposes display addresses; internals use the 64-hex key. Fix once, in the API.
4. **The node's 100 req/s rate limit** makes direct-explorer-to-node infeasible at scale. The indexer/API removes the explorer from the node entirely.

**Conclusion:** the spine is EXPL-2 (node correctness for logs/fees) feeding EXPL-8 (indexer + API). The prototype explorer is replaced, not patched.

---

## 3. Phased plan (build-it-right order)

### Phase 0 — Node correctness (foundation, not a patch)
**EXPL-2.** Fix what the indexer will ingest:
- Implement real `eth_getLogs` (filter by address/topic/range) against the store, OR have the indexer read execution logs directly once emitted.
- `buildReceipt` reports actual `gasUsed` + `logs` from EVM execution.
- (Address resolution helper may be added here or in API — decide in implementation.)
No stats RPCs. No explorer changes. This is correctness the whole system depends on.

### Phase 1 — Indexer + API (the spine)
**EXPL-8.** The real foundation.
- Indexer: replays genesis→head via `eth_getBlockByNumber(fullTx=true)`, tails via WS; persists to SQLite/Postgres: `blocks`, `transactions`, `address_tx` (from/to index), `logs` (post-Phase-0), `token_transfers`, `internal_txns` where available.
- All "stats" the prototype faked become **SQL aggregates here**: validator count (from validator set snapshot), account count, cumulative tx count, pending (from node pool or mempool table). **No node RPCs added** — this is why we do it in the indexer.
- Documented **REST + WS API**: `/blocks`, `/block/:n`, `/tx/:hash`, `/address/:addr` (balance + tx history + tokens), `/tokens`, `/stats`, WS streams (newHeads, pendingTx, largeTx).
- Self-host: `docker compose` (indexer + API + static explorer) + README.

### Phase 2 — Rebuild the explorer as a clean API client
Replace `site/explorer/index.html`. Built only against the Phase 1 API. This single phase *absorbs* what were EXPL-1 (truth), EXPL-4 (address resolution), EXPL-5 (fee), and the faked stats — because the API already serves correct data:
- Stats bar → `/stats` (real).
- Universal search → API router (block # / tx hash / address / token).
- Block / tx / address views → API, with real fees + tx history + token balances.
- Address resolution (20-byte→64-hex) handled by API.
The prototype's hardcoded values are gone because the client has nowhere to hardcode — it renders API responses.

### Phase 3 — Dev tools (API-backed)
**EXPL-6.** Contract Read/Write for verified precompiles (0x0C–0x26) + deployed contracts via `eth_call` through the API (authenticated node path for precompiles). Event/log viewer (from indexed `logs`). Token pages: 1WAY (0x22), SWAY (0x24), BIJO (0x14) — supply/holders/transfers. Internal tx view.

### Phase 4 — Intelligence & UX (API-backed)
**EXPL-7.** Address labels (seed treasury `0x03`, validators, DEX `0x25`, bridge `0x16`). CSV export. Watchlists/alerts via WS. Multi-address portfolio + chart. (AI/plain-English tx explainer optional, later.)

---

## 4. Issue map (all under `ThinkIbrokeIt/waychain`)
| Issue | Phase | Role |
|---|---|---|
| EXPL-2 · Node: real `eth_getLogs` + receipt logs/gasUsed | 0 | ✅ foundational correctness — blocks Phase 1 logs/fees |
| EXPL-8 · Indexer + REST/WS API + self-host | 1 | ✅ the spine — everything builds on it |
| EXPL-1 · Phase 2 epic (rebuild explorer as API client) | 2 | absorbs old truth/address/fee work |
| EXPL-6 · Phase 3 epic (dev tools) | 3 | feature |
| EXPL-7 · Phase 4 epic (intelligence/UX) | 4 | feature |
| ~~EXPL-3 · Node stats RPCs~~ | — | **SUPERSEDED** by EXPL-8 (stats are SQL aggregates in the indexer, not node RPCs). Leave open; close as won't-do once EXPL-8 committed. |
| ~~EXPL-4 · Explorer address resolution~~ | — | **ABSORBED** into Phase 2 / API layer. |
| ~~EXPL-5 · Explorer real fee~~ | — | **ABSORBED** into Phase 0 (node) + Phase 2 (API client). |

---

## 5. Sequencing (no rushing — zero users)
1. **EXPL-2** (node correctness) — do it properly; the indexer ingests its output.
2. **EXPL-8** (indexer + API) — the long pole; build it to last. Explorer, dev tools, intelligence all hang off this.
3. **EXPL-1** (rebuild explorer on the API) — replaces the prototype; this is when the "substance" becomes visible.
4. **EXPL-6**, then **EXPL-7** — features on a stable API.
5. Close EXPL-3/4/5 as superseded/absorbed.

**No phase is "done" until the live client proves it** (founder directive: a `not connected / ---` is a real outage, not UI/UX). But we do not ship partially-correct nodes or demo patches to "unblock" — we build the spine, then hang features on it.

---

## 6. What we are explicitly NOT doing
- Not adding 4 stats RPCs to `consensus/rpc.go` (that's throwaway — EXPL-3 superseded).
- Not patching the prototype's hardcoded stats to call node RPCs (wrong layer).
- Not optimizing the 5s poll loop — the prototype is being replaced, not tuned.
- Not shipping "real fees" by faking a fiat price — Phase 0 fixes the source; Phase 2 shows `—` until a price oracle read exists.
