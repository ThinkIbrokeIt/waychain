# WayChain

**Actually Decentralized.** A Layer-1 blockchain whose protocol is expressed
through **27 on-chain precompiles** (addresses `0x0C`–`0x26`) rather than
arbitrary smart contracts — the protocol logic is the chain.

> **Single source of truth.** This monorepo (`ThinkIbrokeIt/waychain`) is the
> only writable working tree. Former standalone repos
> (`waychain-consensus`, `waychain-site`, `waychain-mobile`) are **archived
> read-only mirrors**. See [`REPO_LAW.md`](REPO_LAW.md) (binding) and
> [`AGENTS.md`](AGENTS.md) before editing.

---

## At a glance

| | |
|---|---|
| **Chain ID** | `10008` (`0x2718`) |
| **Precompiles** | 27 @ `0x0C`–`0x26` |
| **Selectors** | `sha256(signature)[:4]` (not Keccak) |
| **Native token** | **WAY** (gas + rewards) |
| **Stablecoin** | **1WAY** — Bitcoin-backed, supply flexes with BTC locked in vaults |
| **Accounts** | EOA key = full **64-hex** ed25519 pubkey; 20-byte form is display-only |
| **Public RPC** | `https://api.waychain.org` |
| **Site** | `https://waychain.org` |
| **Live node** | AWS `3.89.116.45` (`waychain.service`) |

---

## Repository layout

```
waychain/
├── consensus/      Go L1 protocol (canonical) — module: github.com/ThinkIbrokeIt/waychain-consensus
│   ├── evm/        EVM + 27 precompiles (precompiles.go is the protocol)
│   ├── rpc.go      JSON-RPC + way_* node reads
│   └── scripts/    audit-consistency.sh
├── site/           waychain.org (Vercel root)
├── explorer/       Explorer API (Go) + site/explorer (frontend)
├── mobile/         Expo wallet
├── contracts/      LEGACY Solidity (reference only — not the protocol)
├── blueprint/      Design / spec (not live)
├── docs/ scripts/ assets/
├── protocol-manifest.json   Machine SoT — 27 precompile inventory
├── REPO_LAW.md     BINDING law (one tree, issue-first, three states)
├── AGENTS.md       Agent map (points to REPO_LAW)
├── OPS-LEDGER.md   Deployed-state ledger (AWS sha, funds, gaps)
└── QUEST-LAUNCH-PLAN.md  Quest launch sequence
```

---

## The protocol is precompiles

WayChain's protocol logic lives in `consensus/evm/precompiles.go` as 27
precompiles. Examples:

| Addr | Precompile | What it does |
|---|---|---|
| `0x0C` | OracleAggregator | Off-chain data aggregation |
| `0x13` | DoxDevBadge | Identity / Dox_Dev verification |
| `0x16` | BitcoinRegistry | BTC bridge (committed/withdrawn) |
| `0x18` | TwoWayVault | CDP vault (2WAY) |
| `0x1F` | CrossChainAttestation | WIFR → WayChain bridge witness |
| `0x22` | **1WAY Stablecoin** | BTC-backed, mint/burn; supply flexes with BTC locked |
| `0x23` | TaskRegistry | Quest program (WAY rewards) |
| `0x25` | BinaryJournal | Storage/data incentive token (BIJO) |
| `0x26` | TemplateRegistry | On-chain templates |

The full inventory + live node reads are in
[`protocol-manifest.json`](protocol-manifest.json). **The count is 27.**
Claims of 20/21/22 without reconciling the manifest are invalid.

---

## Explorer

A read-only explorer served at `https://waychain.org/explorer/`.

**Backend API** (`explorer/api`, Go — talks only to the node, never directly):

```
/api/blocks            latest blocks
/api/block/<n>        block by height
/api/tx/<hash>        transaction
/api/address/<addr>   account (balance + txs)
/api/search           block / address / tx search
/api/stats            blocks / txs / addresses / pending
/api/logs             EVM event logs (filter by address/topic0)
/api/precompiles      all 27 precompiles
/api/precompile/<addr>      precompile detail + live way_* state
/api/precompile/<addr>/account?address=0x..   account-scoped precompile read
/api/tokens           protocol token directory (1WAY live supply, SWAY/BIJO not yet exposed)
/api/ws               WebSocket new-head stream (note: free Cloudflare Tunnel does not proxy WS upgrades)
```

**Frontend** (`site/explorer`): every hash and address is clickable — block →
tx → from/to → account, logs → tx, precompile → live `way_*` state. The
precompile panel is the "source of truth made legible" surface: click any of
the 27, see its real on-chain state.

---

## Tokens

| Symbol | Precompile | Supply | Notes |
|---|---|---|---|
| **WAY** | native | via `way_wayTotalSupply` | Native gas + reward token |
| **1WAY** | `0x22` | via `way_1wayTotalSupply` | Bitcoin-backed stablecoin; supply = sum of BTC-locked vault balances (flexes with Bitcoin, not a constant) |
| **SWAY** | `0x24` | not yet exposed | DEX LP incentive token |
| **BIJO** | `0x25` | not yet exposed | Storage/data incentive token (epoch release) |

> Known drift: `protocol-manifest.json` labels `0x25` "SwapRoute" while
> `precompiles.go` names it BinaryJournal. Verify before relying on the name.

---

## Develop

```bash
# Protocol — build, test, consistency audit
cd consensus
CGO_ENABLED=1 go build -a -o /tmp/waychain .
go test ./...
bash scripts/audit-consistency.sh

# Explorer API
cd explorer && go build -o /tmp/waychain-explorer .

# Site / explorer frontend
cd site && vercel deploy --prod --project waychain-site

# Mobile
cd mobile && npm test
```

### Three states (never collapse)

| Word | Means | Proof |
|---|---|---|
| **coded** | in monorepo, builds/tests | `go test` / file on branch |
| **deployed** | on AWS node | binary `sha256` on `3.89.116.45` + service active |
| **live** | user-path works | browser/mobile DOM or real tx — not agent curl alone |

"Merged on GitHub" ≠ deployed ≠ live.

---

## Law & workflow

- **One working tree.** Edit only under this monorepo. No sibling repos.
- **Issue first**, branch `fix/…` / `feat/…`, PR required.
- **Close with evidence** (commit, sha, DOM, RPC) — not "done."
- `REPO_LAW.md` supersedes chat memory and convenience.

**One chain. One tree. Branches for work.**
