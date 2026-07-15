---
name: code-quality-pipeline
description: "The code-quality gates that stand between 'code written' and 'code merged'. Covers TWO gates: (A) a 4-step per-file pipeline — Code Review → Code Simplification → Security Review → Final Review — run after you finish implementing a feature and unit + integration tests pass, before e2e; and (B) a final holistic review of the ENTIRE diff against the base branch, run right before creating an MR/PR. Use this skill WHENEVER implementation is complete and you need the quality gates, when you're about to create an MR/PR or close out a feature branch, or on 'run the pipeline', 'code quality check', 'review before e2e', or 'pre-merge review'."
---

# Code Quality Pipeline

The quality gates that stand between "code written" and "code merged." There are **two gates**, run at different moments and at different granularities — this skill covers both:

- **Gate A — per-file pipeline** — runs after you finish implementing a feature and unit + integration tests pass, **before** writing e2e tests. Reviews each changed file in isolation.
- **Gate B — holistic pre-merge review** — runs right **before creating the MR/PR** (after e2e, if the project has any). Reviews the **entire diff against the base branch** as one coherent change set.

They're complementary: Gate A catches issues file-by-file during development; Gate B catches cross-file interactions and overall coherence that only show up when you look at the whole change at once. Run both — passing Gate A does not exempt the change from Gate B.

## ⚠️ Required dependencies — install before running

This skill **orchestrates external review tools; it does not bundle them.** Each step needs a tool that ships elsewhere. If a tool is missing, that step cannot run — install it first, or explicitly skip the step and say so. **Never report a gate as passed when its tool was absent.**

| Step | Requires | Where to get it |
|---|---|---|
| Steps 1 & 4 — Code Review | `feature-dev` plugin (`code-reviewer` agent) | `/plugin install feature-dev@claude-code-plugins` |
| Step 2 — Code Simplification | a code-simplifier agent (e.g. `pr-review-toolkit`'s `code-simplifier`) | `/plugin install pr-review-toolkit@claude-code-plugins` |
| Step 3 — Security Review | `/security-review` command | `/plugin install code-review@claude-code-plugins`, or the built-in security review |
| Gate B — Holistic pre-merge review | `/code-review` command | `/plugin install code-review@claude-code-plugins` |

All of the above are available from Anthropic's official marketplace (`anthropics/claude-code`); substitute equivalents from any other marketplace if you prefer.

> **How to install:** see [INSTALL.md](../../INSTALL.md) for step-by-step instructions to install these dependency plugins.

---

## Gate A — per-file pipeline (after implementation, before e2e)

### Prerequisites
All unit tests and all integration tests pass. If anything is failing, fix it first — the pipeline assumes working code.

### The pipeline

#### Step 1 — Code Review (parallel)
Spawn **multiple `code-reviewer` subagents in parallel** — one per changed/created file (or logical module). Each reviews for bugs, logic errors, and adherence to project conventions. Collect all findings and **fix every issue before Step 2.**

#### Step 2 — Code Simplification (parallel)
After Step 1 fixes are applied, spawn **multiple `code-simplifier` subagents in parallel** — one per changed/created file. Each simplifies structure, removes redundancy, and improves clarity **while preserving all functionality** (no behavior changes). Apply all changes.

#### Step 3 — Security Review
After Step 2 changes are applied, run the **security review** over the changed code. Unlike the other steps, this is typically a single command (`/security-review`) that scans the pending diff for vulnerabilities — injection, XSS, path traversal, secret leakage, and the rest of the OWASP Top 10 — rather than a per-file agent fan-out. If your security tool does support per-file agents, run one per changed file in parallel. Collect findings and **fix before Step 4.**

#### Step 4 — Final Code Review (parallel)
After Step 3 fixes are applied, spawn **`code-reviewer` subagents in parallel** again — one per modified file. This pass verifies that simplification and security fixes didn't introduce regressions and that the code meets quality standards.

### Rules
- **The 4 steps are strictly sequential** — never run them out of order. Skip a step **only** when its required tool is absent (per *Required dependencies* above) and say so explicitly; otherwise never skip.
- **Within each step, maximize parallelism** — one agent per file/module, all running concurrently.
- **Apply feedback between steps** — fix what each step finds before running the next.
- **If Step 4 finds issues**, fix them before moving to e2e tests. Re-run the pipeline only if Step 4's findings are significant — a real bug, security issue, or regression, not a style nit.
- **Re-verify** that unit and integration tests still pass after the pipeline completes.

---

## Gate B — holistic pre-merge review (before the MR/PR)

The final gate before code leaves your branch: a **holistic review of the entire diff against the base branch**, looking at the complete change set as a whole rather than file-by-file.

Runs in two situations:
1. **After finishing work on a feature branch** — before creating the MR/PR.
2. **At the end of a multi-step task** — if you've been working directly on the current branch.

### Workflow
1. **Run the holistic review** — invoke `/code-review`, which reviews the entire diff between your current branch and its base (e.g. `main`).
2. **Fix every issue found** — don't open the MR/PR with known issues; the point of this gate is to catch them before reviewers do.
3. **Verify tests still pass** after fixing review findings — run the project's own unit + integration test commands. Check the repo for how tests are invoked (e.g. `package.json` scripts, a `Makefile`, `pyproject.toml`, or the CI config); common examples:
   ```bash
   npm test            # or: yarn test, pnpm test
   pytest              # Python
   go test ./...       # Go
   cargo test          # Rust
   ```
4. **Proceed to the MR/PR** once the diff is clean and tests pass.

---

## Where each gate fits in the development flow

```
implement → unit + integration tests → Gate A (per-file pipeline)
          → e2e tests (UI projects only) → Gate B (holistic diff review) → MR/PR
```

For a backend-only service there's no e2e phase, so the flow is simply: Gate A → Gate B → MR/PR.
