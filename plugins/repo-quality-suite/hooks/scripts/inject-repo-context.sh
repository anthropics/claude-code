#!/bin/bash
# inject-repo-context.sh - UserPromptSubmit hook to inject repository context
# Adds git status, branch info, and recent changes to prompts about quality checks

INPUT=$(cat)
USER_PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // ""')

# Only inject context for quality-related prompts
QUALITY_KEYWORDS="lint|check|validate|review|quality|pr|pull request|merge|conflict"
if [[ ! "$USER_PROMPT" =~ $QUALITY_KEYWORDS ]]; then
    exit 0
fi

# Gather context
CONTEXT=""

# Git branch and status
if git rev-parse --git-dir &>/dev/null; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
    STATUS=$(git status --porcelain 2>/dev/null | head -10)
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "no remote")

    CONTEXT="Repository Context:\n"
    CONTEXT+="- Branch: $BRANCH\n"
    CONTEXT+="- Remote: $REMOTE_URL\n"

    if [ -n "$STATUS" ]; then
        CHANGED_COUNT=$(echo "$STATUS" | wc -l)
        CONTEXT+="- Modified files: $CHANGED_COUNT\n"
    fi

    # Check for ahead/behind
    AHEAD=$(git rev-list --count "origin/$BRANCH..HEAD" 2>/dev/null || echo "0")
    BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo "0")
    if [ "$AHEAD" -gt 0 ] || [ "$BEHIND" -gt 0 ]; then
        CONTEXT+="- Ahead: $AHEAD, Behind: $BEHIND\n"
    fi
fi

# Output context if gathered
if [ -n "$CONTEXT" ]; then
    echo -e "$CONTEXT"
fi

exit 0
