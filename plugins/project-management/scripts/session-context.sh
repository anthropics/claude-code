#!/bin/bash
# Session Context Loader for Project Management Plugin
# Runs at session start to load Git and GitHub context

set -e

# Check if we're in a Git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo '{"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "Not in a Git repository. Git workflow commands will not be available."}}'
    exit 0
fi

# Gather Git context
BRANCH=$(git branch --show-current 2>/dev/null || echo "detached HEAD")
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "unknown")
REPO_NAME=$(basename "$REPO_ROOT")

# Check for uncommitted changes
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')

# Check branch status relative to origin
AHEAD=0
BEHIND=0
if git rev-parse --abbrev-ref --symbolic-full-name @{u} > /dev/null 2>&1; then
    AHEAD=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
    BEHIND=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo 0)
fi

# Check for merge conflicts
CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null | wc -l | tr -d ' ')

# GitHub CLI context
GH_AVAILABLE="false"
GH_AUTH="false"
GH_REPO=""
OPEN_PRS="N/A"
OPEN_ISSUES="N/A"

if command -v gh &> /dev/null; then
    GH_AVAILABLE="true"
    if gh auth status > /dev/null 2>&1; then
        GH_AUTH="true"
        GH_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
        if [ -n "$GH_REPO" ]; then
            OPEN_PRS=$(gh pr list --json number 2>/dev/null | jq 'length' 2>/dev/null || echo "N/A")
            OPEN_ISSUES=$(gh issue list --json number 2>/dev/null | jq 'length' 2>/dev/null || echo "N/A")
        fi
    fi
fi

# Build context message
CONTEXT="## Git Context

**Repository**: ${REPO_NAME}
**Branch**: ${BRANCH}
**Main Branch**: ${MAIN_BRANCH}

**Git Status**:
- Uncommitted changes: ${UNCOMMITTED}
- Staged files: ${STAGED}
- Unstaged files: ${UNSTAGED}
- Commits ahead: ${AHEAD}
- Commits behind: ${BEHIND}
- Merge conflicts: ${CONFLICTS}

## GitHub Context

**gh CLI**: ${GH_AVAILABLE}
**Authenticated**: ${GH_AUTH}
**Repository**: ${GH_REPO:-Not connected}
**Open PRs**: ${OPEN_PRS}
**Open Issues**: ${OPEN_ISSUES}

**Commands Available**:
- \`/pm-status\` - View project status
- \`/pm-branch\` - Branch operations
- \`/pm-sync\` - Sync with main branch
- \`/pm-commit\` - Semantic commit
- \`/pm-pr\` - PR operations
- \`/pm-gh\` - GitHub CLI operations
- \`/pm-cleanup\` - Clean merged branches
- \`/pm-rebase\` - Interactive rebase"

# Add warnings if needed
if [ "$CONFLICTS" -gt 0 ]; then
    CONTEXT="${CONTEXT}

⚠️ **Warning**: There are unresolved merge conflicts. Resolve before continuing."
fi

if [ "$BEHIND" -gt 5 ]; then
    CONTEXT="${CONTEXT}

⚠️ **Warning**: Branch is ${BEHIND} commits behind origin. Consider syncing with \`/pm-sync\`."
fi

if [ "$GH_AVAILABLE" = "true" ] && [ "$GH_AUTH" = "false" ]; then
    CONTEXT="${CONTEXT}

⚠️ **Warning**: GitHub CLI not authenticated. Run \`gh auth login\` for full GitHub integration."
fi

# Output JSON
cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $(echo "$CONTEXT" | jq -Rs .)
  }
}
EOF
