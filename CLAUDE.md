# CLAUDE.md — Workspace

## Target project

The primary project is `counterfactual/` — a Python library for
experimental design, implementation, and analysis.

Repository: `counterfactual-consulting/counterfactual` on GitHub.

## Before any work

1. Read `counterfactual/CLAUDE.md` (stop before "Prompt templates")
2. Read `counterfactual/CONTRIBUTING.md` (full read)
3. `cd counterfactual && bash setup.sh && make check` — must be green

These files are authoritative. Everything below adapts their rules for
the SoloFlow orchestration layer — it does not override them.

## SoloFlow working directory

`.soloflow/` lives inside `counterfactual/`, not at the workspace
root. All SoloFlow commands and scripts must run with CWD set to
`counterfactual/` so that:

- `.soloflow/` resolves to `counterfactual/.soloflow/`
- Worktrees are created from `counterfactual/.git/` (enabling
  parallel execution — the outer workspace repo does not contain
  the project code)
- `make check`, `make examples`, etc. run in the correct context

The `cd counterfactual` in "Before any work" (step 3) handles this.
All `.soloflow/` paths in this document are relative to
`counterfactual/`.

---

## GitHub-first workflow

GitHub Issues on `counterfactual-consulting/counterfactual` are the
single source of truth for project planning, decisions, and outcomes.
Local SoloFlow state (`.soloflow/`) is ephemeral coordination — never
treat it as documentation.

### How SoloFlow maps to counterfactual's workflow

| SoloFlow stage | GitHub artifact |
|---|---|
| Idea extracted (`/soloflow:idea-extractor`) | GitHub Issue (new or comment on existing) |
| Plan refined (`/soloflow:planner`) | `## Direction` comment on the issue + `ready` label |
| Sprint task executed (`/soloflow:sprint`) | Branch + PR with `Closes #<N>` |
| Code review findings | Comments on the PR or issue |
| Compound follow-ups (`/soloflow:compound`) | New GitHub Issues for future work |

---

## Post-phase GitHub sync

SoloFlow agents write to local `.soloflow/` files by default. After
each phase completes, the agent running that phase MUST sync the
output to GitHub as described below. These are not optional — they
are how the project maintains an accurate issue history.

### After idea extraction

After `/soloflow:idea-extractor` writes the local idea file to
`.soloflow/active/ideas/IDEA-NNN.md`, sync to GitHub:

**Step 1 — Search for an existing issue.**

```bash
gh issue list --repo counterfactual-consulting/counterfactual \
  --state open --limit 30 \
  --json number,title,labels,body \
  --jq '.[] | "\(.number)\t\(.title)"'
```

Review the titles and determine whether the idea overlaps with an
existing open issue. Use keyword matching — if the idea is about
the power module, look for issues mentioning "power"; if it's a bug
in the orchestrator, look for orchestrator issues. When uncertain,
search more specifically:

```bash
gh issue list --repo counterfactual-consulting/counterfactual \
  --state open --search "<key terms from the idea>" \
  --json number,title,body
```

**Step 2a — If a matching issue exists,** comment on it with the
idea details. Include the SoloFlow idea ID for traceability:

```bash
gh issue comment <N> --repo counterfactual-consulting/counterfactual \
  --body "## SoloFlow idea: IDEA-NNN

<one-paragraph summary of the idea>

**Type:** <bug|feature|improvement>
**Modules affected:** <list>
**Open questions:** <any from the idea file>

_Captured via SoloFlow idea-extractor. Local ref: .soloflow/active/ideas/IDEA-NNN.md_"
```

Record the issue number in the idea file's frontmatter by adding a
line: `github_issue: <N>`.

**Step 2b — If no matching issue exists,** create a new one. Use
the appropriate template structure from
`counterfactual/.github/ISSUE_TEMPLATE/`:

