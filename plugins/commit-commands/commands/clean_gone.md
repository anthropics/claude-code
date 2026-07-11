---
description: Safely removes local branches whose configured upstream is gone, without discarding work or unique commits.
---

## Your Task

Clean up branches whose configured upstream no longer exists. Candidate
selection must use Git's tracking metadata, not commit subjects or formatted
`git branch -v` output. Never force-remove a worktree or force-delete a branch.

Run the following script from the repository to inspect and safely remove only
eligible branches:

```bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
current_branch=$(git symbolic-ref --quiet --short HEAD || true)
removed=0
skipped=0
found=0

find_branch_worktree() {
  local branch_ref="refs/heads/$1"
  local path=""
  local line

  while IFS= read -r line; do
    case "$line" in
      "worktree "*) path=${line#worktree } ;;
      "branch $branch_ref")
        printf '%s\n' "$path"
        return 0
        ;;
      "") path="" ;;
    esac
  done < <(git worktree list --porcelain)

  return 1
}

while IFS=$'\t' read -r branch tracking_state; do
  [[ "$tracking_state" = "[gone]" ]] || continue
  found=$((found + 1))
  printf 'Inspecting gone-upstream branch: %s\n' "$branch"

  if [[ "$branch" = "$current_branch" ]]; then
    echo "  SKIP: the branch is checked out in the current worktree"
    skipped=$((skipped + 1))
    continue
  fi

  worktree_path=$(find_branch_worktree "$branch" || true)

  if [[ -n "$worktree_path" ]]; then
    if [[ ! -d "$worktree_path" ]]; then
      echo "  SKIP: associated worktree path is unavailable: $worktree_path"
      skipped=$((skipped + 1))
      continue
    fi

    # `git status` deliberately hides paths carrying assume-unchanged or
    # skip-worktree. Removing such a worktree can therefore discard local
    # edits that look clean. Treat either index visibility flag as local state.
    index_visibility_flags=$(git -C "$worktree_path" ls-files -v | awk '
      substr($0, 1, 1) == "S" { skip_worktree = 1 }
      substr($0, 1, 1) ~ /^[a-z]$/ { assume_unchanged = 1 }
      END {
        if (assume_unchanged && skip_worktree) print "assume-unchanged and skip-worktree"
        else if (assume_unchanged) print "assume-unchanged"
        else if (skip_worktree) print "skip-worktree"
      }
    ')
    if [[ -n "$index_visibility_flags" ]]; then
      echo "  SKIP: associated worktree has index visibility flags ($index_visibility_flags): $worktree_path"
      skipped=$((skipped + 1))
      continue
    fi

    if [[ -n "$(git -C "$worktree_path" status --porcelain --untracked-files=all --ignored=matching)" ]]; then
      echo "  SKIP: associated worktree has tracked, untracked, or ignored files: $worktree_path"
      skipped=$((skipped + 1))
      continue
    fi
  fi

  # Match `git branch -d` safety before removing an associated worktree. A
  # branch with a commit not reachable from the current HEAD is preserved.
  if ! git -C "$repo_root" merge-base --is-ancestor "$branch" HEAD; then
    echo "  SKIP: branch contains commits not merged into the current HEAD"
    skipped=$((skipped + 1))
    continue
  fi

  if [[ -n "$worktree_path" ]]; then
    echo "  Removing clean worktree: $worktree_path"
    git worktree remove "$worktree_path"
  fi

  echo "  Deleting fully merged branch: $branch"
  git branch -d -- "$branch"
  removed=$((removed + 1))
done < <(LC_ALL=C git for-each-ref \
  --format='%(refname:short)%09%(upstream:track)' \
  refs/heads/)

if [[ $found -eq 0 ]]; then
  echo "No branches with gone upstreams were found."
else
  printf 'Cleanup complete: %d removed, %d skipped.\n' "$removed" "$skipped"
fi
```

Report every removed and skipped branch with the reason printed by the script.
Do not retry skipped branches with `--force`, `git branch -D`, or manual file
deletion.
