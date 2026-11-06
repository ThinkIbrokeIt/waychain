#!/usr/bin/env bash
# check_pool_balances.sh - Verify WAY reward pools haven't drained
# Run every 5 minutes post-reveal

REWARDS_CONTRACT="${REWARDS_CONTRACT:-0x0000000000000000000000000000000000000000}"

check_pool() {
  curl -s -X POST https://api.waychain.org \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"'$REWARDS_CONTRACT'","data":"0x12345678"},"latest"]}' \
    -m 10 2>/dev/null | jq -r '.result' 2>/dev/null
}

BALANCE=$(check_pool)
if [ "$BALANCE" != "0x" ]; then
  echo "✅ Pool check: $BALANCE"
else
  # Check all 3 pools
  for pool in 1 2 3; do
    AMOUNT=$(curl -s -X POST https://api.waychain.org \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"'$REWARDS_CONTRACT'","data":"0x$(printf '%064x' $pool)"},"latest"]}' 2>/dev/null | \
      jq -r '.result' 2>/dev/null)
    [ "$AMOUNT" = "0x0" ] && send_alert "Pool $pool empty - investigate"
  done
fi

send_alert() {
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN:-default}/sendMessage" \
    -d chat_id="${TG_CHAT_ID:-default}" \
    -d text="🚨 WIFR Pool: $1" --max-time 5 2>/dev/null
}