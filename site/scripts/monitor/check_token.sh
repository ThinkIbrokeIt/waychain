#!/usr/bin/env bash
# check_token.sh - Verify WIFR SPL token health on Solana

send_alert() {
  [ -z "$TG_BOT_TOKEN" ] && return
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
    -d chat_id="${TG_CHAT_ID}" \
    -d text="🚨 WIFR Monitor: $1" --max-time 5 2>/dev/null
}

TOKEN_ADDRESS="${WIFR_MINT:-8Q18zFzoXnGQqX4ca89aZHsQwEmKFcJHbBf189QDpump}"

SUPPLY=$(curl -s https://api.mainnet-beta.solana.com -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getTokenSupply","params":["'$TOKEN_ADDRESS'"]}' \
  | jq -r '.result.value.amount' 2>/dev/null)

if [ -z "$SUPPLY" ] || [ "$SUPPLY" = "null" ]; then
  send_alert "WIFR token not found or supply query failed"
  exit 1
fi

EXPECTED="1000000000000000"
if [ "$SUPPLY" != "$EXPECTED" ]; then
  send_alert "WIFR supply anomaly: $SUPPLY (expected $EXPECTED)"
fi

echo "✅ WIFR supply: $SUPPLY"