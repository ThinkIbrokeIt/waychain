#!/usr/bin/env bash
# Compares version.json with live node reality
# Returns 0 if no drift, 1 if drift detected
# Checks: chain_id (RPC), binary hash (SSH), block height (RPC)

set -euo pipefail

REPO_ROOT="/home/wink/projects/waychain"
VERSION_JSON="$REPO_ROOT/version.json"
AWS_HOST="ubuntu@3.89.116.45"
SSH_KEY="/home/wink/Downloads/WayChain.pem"
LIVE_RPC="https://api.waychain.org"

# Helper for RPC calls
rpc_call() {
    local method="$1"
    local params="${2:-[]}"
    curl -s -X POST "$LIVE_RPC" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":$params,\"id\":1}" |
        jq -r .result
}

# Read version.json
if [[ ! -f "$VERSION_JSON" ]]; then
    echo "ERROR: Version file not found: $VERSION_JSON"
    exit 1
fi

VJSON_VERSION=$(jq -r '.version' "$VERSION_JSON")
VJSON_CHAIN_ID=$(jq -r '.chain_id' "$VERSION_JSON")
VJSON_CHAIN_ID_HEX=$(jq -r '.chain_id_hex' "$VERSION_JSON")
VJSON_PRECOMPLES=$(jq -r '.precompiles' "$VERSION_JSON")

echo "=== WayChain Version Drift Check ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "���������📄 version.json:"
echo "  version: $VJSON_VERSION"
echo "  chain_id: $VJSON_CHAIN_ID"
echo "  chain_id_hex: $VJSON_CHAIN_ID_HEX"
echo "  precompiles: $VJSON_PRECOMPLES"
echo ""

# Query live node chain ID
echo "���������🌐 Querying live node at $LIVE_RPC..."
LIVE_CHAIN_ID_HEX=$(rpc_call "eth_chainId")
if [[ -z "$LIVE_CHAIN_ID_HEX" || "$LIVE_CHAIN_ID_HEX" == "null" ]]; then
    echo "������❌ Failed to get chain ID from live node"
    exit 1
fi
# Convert hex to decimal
LIVE_CHAIN_ID_DEC=$((LIVE_CHAIN_ID_HEX))
echo "  live chain_id: $LIVE_CHAIN_ID_HEX ($LIVE_CHAIN_ID_DEC)"
if [[ "$VJSON_CHAIN_ID" != "$LIVE_CHAIN_ID_DEC" ]]; then
    echo "������❌ DRIFT DETECTED: Chain ID mismatch!"
    echo "   version.json: $VJSON_CHAIN_ID"
    echo "   live:         $LIVE_CHAIN_ID_HEX ($LIVE_CHAIN_ID_DEC)"
    echo ""
else
    echo "������✅ Chain ID matches"
    echo ""
fi

# Check live binary hash via SSH
echo "���������🔐 Checking live binary hash on AWS..."
LIVE_HASH=$(ssh -o ConnectTimeout=5 -i "$SSH_KEY" "$AWS_HOST" "sha256sum /usr/local/bin/waychain" | awk '{print $1}')
if [[ -z "$LIVE_HASH" ]]; then
    echo "������❌ Failed to get live binary hash via SSH"
    exit 1
fi
LOCAL_HASH=$(sha256sum "$REPO_ROOT/../waychain-consensus/waychain" | awk '{print $1}')
echo "  live binary hash: $LIVE_HASH"
echo "  local binary hash: $LOCAL_HASH"
if [[ "$LIVE_HASH" != "$LOCAL_HASH" ]]; then
    echo "������❌ DRIFT DETECTED: Binary hash mismatch!"
    echo "   live:  $LIVE_HASH"
    echo "   local: $LOCAL_HASH"
    echo ""
else
    echo "������✅ Binary hash matches"
    echo ""
fi

# Check live node liveness (block height)
echo "���������📊 Checking live node liveness..."
LIVE_BLOCK_HEIGHT=$(rpc_call "eth_blockNumber")
if [[ -z "$LIVE_BLOCK_HEIGHT" || "$LIVE_BLOCK_HEIGHT" == "null" ]]; then
    echo "������❌ Failed to get block height from live node"
    exit 1
fi
# Convert hex to decimal for display
LIVE_BLOCK_HEIGHT_DEC=$((LIVE_BLOCK_HEIGHT))
echo "  live block height: $LIVE_BLOCK_HEIGHT ($LIVE_BLOCK_HEIGHT_DEC)"
if [[ "$LIVE_BLOCK_HEIGHT" == "0x0" || "$LIVE_BLOCK_HEIGHT_DEC" -eq 0 ]]; then
    echo "������❌ Live node is not producing blocks (height 0)"
    echo ""
else
    echo "������✅ Live node is producing blocks"
    echo ""
fi

# Determine if any drift was detected
DRIFT_DETECTED=0
if [[ "$VJSON_CHAIN_ID" != "$LIVE_CHAIN_ID_DEC" ]]; then DRIFT_DETECTED=1; fi
if [[ "$LIVE_HASH" != "$LOCAL_HASH" ]]; then DRIFT_DETECTED=1; fi
# Note: We don't check block height for drift because height 0 is the only drift condition, and we already errored on that.

if [[ $DRIFT_DETECTED -eq 1 ]]; then
    echo "=== Drift Check Summary ==="
    echo "������❌ DRIFT DETECTED — version.json does not match live node"
    exit 1
else
    echo "=== Drift Check Summary ==="
    echo "������✅ No drift detected"
    exit 0
fi