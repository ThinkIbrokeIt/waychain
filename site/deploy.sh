#!/bin/bash
# WayChain Site Deploy Script
# Usage: ./deploy.sh [patch|minor|major] [message]
# Example: ./deploy.sh minor "Added governance section to whitepaper"

set -e

VERSION_FILE="version.json"
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' $VERSION_FILE | grep -o '[0-9.]*')
BUMP=${1:-patch}
MESSAGE=${2:-"Deploy $(date +%Y-%m-%d)"}

# Parse current version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump version
case $BUMP in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Usage: ./deploy.sh [patch|minor|major] [message]"; exit 1 ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

echo "=== WayChain Site Deploy ==="
echo "Current: $CURRENT_VERSION"
echo "New:     $NEW_VERSION"
echo "Message: $MESSAGE"
echo ""

# Update version.json
sed -i "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" $VERSION_FILE
sed -i "s/\"deployed_at\": \"[^\"]*\"/\"deployed_at\": \"$(date +%Y-%m-%d)\"/" $VERSION_FILE

# Commit
git add -A
git commit -m "v$NEW_VERSION: $MESSAGE"

# Deploy to production
echo ""
echo "=== Deploying v$NEW_VERSION to production ==="
vercel deploy --prod --yes

# Tag
git tag -a "v$NEW_VERSION" -m "$MESSAGE"

echo ""
echo "=== v$NEW_VERSION deployed ==="
echo "Check: https://waychain.org/version.json"
