# Example 2: Build a feature with tests + review

Goal: add a `--dry-run` flag to a CLI deploy script, with tests for the flag's behavior and an end-of-task review.

## Spawn

```
/swarm-spawn Add a --dry-run flag to cli/deploy.py — prints planned operations, executes nothing. Tests for both with-flag and without-flag paths. Land in one PR.
```

## DAG the swarm proposes

```
   scan-deploy ──► impl-flag ──► add-tests ──► review ──► merge
```

A simple linear chain — small feature, no fan-out needed.

| Task | Head | Notes |
|---|---|---|
| `scan-deploy` | scanner | Reads `cli/deploy.py`, identifies the side-effecting calls that need to be guarded. Files concrete tasks. |
| `impl-flag` | builder | Adds the argparse flag, refactors `execute(...)` to take a `dry_run: bool`, gates side-effects. |
| `add-tests` | builder | Writes tests for both paths against the existing test infra. |
| `review` | reviewer | Reviews for: missed side-effect, log format consistency, doc updates. |
| `merge` | merger | pytest -q, then push. |

## Why this DAG and not parallel

For small features, serial is faster than parallel — the coordination cost of fan-out (worktree creation, file-overlap check, sibling sync) outweighs the speedup when each step is < 5 minutes anyway.

## What review surfaces

The reviewer agent (read-only) inspects the diff and produces something like:

```
REVIEWER end-of-task — task review

Files changed: cli/deploy.py (+18/-3), tests/test_deploy.py (+42/-0)
Commits: 3 (feat: argparse flag / refactor: thread dry_run / test: dry-run path)

Findings (confidence ≥ 80):
1. [conf 92] cli/deploy.py:142 — log message reads "Deploying X" even in dry-run.
   Suggest: prefix with "[DRY-RUN]" when dry_run=True.

2. [conf 84] tests/test_deploy.py:67 — test asserts on log output but uses
   capsys without capturing stderr. Add capsys.readouterr().err to the assert.

Otherwise: clean. Tests cover both paths. Docstring updated.

Recommendation: address both, then merge.
```

The Builder picks these up, makes 2 more commits (`refactor: log prefix in dry-run`, `test: capture stderr in deploy tests`), and the cycle continues. Once `review` returns clean, `merge` fires automatically.

## Expected outcome

- One PR with 4–5 commits.
- ~20–60k tokens total spend.
- 10–30 minutes wall time.
