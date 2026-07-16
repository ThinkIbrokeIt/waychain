#!/usr/bin/env bash
# reveal_checks.sh - Run at timer zero (July 11, 22:39)
# Verifies Gauntlet page goes live and reveal tweet posts

REVEAL_TIME="2026-07-11T22:39:00"
ALERT_FILE="/tmp/wifr_reveal_alerts"

# Check Gauntlet page
check_gauntlet() {
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" https://waychain.org/gauntlet)
  if [ "$HTTP" != "200" ]; then
    send_alert "Gauntlet page not live (HTTP $HTTP)"
    return 1
  fi
  curl -s https://waychain.org/gauntlet | grep -q "Pioneer" || send_alert "Gauntlet missing Pioneer content"
  echo "✅ Gauntlet page live"
  return 0
}

# Check reveal tweet
check_tweet() {
  sleep 120  # Wait 2 minutes for tweet to post
  curl -s "https://api.twitter.com/2/tweets/search/recent?query=gauntlet%20OR%20WIFR&max_results=10" \
    -H "Authorization: Bearer ${TWITTER_BEARER}" 2>/dev/null | \
    grep -q "Gauntlet" || send_alert "Reveal tweet not detected"
  echo "✅ Tweet check complete"
}

check_gauntlet && check_tweet

send_alert() {
  curl -s -X POST "https://api.telegram.org/bot${TG_BOT_TOKEN:-default}/sendMessage" \
    -d chat_id="${TG_CHAT_ID:-default}" \
    -d text="🚨 WIFR Reveal: $1" --max-time 5 2>/dev/null
}