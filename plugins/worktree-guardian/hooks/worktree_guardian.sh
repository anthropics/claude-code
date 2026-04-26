#!/bin/bash
# worktree-guardian: Detect agent worktrees with uncommitted or unpushed work.
#
# Runs at session start. Scans .claude/worktrees/ for agent-created worktrees
# and warns if any contain work that would be lost by stale cleanup.
#
# Protects against:
#   - Committed-but-not-pushed work (invisible to rev-list --not --remotes)
#   - Uncommitted changes from interrupted agents
#   - Untracked files invisible to status --porcelain -uno
#
# See: https://github.com/anthropics/claude-code/issues/35862

set -euo pipefail

git_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
worktree_dir="${git_root}/.claude/worktrees"

[ -d "$worktree_dir" ] || exit 0

found_issues=0

for entry in "$worktree_dir"/agent-*; do
    [ -d "$entry" ] || continue

    name=$(basename "$entry")
    branch="worktree-${name}"

    # Check for uncommitted changes (including untracked files)
    uncommitted=$(git -C "$entry" status --porcelain 2>/dev/null || echo "")

    # Check for commits not on any remote
    local_commits=$(git -C "$entry" rev-list --count HEAD --not --remotes 2>/dev/null || echo "0")

    # Check for commits ahead of merge-base with default branch
    default_branch=$(git -C "$entry" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||' || echo "main")
    merge_base=$(git -C "$entry" merge-base HEAD "origin/${default_branch}" 2>/dev/null || echo "")
    ahead=0
    if [ -n "$merge_base" ]; then
        ahead=$(git -C "$entry" rev-list --count "${merge_base}..HEAD" 2>/dev/null || echo "0")
    fi

    has_uncommitted=false
    has_unpushed=false

    if [ -n "$uncommitted" ]; then
        has_uncommitted=true
    fi

    if [ "$local_commits" -gt 0 ] || [ "$ahead" -gt 0 ]; then
        has_unpushed=true
    fi

    if [ "$has_uncommitted" = true ] || [ "$has_unpushed" = true ]; then
        if [ "$found_issues" -eq 0 ]; then
            echo "" >&2
            echo "worktree-guardian: agent worktrees with unsaved work detected" >&2
            echo "" >&2
        fi

        detail=""
        if [ "$has_uncommitted" = true ] && [ "$has_unpushed" = true ]; then
            file_count=$(echo "$uncommitted" | wc -l | tr -d ' ')
            detail="${ahead} unpushed commit(s), ${file_count} uncommitted file(s)"
        elif [ "$has_unpushed" = true ]; then
            detail="${ahead} unpushed commit(s)"
        else
            file_count=$(echo "$uncommitted" | wc -l | tr -d ' ')
            detail="${file_count} uncommitted file(s)"
        fi

        echo "  ${entry}" >&2
        echo "    branch: ${branch} | ${detail}" >&2
        echo "    recover: cd ${entry} && git push -u origin ${branch}" >&2
        echo "" >&2

        found_issues=$((found_issues + 1))
    fi
done

if [ "$found_issues" -gt 0 ]; then
    echo "  Run 'git push' in each worktree above to protect the work from cleanup." >&2
    echo "  See: https://github.com/anthropics/claude-code/issues/35862" >&2
    echo "" >&2
fi

exit 0