```bash
# For bugs
gh issue create --repo counterfactual-consulting/counterfactual \
  --title "fix(<module>): <short description>" \
  --label bug \
  --body "## Description

<description from idea>

## Steps to reproduce

<if applicable, from idea context>

## Expected behavior

<from idea>

## Actual behavior

<from idea>

_Captured via SoloFlow idea-extractor. Local ref: .soloflow/active/ideas/IDEA-NNN.md_"

# For features / enhancements
gh issue create --repo counterfactual-consulting/counterfactual \
  --title "feat(<module>): <short description>" \
  --label enhancement \
  --body "## Problem

<problem statement from idea>

## Proposed solution

<solution from idea>

## Alternatives considered

<if any from idea>

## Additional context

<research findings, references>

_Captured via SoloFlow idea-extractor. Local ref: .soloflow/active/ideas/IDEA-NNN.md_"
```

After creation, record the new issue number in the idea file's
frontmatter: `github_issue: <N>`.

### After planning / task refinement

After `/soloflow:planner` writes task plans to
`.soloflow/active/plans/TASK-NNN-plan.md`, sync each task to its
GitHub issue:

**Step 1 — Find the linked issue.** Read the source idea file
(referenced in the plan's frontmatter under `source_idea`) and get
the `github_issue` number. If the idea file has no `github_issue`
field, search GitHub using the procedure from "After idea extraction"
Step 1 and create an issue if needed.

**Step 2 — Post a Direction comment.** This is the format
counterfactual's workflow expects (see CONTRIBUTING.md § "Discover
work" — agents look for `## Direction` comments as their spec):

```bash
gh issue comment <N> --repo counterfactual-consulting/counterfactual \
  --body "## Direction

### What to change
<summary of the plan — what and why>

### Files involved
<list of files from the plan's file_ownership>

### Acceptance criteria
<from the plan's acceptance_criteria>

### Test strategy
<from the plan's test_strategy>

### Dependencies
<any task dependencies or sequencing notes>

_Plan ref: TASK-NNN via SoloFlow planner_"
```

**Step 3 — Add the `ready` label** so the executor (and
counterfactual's existing workflow) can discover it:

```bash
gh issue edit <N> --repo counterfactual-consulting/counterfactual \
  --add-label ready
```

**Step 4 — Record the link.** Add `github_issue: <N>` to the task
plan's frontmatter if not already present.

### During sprint execution

SoloFlow's executor must follow the per-issue workflow and label
protocol defined in `counterfactual/CONTRIBUTING.md` § "AI agent
workflow". The key requirements:

1. Work from the `counterfactual/` directory
2. Run `bash setup.sh && make check` before any changes
3. Follow label transitions: `ready` → `in-progress` → `has-pr`
   (see CONTRIBUTING.md § "Label protocol")
4. Create branches named `issue-<N>-<short-slug>`
   (see CONTRIBUTING.md § "Branching and PR workflow")
5. Spawn an independent review agent before committing
   (see CONTRIBUTING.md § "Per-issue workflow", step 6)

The executor MUST read the task plan's `github_issue` field at the
start of each task. This issue number drives branch naming, label
transitions, and the PR reference.

### At sprint close / PR creation

When the sprint closer opens a PR, it MUST reference every GitHub
issue addressed during the sprint. For each completed task:

1. Read the task plan from `.soloflow/active/plans/TASK-NNN-plan.md`
   (or the archived version in `.soloflow/archive/done/`).
2. Get the `github_issue` number from the plan's frontmatter.
3. Include `Closes #<N>` in the PR body for each issue.

PR body format:

```
## Summary

- <one line per task summarizing what changed and why>

## Issues addressed

Closes #<N1>
Closes #<N2>
...

## Test plan

- [ ] `make check` passes
- [ ] <task-specific verification>

_Sprint ref: SPRINT-NNN via SoloFlow_
```

After PR creation, transition labels for each issue:

```bash
gh issue edit <N> --repo counterfactual-consulting/counterfactual \
  --remove-label in-progress --add-label has-pr
```

And comment on each issue with a link to the PR:

```bash
gh issue comment <N> --repo counterfactual-consulting/counterfactual \
  --body "PR opened: <PR-URL>"
```

### After compound

`/soloflow:compound` produces a proposal with three buckets. Each
bucket has a different GitHub sync rule:

**Bucket A — Clean-ups (applied immediately).** These are small code
fixes applied in the current session. They stay local — they'll land
in the next PR as part of the sprint's changes. No GitHub Issue needed.

**Bucket B — Backlog tasks (future work).** After the user approves
items from this bucket, each one MUST be posted to GitHub as a new
issue. This is the same flow as idea extraction — search for an
existing issue first, create one if none matches:

```bash
# Search for overlap
gh issue list --repo counterfactual-consulting/counterfactual \
  --state open --search "<key terms>" \
  --json number,title

# If no match, create a new issue
gh issue create --repo counterfactual-consulting/counterfactual \
  --title "<type>(<module>): <description>" \
  --label <bug|enhancement|suggestion> \
  --body "## Problem

<what the compound finding identified>

## Proposed solution

<from the compound proposal>

## Context

Surfaced by SoloFlow compound review of SPRINT-NNN.
Finding source: <executor|code-reviewer|verifier>

_Compound ref: .soloflow/active/compound/<proposal-file>_"
```

Record the issue number in the backlog task entry. Do not leave
bucket B items only in `.soloflow/active/backlog.json` — if it's
worth tracking, it needs a GitHub Issue.

**Bucket C — CLAUDE.md / CODE-PATTERNS.md improvements (applied
immediately).** These are documentation edits applied in the current
session. They stay local and land in the next PR. No separate issue
needed.

**Design decisions needing review** — if any finding involves a
public API or orchestrator data schema change, do not apply it. Create
a GitHub Issue flagged for the maintainer instead (see
`counterfactual/CLAUDE.md` § "Key design invariants").

---

## Prioritization

When SoloFlow has multiple tasks ready, follow counterfactual's
priority order (see CONTRIBUTING.md § "Autonomous executor mode" →
"Prioritize"):

1. Dependencies first (issue A before issue B if B depends on A)
2. Bugs (`bug` label)
3. Important (`important` label)
4. Suggestions (`suggestion` label)
5. Enhancements (`enhancement` label)

## Scope discipline

Follow `counterfactual/CONTRIBUTING.md` § "Scope discipline":

- Stay within the `## Direction` comment on the issue
- Adjacent improvements go in the PR description, not the code
- If direction is ambiguous, stop and comment on the issue — do not
  guess
- If `make check` fails on `main` before starting, stop and report
- If a change exceeds ~300 lines, comment suggesting a split

## What agents must not do

Per `counterfactual/CONTRIBUTING.md` § "What agents must not do":

- Do not push directly to `main`
- Do not force-push or rewrite published history
- Do not merge without an independent review
- Do not merge with failing or pending CI checks (all matrix versions)
- Do not commit secrets, client data, or generated files
- Do not make public API or orchestrator data schema decisions without
  flagging for human review
- Do not make changes outside the scope of the issue being worked

---

## Context pressure

During sprints, never prompt on context pressure. Write the checkpoint,
compact, and continue automatically. Do not use AskUserQuestion for
context-critical decisions — always choose "Compact and continue."

---

## What stays local

- `.soloflow/` state files (backlog, sprint, checkpoint, plans)
- Agent coordination artifacts
- Intermediate drafts before GitHub sync

---

## Coding standards

All coding standards, design invariants, docstring conventions, testing
requirements, and commit message conventions are defined in
`counterfactual/CLAUDE.md` and `counterfactual/CONTRIBUTING.md`. Key
references:

- **Formatting:** Black, 88-char lines (`make format`)
- **Linting:** ruff + pydocstyle (`make lint`)
- **Docstrings:** NumPy-style with fenced-code Examples
- **Testing:** every public function tested, simulated data only
- **Verification:** `make check` (format + lint + test) must pass
- **Docs:** `make docs` must pass without warnings
- **Commits:** `fix(module):`, `feat(module):`, etc. with issue refs
- **Design reference:** `counterfactual/reference/CodeAndData.pdf`

Do not duplicate the full rules here — read those files.
