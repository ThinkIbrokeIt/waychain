#!/usr/bin/env bash
# resume_monitoring.sh - Resume WIFR monitors for reveal window

echo "Resuming WIFR monitoring jobs..."

# Create fresh crontab with all monitors
cat > /tmp/wifr_crontab_final << 'CRONEOF'
# WIFR Certification Gauntlet - Monitoring
# Pre-reveal checks
*/5 * * * * /home/wink/projects/waychain-site/scripts/monitor/check_token.sh
*/10 * * * * /home/wink/projects/waychain-site/scripts/monitor/check_social.sh

# Gauntlet page status
*/5 * * * * curl -s -o /dev/null -w "%{http_code}" https://waychain.org/gauntlet

# Post-reveal ongoing (every 5 minutes)
*/5 * * * * /home/wink/projects/waychain-site/scripts/monitor/check_pool_balances.sh
CRONEOF

crontab /tmp/wifr_crontab_final
rm /tmp/wifr_crontab_final

echo "✅ All WIFR monitoring resumed"