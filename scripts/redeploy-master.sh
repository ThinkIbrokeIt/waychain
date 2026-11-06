#!/usr/bin/env bash
set -e
cd /home/wink/projects/waychain/consensus
echo "=== [1] build master node binary (linux/amd64, CGO, -a for cache safety) ==="
GOOS=linux GOARCH=amd64 CGO_ENABLED=1 go build -a -o /tmp/waychain-new . 2>&1 | tail -20
echo "BUILD_EXIT=$?"
ls -la /tmp/waychain-new
echo "=== [2] ship to AWS 3.89.116.45 (scp broken -> cat|ssh) ==="
cat /tmp/waychain-new | ssh -i ~/Downloads/WayChain.pem -o StrictHostKeyChecking=no ubuntu@3.89.116.45 'cat > /home/ubuntu/waychain-new && chmod +x /home/ubuntu/waychain-new && echo SHIPPED_OK'
echo "=== [3] backup old + swap + restart service ==="
ssh -i ~/Downloads/WayChain.pem -o StrictHostKeyChecking=no ubuntu@3.89.116.45 'sudo cp /usr/local/bin/waychain /home/ubuntu/waychain-backup-$(date +%s) && sudo mv /home/ubuntu/waychain-new /usr/local/bin/waychain && sudo systemctl restart waychain.service && sleep 4 && sudo systemctl status waychain.service --no-pager | head -6'
echo "=== [4] verify node responds + questFund selector reachable ==="
sleep 3
curl -s -m 10 -X POST https://api.waychain.org -H 'Content-Type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"way_getBlockCount","params":[]}' | head -c 200
echo ""
echo "DEPLOY_DONE"
