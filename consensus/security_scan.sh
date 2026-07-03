#!/bin/bash
# WayChain Security Scanner
# Runs OWASP ZAP against the live RPC endpoint and generates a report
# Usage: ./security_scan.sh [target_url]
# Default: http://127.0.0.1:9545

set -e

TARGET="${1:-http://127.0.0.1:9545}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="/home/wink/projects/waychain-consensus/security"
REPORT_FILE="$REPORT_DIR/zap_report_$TIMESTAMP.json"
SUMMARY_FILE="$REPORT_DIR/zap_summary_$TIMESTAMP.txt"

mkdir -p "$REPORT_DIR"

echo "============================================"
echo " WayChain Security Scan"
echo "============================================"
echo "Target:  $TARGET"
echo "Time:    $(date)"
echo "Report:  $REPORT_FILE"
echo ""

# --- Phase 1: Manual Security Checks (no ZAP needed) ---
echo "[1/4] Running manual security checks..."

MANUAL_REPORT=""

# Check 1: CORS headers
echo "  → CORS configuration..."
CORS_ORIGIN=$(curl -s --max-time 5 -I -X OPTIONS \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  "$TARGET/rpc" 2>/dev/null | grep -i "access-control-allow-origin" | head -1)

if echo "$CORS_ORIGIN" | grep -qi "evil.com"; then
  MANUAL_REPORT+="  [FAIL] CORS allows any origin (CSRF risk)\n"
elif echo "$CORS_ORIGIN" | grep -qi "waychain.org"; then
  MANUAL_REPORT+="  [PASS] CORS restricted to waychain.org\n"
else
  MANUAL_REPORT+="  [WARN] CORS header: $CORS_ORIGIN\n"
fi

# Check 2: Rate limiting (send in parallel to actually trigger limit)
echo "  → Rate limiting..."
RATE_OUTPUT=$(seq 1 200 | xargs -P 100 -I {} curl -s --max-time 2 -o /dev/null -w "%{http_code}\n" -X POST "$TARGET/rpc" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}')
RATE_429=$(echo "$RATE_OUTPUT" | grep -c "^429$" || true)
RATE_200=$(echo "$RATE_OUTPUT" | grep -c "^200$" || true)
if [ "$RATE_429" -gt 0 ]; then
  MANUAL_REPORT+="  [PASS] Rate limiting active ($RATE_429 blocked, $RATE_200 allowed out of 200 parallel)\n"
else
  MANUAL_REPORT+="  [FAIL] Rate limiting not triggered (200 parallel requests all passed)\n"
fi

# Check 3: Information disclosure
echo "  → Information disclosure..."
HEALTH=$(curl -s "$TARGET/health" 2>/dev/null)
if echo "$HEALTH" | grep -qi "blocks\|status"; then
  MANUAL_REPORT+="  [INFO] Health endpoint exposes: $HEALTH\n"
fi

# Check 4: Chain ID verification
echo "  → Chain ID..."
CHAIN_ID=$(curl -s -X POST "$TARGET/rpc" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('result','unknown'))" 2>/dev/null)
MANUAL_REPORT+="  [INFO] Chain ID: $CHAIN_ID (expected 0x2718 = 10008)\n"

if [ "$CHAIN_ID" = "0x2718" ]; then
  MANUAL_REPORT+="  [PASS] Chain ID is correct (10008)\n"
else
  MANUAL_REPORT+="  [FAIL] Chain ID mismatch! Got $CHAIN_ID, expected 0x2718\n"
fi

# Check 5: WebSocket security
echo "  → WebSocket endpoint..."
WS_CODE=$(curl -s --max-time 3 -o /dev/null -w "%{http_code}" \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "$TARGET/" 2>/dev/null || echo "timeout")
MANUAL_REPORT+="  [INFO] WebSocket upgrade response: HTTP $WS_CODE\n"

# Check 6: Method enumeration (check dangerous methods aren't exposed)
echo "  → Method enumeration..."
for method in "personal_unlockAccount" "admin_nodeInfo" "debug_traceTransaction"; do
  RESP=$(curl -s --max-time 3 -X POST "$TARGET/rpc" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"$method\",\"params\":[\"0x0\",\"latest\"],\"id\":1}" 2>/dev/null)
  # Check if we get an actual result (not an error) — this means the method is exposed
  if echo "$RESP" | grep -q '"result"'; then
    MANUAL_REPORT+="  [FAIL] Method $method is exposed (got result)\n"
  elif echo "$RESP" | grep -q "Method not found"; then
    MANUAL_REPORT+="  [PASS] Method $method properly disabled\n"
  else
    MANUAL_REPORT+="  [WARN] Method $method status unclear\n"
  fi
done

echo ""
echo "[2/4] Manual checks complete."
echo ""

# --- Phase 2: OWASP ZAP Scan (if available) ---
echo "[3/4] Running OWASP ZAP scan..."

ZAP_AVAILABLE=false
if command -v docker &> /dev/null; then
  # Check if ZAP image exists or can be pulled
  if docker image list | grep -qi "zap\|owasp" 2>/dev/null; then
    ZAP_AVAILABLE=true
  elif docker pull ghcr.io/zaproxy/zaproxy:stable > /dev/null 2>&1; then
    ZAP_AVAILABLE=true
  fi
fi

if [ "$ZAP_AVAILABLE" = true ]; then
  echo "  → ZAP found, running full scan..."
  
  # Run ZAP in docker container
  docker run --rm -v "$REPORT_DIR:/zap/wrk" \
    --network host \
    ghcr.io/zaproxy/zaproxy:stable \
    zap-baseline.py \
    -t "$TARGET" \
    -r "$REPORT_DIR/zap_report_$TIMESTAMP.html" \
    -w "$REPORT_DIR/zap_report_$TIMESTAMP.md" \
    -J "$REPORT_FILE" \
    --auto \
    2>&1 | tail -20
  
  echo "  → ZAP report saved to $REPORT_DIR/"
else
  echo "  → ZAP not available (docker not installed)"
  echo "  → Install docker to enable automated ZAP scanning:"
  echo "     sudo apt install docker.io"
  echo "     docker pull ghcr.io/zaproxy/zaproxy:stable"
  echo ""
  echo "  → Skipping ZAP scan, manual checks only."
fi

echo ""

# --- Phase 3: Generate Summary ---
echo "[4/4] Generating summary..."

cat > "$SUMMARY_FILE" << EOF
WayChain Security Scan Summary
================================
Target:      $TARGET
Date:        $(date)
Chain ID:    $CHAIN_ID

Manual Security Checks:
$MANUAL_REPORT

Risk Levels:
  [FAIL] = Must fix immediately
  [WARN] = Should fix
  [PASS] = Good
  [INFO] = Informational

Next Steps:
  - Review all [FAIL] items above
  - Run full ZAP scan: docker run --rm -v /tmp/zap:/zap/wrk ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t $TARGET
  - Review ZAP report for OWASP Top 10 vulnerabilities
  - Re-run this scan after fixes
EOF

echo "============================================"
echo " Scan complete!"
echo " Summary:  $SUMMARY_FILE"
echo " Report:  $REPORT_FILE"
echo "============================================"
echo ""
cat "$SUMMARY_FILE"