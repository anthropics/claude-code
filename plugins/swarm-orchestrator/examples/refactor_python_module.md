# Example 1: Refactor a Python module

Goal: take a 600-line `src/parser.py` written as one big class with type-switch dispatch, and refactor it into the visitor pattern with one class per node kind, plus a complete test suite — all in one PR.

## Spawn

```
/swarm-spawn Refactor src/parser.py to use the visitor pattern. Add tests covering every node kind. Land in one PR.
```

## DAG the swarm proposes

```
                     ┌──► impl-base-visitor ──► impl-node-visitors ──► add-tests ──┐
                     │                                                              │
   scan-parser ──────┤                                                              ├──► review ──► merge
                     │                                                              │
                     └──► extract-test-fixtures ────────────────────────────────────┘
```

| Task | Head | Why |
|---|---|---|
| `scan-parser` | scanner | Reconnaissance: enumerate every node kind + every call site of the dispatch logic. Files the rest of the tasks. |
| `impl-base-visitor` | builder | Define the abstract `Visitor[T]` ABC and migrate the entry point. Small, surgical change. |
| `impl-node-visitors` | builder | Implement one concrete visitor per node kind discovered in `scan-parser`. Blocked on `impl-base-visitor`. |
| `extract-test-fixtures` | builder | Pull existing test inputs into reusable parametrized fixtures. Parallel-safe with the visitor work. |
| `add-tests` | builder | Write tests for every visitor against the new fixtures. Blocked on both above. |
| `review` | reviewer | End-of-task review: DRY, simplicity, missed node kinds. |
| `merge` | merger | Rebase onto main, run pytest, push. |

## Approve, then watch

After you approve, the orchestrator:

1. Dispatches `scan-parser` and `extract-test-fixtures` in parallel (no overlap, both `safe`).
2. When `scan-parser` completes (filed N concrete sub-issues), dispatches `impl-base-visitor`.
3. When `impl-base-visitor` completes, dispatches `impl-node-visitors` (which can fan out further: one builder per visitor class if `parallelism_safety=safe` for non-overlapping files).
4. When all blockers complete, dispatches `add-tests`, then `review`, then `merge`.

Throughout: the reviewer-checkpoint hook fires every 3 turns inside each Builder, prompting a self-review on commit count + spend + tractability. If a Builder gets stuck (10 turns / no commits / repeated test fails), the operator sees it in `/swarm-status` and can drop an abort marker.

## Expected outcome

- One PR titled `refactor(parser): visitor pattern + complete test coverage`.
- 5–10 commits (one per TodoWrite item across all builders, squashed-merged or kept atomic depending on project policy).
- All existing tests pass; new tests added.
- All swarm worktrees GC'd after merge.

## Rough cost

For a 600-line file with ~10 node kinds, expect ~60–150k tokens total ($1–$3 on Sonnet) and ~30–90 minutes of wall time. Most of the spend is in the parallel `impl-node-visitors` builders.
