#!/bin/bash

#######################################################################
# Quick GitHub Push Script
# Pushes the deployment branch to bagussundaru/claude-trading
#######################################################################

set -e

echo "🔄 Pushing to GitHub: bagussundaru/claude-trading"
echo "=================================================="
echo ""

BRANCH="claude/ai-trader-shadow-mvp-setup-011CV55RbJpsFUXgSbmjzmbd"
REPO_URL="git@github.com:bagussundaru/claude-trading.git"

# Navigate to project
cd ~/claude-code

# Verify we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "❌ Wrong branch! Current: $CURRENT_BRANCH"
    echo "   Expected: $BRANCH"
    echo "   Switching to deployment branch..."
    git checkout "$BRANCH"
fi

# Verify remote exists
if ! git remote get-url github &> /dev/null; then
    echo "➕ Adding GitHub remote..."
    git remote add github "$REPO_URL"
fi

# Show commit summary
echo "📝 Commits to be pushed:"
echo ""
git log --oneline origin/$BRANCH..$BRANCH 2>/dev/null || git log --oneline -5
echo ""

# Push to GitHub
echo "🚀 Pushing to GitHub..."
git push github "$BRANCH"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "📍 View your code at:"
    echo "   https://github.com/bagussundaru/claude-trading/tree/$BRANCH"
    echo ""
    echo "💡 To merge to main:"
    echo "   git checkout main"
    echo "   git merge $BRANCH"
    echo "   git push github main"
else
    echo ""
    echo "❌ Push failed!"
    echo ""
    echo "🔑 Make sure your SSH key 'Trading Bot Server' is configured:"
    echo "   ssh -T git@github.com"
    echo ""
    echo "   If not configured:"
    echo "   1. Generate key: ssh-keygen -t ed25519 -C \"your_email@example.com\""
    echo "   2. Add to GitHub: https://github.com/settings/keys"
    exit 1
fi
