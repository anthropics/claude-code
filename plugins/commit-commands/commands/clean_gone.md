---
description: Cleans up all git branches marked as [gone] (branches that have been deleted on the remote but still exist locally), including removing associated worktrees.
---

## Your Task

You need to execute the following bash commands to clean up stale local branches that have been deleted from the remote repository.

## Commands to Execute

1. **First, list branches to identify any with [gone] status**
   Execute this command:
   ```bash
   git branch -v
   ```
   
   Note: Branches with a '+' prefix have associated worktrees and must have their worktrees removed before deletion.

2. **Next, identify worktrees that need to be removed for [gone] branches**
   Execute this command:
   ```bash
   git worktree list
   ```

3. **Finally, remove worktrees and delete [gone] branches (handles both regular and worktree branches)**
   Execute this command:
   ```bash
   # Process all branches whose upstream has been deleted
   git for-each-ref --format='%(refname:short)%09%(upstream:track)' refs/heads | while IFS=$'\t' read -r branch tracking; do
     [ "$tracking" = "[gone]" ] || continue
     echo "Processing branch: $branch"
     # Find the associated worktree using Git's stable machine-readable format
     root_worktree=$(git rev-parse --show-toplevel)
     current_worktree=
     while IFS= read -r -d '' field; do
       case "$field" in
         "worktree "*)
           current_worktree=${field#worktree }
           ;;
         "branch refs/heads/$branch")
           if [ -n "$current_worktree" ] && [ "$current_worktree" != "$root_worktree" ]; then
             echo "  Removing worktree: $current_worktree"
             git worktree remove --force "$current_worktree"
           fi
           break
           ;;
       esac
     done < <(git worktree list --porcelain -z)
     # Delete the branch
     echo "  Deleting branch: $branch"
     git branch -D "$branch"
   done
   ```

## Expected Behavior

After executing these commands, you will:

- See a list of all local branches with their status
- Identify and remove any worktrees associated with [gone] branches
- Delete all branches marked as [gone]
- Provide feedback on which worktrees and branches were removed

If no branches are marked as [gone], report that no cleanup was needed.
