---
name: implement
description: Implement an approved spec + plan test-first, driving the project's focus stack so tangents and cross-plan jumps always pop back to where you were. The plan's checkboxes own completion. Use after the design skill once the plan is approved and coding begins.
---

# implement — execute plans test-first with a focus stack

Use this **after the spec and plan are approved** (authored by the **design** skill). It
turns `<PLANS_DIR>/<name>-plan.md` into working code while keeping the current focus
and the planned order of work visible and recoverable — across tangents and plan
switches. Directory locations come from the project's `.twilight` file (defaults:
specs in `specs/`, plans in `agents/`, state in `<plans>/state/`).

## The focus stack — `<STATE_DIR>/focus.md`

A LIFO of attention. Top = what you're working now; everything below is what you
were doing, in resume order. One line per entry:

```
<plan>:<outline-id>      # a task in a plan, e.g. billing-refactor:5.3.2
<plan>                   # a whole plan: commit to completing it in its entirety
[explore: <what>]        # unplanned work outside any plan
```

**Bare ids only.** No task names, status, notes, or multi-line blocks — the plan
holds all detail; the id is the link back. If an entry seems to need a sentence,
promote it into the plan (so it has an id) and stack the id. The CLI stamps each
entry with its push date (`<entry>  YYYY-MM-DD`) so anyone reading the stack can
judge freshness.

**All stack operations go through the CLI** — never edit `focus.md` by hand:

```
bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" show|push|pop|gate|reset|lock ...
```

**The stack records departures from plan order only.** The plan itself records the
order: units are dependency-ordered and checkboxes mark progress, so "what's next
in plan X" is always its first unchecked item. Never copy plan order onto the
stack. An empty stack means: follow the active plan.

**One stack per project by default.** The stack is durable — it survives session
stops, starts, crashes, and context compaction, guiding both developer and agent
back to the work regardless of what either remembers.

**Parallel working copies are opt-in.** If the user wants to work the same
project from multiple checkouts or git worktrees, set `MULTI_CLONE=1` in
`.twilight`: stacks are then keyed per working copy
(`<STATE_DIR>/<clone-id>/focus.md`, clone-id = hostname + absolute path), so each
copy carries its own attention. Do not enable this without a user request.

## Rules of motion
- **Start or resume a plan** → nothing to load. Work the plan's first unchecked
  (`[ ]`) or blocked (`[~]`) item.
- **Interrupt** (tangent, blocker, higher-priority item) → push it, work it, pop
  back. Plan work pushes `<plan>:<id>`; free exploration pushes `[explore: <what>]`.
- **Pop** when the pushed work is done. What surfaces is what you were doing.

Example, three deep:

```
[explore: net buffer sizing]   ← working now
billing-net:2.3                ← pushed when the tangent hit
billing-ifx:4.1                ← resume here when the rest pops
```

## Working a task
Run it **test-first** (the plan's three line-item subsections):

1. **TDD** — write the task's tests *first*; they should fail for the right reason.
2. **Coding** — implement until all the task's tests pass.
3. **Acceptance** — verify every explicit Acceptance item, plus the implicit
   criterion that all tests pass.

### Completing a task
1. Mark the task's checkbox in the **plan doc** → `[x]`. *(Completion lives only here.)*
2. If the task was a pushed entry, **pop** it (through the gate — see Rules).

### Can't finish → mark blocked
1. Mark its checkbox `[~]` and note a reference to the blocker at the end of the
   task line.
2. Push the dependency (`<plan>:<id>` or `[explore: <what>]`), work it, then resume
   the blocked task when it clears.

### Offered options are recorded work
When you present next-step options, draw them from real state: the stack plus the
active plan's unchecked items. On the user's choice, work the picked one; add each
unchosen option to the plan (so it has an id) — an option left only in prose is an
option lost.

## Closing a plan (archive + INDEX)
When every unit in the plan is `[x]`:

1. Move the spec to the specs `archive/`.
2. Move the plan to the plans `archive/`.
3. Remove the spec's row from the INDEX (it lists active work only).

The archived spec + plan pair (checkboxes intact) is the durable record. Any
remaining stack entries for the plan are stale — a closed plan has none by
definition; if one exists, reconcile it before archiving.

## Rules
- **One line per entry, id only** — detail lives in the plan.
- **Departures only** — never mirror plan order onto the stack; empty stack =
  follow the plan.
- **Pops are gated on evidence** — run `twilight-focus.sh gate <entry>` before any
  pop; it passes only when the entry's plan checkbox(es) are `[x]`. A refusal lists
  the unmet items: finish them or mark blocked. Only the user may `--force`.
- **Never reset** — clearing the stack is user-only (`/twilight:focus-reset`,
  which archives before clearing). The agent pushes and pops; it never wholesale-clears.
- **Respect the lock** — the SessionStart hook acquires `focus.lock` per session.
  If it reports another owner, do not write the stack: offer adopt, read-only, or
  (with `MULTI_CLONE=1`) a separate worktree with its own stack.
- **File-over-memory** — the stack file and plan checkboxes are the truth about
  what is being worked. When conversational recall disagrees with the files,
  the files win; re-read them rather than trusting the summary of a compacted
  context.
- **Never skip TDD** — a task is done only when its tests were written first and pass.
- **Keep the documents accurate** — if reality diverges from the plan, update the
  plan; update the spec if the *requirements* changed.
- **Report honestly** — show the real stack, failing tests, and blockers (`~`);
  never present unverified work as done.
