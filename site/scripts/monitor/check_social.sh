#!/usr/bin/env bash
# check_social.sh - Ensure no accidental WIFR tweets
# Run every 10 minutes

KEYWORD="WIFR"
ALERT_SENT_FILE="/tmp/wifr_social_alert_sent"

check_tweets() {
  curl -s "https://api.twitter.com/2/users/me/tweets?max_results=5" \
    -H "Authorization: Bearer ${TWITTER_BEARER}" \
    -H "Content-Type: application/json" 2>/dev/null | \
    grep -o "$KEYWORD" | wc -l
}

COUNT=$(check_tweets)
if [ "$COUNT" -gt 0 ]; then
  if [ ! -f "$ALERT_SENT_FILE" ]; then
    send_alert "Accidental WIFR tweet detected - check and delete immediately"
    touch "$ALERT_SENT_FILE"
  fi
else
  rm -f "$ALERT_SENT_FILE"
fi

send_alert() {
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN:-default}/sendMessage" \
    -d chat_id="${TG_CHAT_ID:-default}" \
    -d text="🚨 WIFR Monitor: $1" --max-time 5 2>/dev/null
}