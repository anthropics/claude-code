# Example 3: Multi-day audit

Goal: produce a comprehensive complexity + security audit of an existing codebase, ending in a markdown report at `docs/audits/`. No code changes.

## Spawn

```
/swarm-spawn Audit src/auth/ for OWASP top-10 issues AND src/core/ for cyclomatic complexity > 15. Produce two separate audit docs at docs/audits/. No code changes — research only.
```

## DAG the swarm proposes

```
   scan-targets ──┬──► owasp-audit  ─────┐
                  └──► complexity-audit ─┴──► consolidate-summary
```

| Task | Head | Notes |
|---|---|---|
| `scan-targets` | scanner | Maps the territory of `src/auth/` and `src/core/`, files the two audit tasks with precise scope. |
| `owasp-audit` | auditor | Read-only deep dive into auth code; produces `docs/audits/auth-owasp-2026-05-10.md`. |
| `complexity-audit` | auditor | Read-only complexity survey of core; produces `docs/audits/core-complexity-2026-05-10.md`. |
| `consolidate-summary` | auditor | Reads both audits, produces a top-level `docs/audits/2026-05-10-summary.md` with priority-ranked findings across both. |

## Why two audits in parallel

`src/auth/` and `src/core/` don't overlap (file overlap = 0), so `parallelism_safety=safe` and the two auditors run concurrently. The orchestrator dispatches both as soon as `scan-targets` completes.

## Why no `merge`

The deliverable is markdown, not code. The Auditor head writes its `.md` files directly into the working tree. There's no merge gate because there's nothing to merge — the operator commits the audit docs by hand (or via a subsequent `/commit-push-pr`), or the swarm can be configured with a final builder step that does the commit.

If the operator does want auto-commit:

```
/swarm-spawn Audit src/auth/ ... AND commit the resulting docs to a branch + PR.
```

Then the DAG becomes:

```
   scan-targets ──┬──► owasp-audit ──────────┐
                  └──► complexity-audit ──┐  │
                                          ▼  ▼
                                       commit-docs ──► merge
```

with a Builder at `commit-docs` (Bash + Edit only — git add the audit docs, write a commit message, push) and a Merger after.

## Expected outcome

- 2–3 markdown files at `docs/audits/`, each 200–600 lines, every finding citing file:line evidence.
- ~80–200k tokens total spend (audit work is read-heavy and Opus-tier).
- 1–4 hours wall time depending on codebase size.

## Pattern: long-running audits

For very large codebases, you can split each audit into N sub-audits by directory and chain them serially or in batches:

```
   scan-targets ──► [audit-auth-1, audit-auth-2, ..., audit-auth-N] ──► consolidate-auth ──► ...
```

Each sub-auditor produces a partial doc; `consolidate-auth` merges them into the final report. Useful when one auditor session would blow the context window or budget.
