#!/bin/bash
# WayChain Backup Script — saves critical infra state to encrypted backup
# Run: ./backup.sh
# Cron: 0 3 * * * /home/wink/projects/waychain/scripts/backup.sh

set -e

BACKUP_DIR="/home/wink/backups"
BACKUP_REPO="/home/wink/backups/waychain-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/tmp/waychain-backup.log"

echo "[$(date)] Starting WayChain backup..." | tee "$LOG_FILE"

mkdir -p "$BACKUP_DIR"

# Initialize backup repo if needed
if [ ! -d "$BACKUP_REPO/.git" ]; then
    mkdir -p "$BACKUP_REPO"
    cd "$BACKUP_REPO" && git init
    echo "Backup repo initialized at $BACKUP_REPO" | tee -a "$LOG_FILE"
fi

# ─── 1. Chain state (BoltDB) — incremental, stored locally ───
CHAIN_DB="$HOME/.waychain/chain.db"
LOCAL_DB_BACKUP="$BACKUP_DIR/chain-db"
if [ -f "$CHAIN_DB" ]; then
    mkdir -p "$LOCAL_DB_BACKUP"
    # Only copy if DB has changed (compare mtime/size)
    if [ ! -f "$LOCAL_DB_BACKUP/chain.db" ] || [ "$CHAIN_DB" -nt "$LOCAL_DB_BACKUP/chain.db" ]; then
        cp -f "$CHAIN_DB" "$LOCAL_DB_BACKUP/chain.db"
        echo "✅ Chain DB backed up locally ($(du -h "$CHAIN_DB" | cut -f1)) — not pushed to GitHub" | tee -a "$LOG_FILE"
    else
        echo "ℹ️  Chain DB unchanged — skipping local copy" | tee -a "$LOG_FILE"
    fi
else
    echo "⚠️  Chain DB not found at $CHAIN_DB" | tee -a "$LOG_FILE"
fi

