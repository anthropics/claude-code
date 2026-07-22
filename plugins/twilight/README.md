# twilight

Makes specs, plans, and a durable **focus stack** first-order concepts in Claude
Code. When you ask for non-trivial work, the agent first writes a spec with you,
converts it to a test-first plan, and works the plan — while a file-based stack
tracks what is being worked and what to return to.

The stack is a continuity device. It guards against the two ways work-in-flight
gets lost: AI context resets (compaction, restarts, crashes) and human attention
shifts (tangents, blockers, days away). Files on disk, re-injected by hooks every
session and every prompt, outlive both.

## Concepts

| Concept | File | Holds |
|---------|------|-------|
| Spec | `specs/<name>-spec.md` | Requirements and use cases — the why and what |
| Plan | `agents/<name>-plan.md` | Outline-numbered TDD work units with checkboxes |
| Focus stack | `agents/state/focus.md` | LIFO of attention: what's being worked, what to resume |

Locations are configurable — see **Configuration** below.

Every work request is classified into a tier first: **feature** (new capability →
full spec + plan), **increment** (small change → plan line item), or
**exploration** (question → `[explore: …]` stack entry only). You can override the
classification.

Stack entries are one line — `<plan>:<outline-id>`, a whole `<plan>` (commit to
finishing it), or `[explore: <what>]` — stamped with their push date. The stack
records departures from plan order only; an empty stack means "follow the plan."
It survives any number of session starts and stops.

## Configuration — `.twilight`

A `KEY=VALUE` file at the project root, written by the design skill after
agreeing locations with you:

| Key | Meaning | Default |
|-----|---------|---------|
| `SPECS_DIR` | Specs and the INDEX | `specs` |
| `PLANS_DIR` | Plans | `agents` |
| `STATE_DIR` | Focus stack state | `<PLANS_DIR>/state` |
| `MULTI_CLONE` | `1` keys stacks per working copy (`<STATE_DIR>/<clone-id>/`) for git worktrees / multiple checkouts | `0` |

## Format contracts

The scripts parse these formats — keep to them:

- **File naming**: `<name>-spec.md` and `<name>-plan.md` in the configured dirs.
- **Plan checkboxes**: one line item per line, either `- <outline-id> [ ] <text>`
  or `- [ ] <outline-id> <text>`. States: `[ ]` open, `[x]` done, `[~]` blocked
  (nonstandard markdown — renders as text in most viewers).
- **INDEX rows**: any line naming `<name>-plan` and containing the word `active`
  marks that plan active; the default is a `| Spec | Plan | Status |` table.
- **Stack entries**: written only via the CLI; one line, entry + push date.

## What the hooks do

- **SessionStart** — injects the stack (with push dates), each active plan's next
  unchecked item, and lock status. A new session resumes where the last one
  stopped without being told.
- **UserPromptSubmit** — injects the top-of-stack on every prompt, so focus
  survives arbitrarily long conversations and compactions.
- Both are silent in repositories without the twilight structure, and never block.

A `focus.lock` marks the owning session; a second session in the same checkout is
warned and offered adopt / read-only / worktree.

## Commands

| Command | Does |
|---------|------|
| `/twilight:focus` | Show the stack, lock status, and each active plan's next item |
| `/twilight:focus-push <entry>` | Push a validated entry |
| `/twilight:focus-pop [--force]` | Pop the top entry — gated on the plan's checkboxes being `[x]`; refusals list the unmet items |
| `/twilight:focus-reset` | User-only: archive the stack (timestamped, to `focus-archive.md`) then clear it |

The agent never resets the stack on its own, and pops only on checkbox evidence —
not on its own claim of being done.

## Skills

- **design** — collaborative spec authoring (requirements + enumerated use cases),
  then an outline-numbered plan (TDD / Coding / Acceptance per unit), registered
  in `specs/INDEX.md`. Installs the bundled `td-project-workflow.md` governing
  memory at the project root on first use.
- **implement** — executes the plan test-first, drives the stack through the
  focus CLI, marks checkboxes, archives spec + plan when every unit closes.

## Install

From a local checkout of this repository:

```bash
claude --plugin-dir /path/to/claude-code/plugins/twilight
```

Or install via `/plugin` from a marketplace that includes this repository's
plugins. Requires `jq` and standard Unix tools.

## Privacy

Everything is local files in your repository (`specs/`, `agents/`) — no network,
no state outside the working copy.

## Tests

Requires [bats-core](https://github.com/bats-core/bats-core) and `jq`:

```bash
bats plugins/twilight/tests
```
