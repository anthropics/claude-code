---
description: Run the merge pipeline for completed swarm tasks — rebase, test gate, push. Topo-orders by file overlap.
argument-hint: "<team-name> [--branch <branch>] [--dry-run]"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "TaskList"]
---

# Swarm Merge

Run the merge pipeline against every `completed` task in the named swarm: rebase onto the target branch, run the configured test gate, push if green. If multiple branches are ready, compute their pairwise file overlap and merge in a topo-order that minimizes conflicts.

**Args:** $ARGUMENTS

## Workflow

### 1. Discover candidate branches

Read `~/.claude/teams/<team-name>/swarm-dag.json`. For every task with `status=completed` and a non-empty `branch` field that has not yet been merged into the target, add it to the candidate set.

Skip tasks marked `needs_review`, `failed`, or `paused`.

### 2. Compute merge order

For each pair of candidate branches `(A, B)`, run:

```
git diff --name-only main...A | sort > /tmp/A.files
git diff --name-only main...B | sort > /tmp/B.files
overlap = |A.files ∩ B.files| / |A.files ∪ B.files|
```

Build a directed graph: if `overlap(A, B) > threshold` (default 0.3), add a "merge B after A" edge ordered by branch age (older first). Topo-sort to get the merge sequence.

If a cycle is detected (rare; happens when three branches mutually overlap), break it by oldest-first and warn.

### 3. For each branch in order

Inside a fresh staging clone (so the user's checkout is untouched):

```bash
git fetch origin <target-branch>
git checkout -B merge-staging origin/<target-branch>
git merge --no-ff <branch>
```

If conflicts:
- Mark the source task `needs_review` in `swarm-dag.json`.
- Write a structured note to `~/.claude/teams/<team-name>/inboxes/team-lead.json`:
  `{"from": "swarm-merge", "summary": "merge conflict on <branch>", "files": [...]}`.
- Skip to the next branch.

If clean, run the test gate from the project's `.claude/swarm-orchestrator.json` (default: `pytest -q` if `pytest.ini` / `pyproject.toml` exists, else skip). On failure: same `needs_review` path. On success: continue.

### 4. Push

If the staging branch is green and ahead of origin/<target>:

```bash
git push origin merge-staging:<target-branch>
```

(Or open a PR via `gh pr create` if the target is a protected branch — read the project config to decide.)

Mark the task `merged` in `swarm-dag.json`. Fire the `worktree-gc` step.

### 5. Worktree GC

For every worktree on a branch now merged, run:

```bash
git worktree remove --force <path>
git branch -D <branch>
```

Log the cleanups. Don't error on a worktree that has uncommitted changes — surface in `--dry-run` first so the operator can inspect.

## Dry-run mode

`--dry-run` prints the planned actions without executing them:

```
Would merge in this order:
  1. feat/api-A     → main   (no overlap with siblings)
  2. feat/api-B     → main   (overlap 0.42 with feat/api-A; serialized after A)
  3. feat/ui-C      → main   (no overlap with API branches)

Test gate: pytest -q  (would run inside staging clone)
Worktrees to GC after success: 3
```

## Examples

### Merge all green tasks in a swarm

```
/swarm-merge my-refactor-team
```

### Merge only one specific branch

```
/swarm-merge my-refactor-team --branch feat/visitor-pattern
```

### Dry-run the topology

```
/swarm-merge my-refactor-team --dry-run
```

## Configuration

`.claude/swarm-orchestrator.json`:

```json
{
  "merge": {
    "target_branch": "main",
    "test_gate_command": "pytest -q",
    "use_pr_for_protected_branches": true,
    "file_overlap_threshold": 0.3,
    "max_parallel_merges": 1
  }
}
```

## Notes

- Merge runs strictly serially by default (`max_parallel_merges: 1`). Concurrent merges into the same target are rarely worth the conflict risk.
- The staging clone lives at `~/.claude/teams/<team-name>/staging/` and is reused across runs.
- All git operations are logged to `~/.claude/teams/<team-name>/merge-log.jsonl` for post-mortem.
