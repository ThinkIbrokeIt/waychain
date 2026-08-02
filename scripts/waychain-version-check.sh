#!/usr/bin/env bash
set -euo pipefail

# Paths
VERSION_FILE="/home/wink/projects/waychain/site/version.json"
PROTOCOL_MANIFEST="/home/wink/projects/waychain/protocol-manifest.json"
REPO="ThinkIbrokeIt/waychain"

# Function to log and exit on error
die() {
  echo "ERROR: $*" >&2
  exit 1
}

# Check if required files exist
[[ -f "$VERSION_FILE" ]] || die "Version file not found: $VERSION_FILE"
[[ -f "$PROTOCOL_MANIFEST" ]] || die "Protocol manifest not found: $PROTOCOL_MANIFEST"

# Extract data from version.json
LOCAL_CHAIN_ID=$(jq -r '.chain_id' "$VERSION_FILE")
LOCAL_PRECOMPILES=$(jq -r '.precompiles' "$VERSION_FILE")

# Fetch chain ID from the node
REMOTE_CHAIN_ID_HEX=$(curl -s -X POST https://api.waychain.org -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | jq -r '.result // empty')

if [[ -z "$REMOTE_CHAIN_ID_HEX" ]]; then
  die "Failed to fetch chain ID from node"
fi

# Remove 0x prefix and convert to decimal
REMOTE_CHAIN_ID=$(( 16#${REMOTE_CHAIN_ID_HEX#0x} ))

# Fetch precompile count from protocol manifest (source of truth)
EXPECTED_PRECOMPILES=$(jq -r '.precompile_count' "$PROTOCOL_MANIFEST")

# Check for drift
DRIFT=0
ISSUE_TITLE=""
ISSUE_BODY=""

if [[ "$LOCAL_CHAIN_ID" -ne "$REMOTE_CHAIN_ID" ]]; then
  DRIFT=1
  ISSUE_TITLE="[DRIFT] Chain ID mismatch detected in waychain site"
  ISSUE_BODY+="The local version.json does not match the live node's chain ID.\n\n"
  ISSUE_BODY+="Local version.json:\n- chain_id: $LOCAL_CHAIN_ID\n\n"
  ISSUE_BODY+="Live node (api.waychain.org):\n- chain_id: $REMOTE_CHAIN_ID (0x${REMOTE_CHAIN_ID_HEX#0x})\n\n"
fi

if [[ "$LOCAL_PRECOMPILES" -ne "$EXPECTED_PRECOMPILES" ]]; then
  DRIFT=1
  if [[ -n "$ISSUE_TITLE" ]]; then
    ISSUE_TITLE="[DRIFT] Multiple mismatches detected in waychain site"
  else
    ISSUE_TITLE="[DRIFT] Precompile count mismatch between version.json and protocol-manifest.json"
  fi
  ISSUE_BODY+="The precompile count in version.json does not match the protocol manifest.\n\n"
  ISSUE_BODY+="version.json:\n- precompiles: $LOCAL_PRECOMPILES\n\n"
  ISSUE_BODY+="protocol-manifest.json:\n- precompiles: $EXPECTED_PRECOMPILES\n\n"
fi

if [[ $DRIFT -eq 1 ]]; then
  echo "Drift detected. Creating GitHub issue..."
  
  # Check for existing open issue with the same title to avoid duplicates
  EXISTING_ISSUE=$(gh issue list --repo "$REPO" --state open --search "\"$ISSUE_TITLE\"" --json number -q '.[0].number' 2>/dev/null || true)
  
  if [[ -n "$EXISTING_ISSUE" ]]; then
    echo "Issue #$EXISTING_ISSUE already open for this drift. Skipping duplicate."
  else
    # Create the issue
    ISSUE_BODY+="Please update version.json to reflect the current chain state.\n\nThis is an automated check from the version drift cron job."
    gh issue create --repo "$REPO" --title "$ISSUE_TITLE" --body "$ISSUE_BODY" --label "drift,automated"
    echo "Created issue for drift."
  fi
else
  echo "No drift detected. All checks passed."
  echo "Local: chain_id=$LOCAL_CHAIN_ID, precompiles=$LOCAL_PRECOMPILES"
  echo "Remote: chain_id=$REMOTE_CHAIN_ID, precompiles=$EXPECTED_PRECOMPILES"
fi