# ─── 2. Cloudflare tunnel credentials ───
CLOUDFLARE_DIR="$HOME/.cloudflared"
if [ -d "$CLOUDFLARE_DIR" ]; then
    mkdir -p "$BACKUP_REPO/cloudflared"
    cp -f "$CLOUDFLARE_DIR"/*.json "$BACKUP_REPO/cloudflared/" 2>/dev/null
    cp -f "$CLOUDFLARE_DIR"/config.yml "$BACKUP_REPO/cloudflared/" 2>/dev/null
    # Don't backup cf_token or cert.pem in plain text
    echo "✅ Cloudflare config backed up" | tee -a "$LOG_FILE"
else
    echo "⚠️  Cloudflare directory not found" | tee -a "$LOG_FILE"
fi

# ─── 3. Agent-browser config ───
if [ -f "$HOME/.agent-browser/config.json" ]; then
    mkdir -p "$BACKUP_REPO/agent-browser"
    cp -f "$HOME/.agent-browser/config.json" "$BACKUP_REPO/agent-browser/"
    echo "✅ agent-browser config backed up" | tee -a "$LOG_FILE"
fi

# ─── 4. Hermes config and skills ───
HERMES_DIR="$HOME/.hermes"
if [ -d "$HERMES_DIR" ]; then
    mkdir -p "$BACKUP_REPO/hermes"
    # Copy skills (procedural knowledge)
    if [ -d "$HERMES_DIR/skills" ]; then
        cp -rf "$HERMES_DIR/skills" "$BACKUP_REPO/hermes/"
        echo "✅ Hermes skills backed up ($(find "$HERMES_DIR/skills" -type f | wc -l) files)" | tee -a "$LOG_FILE"
    fi
    # Copy cron jobs config
    if [ -d "$HERMES_DIR/cron" ]; then
        cp -rf "$HERMES_DIR/cron" "$BACKUP_REPO/hermes/" 2>/dev/null
        echo "✅ Hermes cron jobs backed up" | tee -a "$LOG_FILE"
    fi
    # Copy profiles (not secrets)
    if [ -d "$HERMES_DIR/profiles" ]; then
        cp -rf "$HERMES_DIR/profiles" "$BACKUP_REPO/hermes/" 2>/dev/null
        echo "✅ Hermes profiles backed up" | tee -a "$LOG_FILE"
    fi
else
    echo "⚠️  Hermes directory not found" | tee -a "$LOG_FILE"
fi

# ─── 5. Nginx config ───
if [ -f /etc/nginx/sites-available/waychain ]; then
    cp -f /etc/nginx/sites-available/waychain "$BACKUP_REPO/nginx-waychain.conf"
    echo "✅ Nginx config backed up" | tee -a "$LOG_FILE"
fi

# ─── 6. Systemd service files ───
for svc in waychain-rpc-tunnel; do
    if [ -f "/etc/systemd/system/$svc.service" ]; then
        cp -f "/etc/systemd/system/$svc.service" "$BACKUP_REPO/"
        echo "✅ Systemd service $svc backed up" | tee -a "$LOG_FILE"
    fi
done

# ─── 7. Monorepo code (latest commit ref) ───
if [ -d "$HOME/projects/waychain/.git" ]; then
    cd "$HOME/projects/waychain"
    git rev-parse HEAD > "$BACKUP_REPO/waychain-commit.txt"
    echo "✅ Monorepo commit ref saved ($(git rev-parse --short HEAD))" | tee -a "$LOG_FILE"
fi

# ─── 8. Daemon build binary ───
DAEMON_BIN="$HOME/projects/waychain/consensus/waychain-consensus"
if [ -f "$DAEMON_BIN" ]; then
    cp -f "$DAEMON_BIN" "$BACKUP_REPO/waychain-daemon"
    echo "✅ Daemon binary backed up ($(du -h "$DAEMON_BIN" | cut -f1))" | tee -a "$LOG_FILE"
fi

# ─── 9. Version info ───
{
    echo "Backup timestamp: $TIMESTAMP"
    echo "Hostname: $(hostname)"
    echo "WayChain chain ID: 10008"
    echo "Block height: $(curl -s -X POST http://localhost:9545 -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}' 2>/dev/null | grep -oP '"result":"[^"]*"' | cut -d'"' -f4)"
    echo "WayChain daemon PID: $(pgrep -f '^./waychain' || echo 'not running')"
    echo "Tunnel PID: $(pgrep -f 'cloudflared tunnel' || echo 'not running')"
} > "$BACKUP_REPO/backup-info.txt"

# ─── Commit and push to GitHub backup repo ───
# Push to a dated branch name to avoid force-push issues with stale LFS history
BRANCH_NAME="backup-$(date +%Y%m%d)"
cd "$BACKUP_REPO"
git add -A
if git diff --cached --quiet; then
    echo "ℹ️  No changes to backup" | tee -a "$LOG_FILE"
else
    git commit -m "backup $TIMESTAMP"
    # Try to push to GitHub backup repo if remote exists
    if git remote -v | grep -q origin; then
        # Push to dated branch (clean history, no large files)
        if git rev-parse --verify origin/"$BRANCH_NAME" 2>/dev/null; then
            # Branch exists — try fast-forward push
            git push origin HEAD:"$BRANCH_NAME" 2>&1 | tail -3 >> "$LOG_FILE" || echo "⚠️  Push to $BRANCH_NAME failed" | tee -a "$LOG_FILE"
        else
            # New branch — create it
            git push origin HEAD:"$BRANCH_NAME" 2>&1 | tail -3 >> "$LOG_FILE" || echo "⚠️  Push to new branch $BRANCH_NAME failed" | tee -a "$LOG_FILE"
        fi
    else
        echo "ℹ️  No remote configured — backup saved locally only" | tee -a "$LOG_FILE"
    fi
fi

echo "[$(date)] Backup complete. Size: $(du -sh "$BACKUP_REPO" | cut -f1)" | tee -a "$LOG_FILE"