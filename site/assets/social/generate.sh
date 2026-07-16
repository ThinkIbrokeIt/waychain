#!/bin/bash
# Generate social media assets from HTML templates
# Requires: node + puppeteer or playwright

echo "Social Media Assets Generator for WayChain"

# Check what's available
if command -v playwright &> /dev/null; then
    echo "Using Playwright for screenshot..."
elif command -v node &> /dev/null; then
    echo "Node available - can use puppeteer"
else
    echo "Neither playwright nor node available for screenshot generation"
fi

# Create PNG placeholder instructions
echo ""
echo "Manual conversion steps:"
echo "1. Open /home/wink/waychain-site/assets/social/economic-loop.html in browser"
echo "2. Screenshot for Twitter: 1200x675 (16:9)"
echo "3. Screenshot for LinkedIn: 1200x627"
echo "4. Screenshot for feature chips: use as-is for web embed"
echo ""
echo "Assets created:"
ls -la /home/wink/waychain-site/assets/social/