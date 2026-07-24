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

### Prerequisites

- **Go** 1.26+ (the daemon module is `github.com/ThinkIbrokeIt/waychain-consensus`)
- **Rust + Cargo** (for the `revm-ffi` EVM engine — a Rust FFI lib linked via CGO)
- **Android SDK** (only for the mobile wallet build below)

> ⚠️ **The node WILL NOT run smart contracts if built with `CGO_ENABLED=0`.** The
> EVM engine (`revm-ffi`) is a Rust library linked through CGO — you MUST build with
> `CGO_ENABLED=1`, and the compiled `.so` must be on `LD_LIBRARY_PATH` at runtime/test
> time or the binary fails with `dlopen: librevm_ffi.so: cannot open shared object file`.

### Build the node (from clean source)

```bash
# 1) Build the Rust EVM engine FIRST — cargo lives in the revm-ffi/ SUBDIR,
#    NOT in consensus/. `cargo build` at consensus/ fails with "could not find Cargo.toml".
cd consensus/revm-ffi
cargo build --release
cd ..

# 2) Build the Go daemon. -a forces a full recompile (Go's build cache is
#    unreliable here — a stale cached rpc package can ship WITHOUT your new
#    selectors, and the node comes up "active" but returns "method not found").
CGO_ENABLED=1 go build -a -o /tmp/waychain .

# 3) Run the tests. The .so MUST be on LD_LIBRARY_PATH or tests die at runtime.
LD_LIBRARY_PATH=$PWD/revm-ffi/target/release go test ./...

# Single package, fast:
LD_LIBRARY_PATH=$PWD/revm-ffi/target/release go test ./evm -run TestSeedAllGenesis -v

# Consistency audit (precompile count vs manifest, selector drift, etc.)
bash scripts/audit-consistency.sh
```

### Run a local node

```bash
# Point the runtime at the .so, then start the binary you just built.
export LD_LIBRARY_PATH=$PWD/revm-ffi/target/release
/tmp/waychain start
# Public RPC will be served on :9545 (fronted by nginx:8080 on the live box).
```

### Deploy to the live node (AWS)

The deploy runs from a box with SSH access to `3.89.116.45` (the AWS SG only
allows specific IPs on port 22). Build the linux/amd64 binary, ship it, swap it in:

```bash
cd consensus/revm-ffi && cargo build --release
cd consensus && CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -a -o /tmp/waychain-master .

# (open the AWS SG :22 for your IP first, then:)
cat /tmp/waychain-master | ssh -i WayChain.pem ubuntu@3.89.116.45 \
  'cat > /tmp/waychain-new && chmod +x /tmp/waychain-new'
ssh -i WayChain.pem ubuntu@3.89.116.45 \
  'sudo cp /usr/local/bin/waychain /home/ubuntu/waychain-backup-$(date +%s) && \
   sudo mv /tmp/waychain-new /usr/local/bin/waychain && \
   sudo systemctl restart waychain.service'
# Verify: curl the node for a known selector's result, then close the SG rule.
```

### Explorer API

```bash
cd explorer && go build -o /tmp/waychain-explorer .
```

### Site / explorer frontend

```bash
cd site && vercel deploy --prod --project waychain-site
```

### Mobile wallet (APK)

The wallet is an Expo app. Building the release APK needs the Android SDK and a
prebuild step that generates the native `android/` project:

```bash
cd mobile
npm install
npx expo prebuild --platform android --no-install   # generates android/ from app.json
echo "sdk.dir=/path/to/Android/Sdk" > android/local.properties
cd android
./gradlew assembleRelease --no-daemon
# APK: android/app/build/outputs/apk/release/app-release.apk
```

> Pin Expo modules to SDK 53 (the project's major). Installing latest pulls SDK-57
> modules that crash at runtime with `NoClassDefFoundError: AnyTypeCache`.

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
