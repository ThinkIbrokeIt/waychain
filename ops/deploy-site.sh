#!/usr/bin/env bash
# deploy-site.sh — stage/flip the WayChain community site on OUR hardware.
# Run ON the node (ubuntu@3.89.116.45). Staging mode serves :8088 (verify first);
# flip mode enables :443 + DNS cut (manual, founder-approved).
#
# This is the Step-2 execution of DECENTRALIZATION-DOCTRINE.md. Vercel stays
# live until the flip. We are 99% ready: run this, curl :8088, then cut DNS.
set -euo pipefail
MODE="${1:-staging}"   # staging | flip
REPO="https://github.com/ThinkIbrokeIt/waychain.git"
WWW="/var/www/waychain"
CONF_SRC="/home/ubuntu/ops/nginx-site.conf"
CONF_DST="/etc/nginx/sites-enabled/waychain-site.conf"

echo "== deploy-site ($MODE) =="
sudo mkdir -p "$WWW"
sudo chown -R "$USER:$USER" "$WWW"   # ubuntu must be able to write

# Pull site/ from monorepo (shallow, site subdir only via sparse)
if [ -d "$WWW/.git" ]; then
  git -C "$WWW" fetch origin && git -C "$WWW" checkout origin/master -- site 2>/dev/null || true
  # rsync site/ out of the sparse checkout
  rsync -a --delete --exclude='.*' "$WWW/site/" "$WWW/" 2>/dev/null || true
else
  rm -rf /tmp/wc-clone && mkdir -p /tmp/wc-clone
  git clone --depth 1 --filter=blob:none --sparse "$REPO" /tmp/wc-clone
  git -C /tmp/wc-clone sparse-checkout set site
  rsync -a --delete --exclude='.*' /tmp/wc-clone/site/ "$WWW/"
  rm -rf /tmp/wc-clone
fi

# Install nginx conf
sudo cp "$CONF_SRC" "$CONF_DST"
if [ "$MODE" = "flip" ]; then
  # production: uncomment ssl listen + cert lines
  sudo sed -i 's/^    # listen 443 ssl;/    listen 443 ssl;/' "$CONF_DST"
  sudo sed -i 's|^    # ssl_certificate|    ssl_certificate|' "$CONF_DST"
  sudo sed -i 's|^    # ssl_certificate_key|    ssl_certificate_key|' "$CONF_DST"
fi

sudo nginx -t
sudo systemctl reload nginx

PORT=8088; [ "$MODE" = "flip" ] && PORT=443
echo "== verify =="
sleep 2
curl -s -o /dev/null -w "local site :$PORT -> %{http_code}\n" "http://127.0.0.1:$PORT/" || true
echo "DONE ($MODE). Vercel still live until DNS cut."
