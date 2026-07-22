---
name: td-project-workflow
description: Standard project layout (specs/ with INDEX + archive, docs/ for user documentation only, agents/ plans + a per-clone focus stack under agents/state/) and the spec→plan→develop workflow governed by the design and implement skills
metadata:
  type: feedback
---

# Project initialization & the spec → plan → develop workflow

## Project structure
Initialize every project with this layout:
- **This memory file** at the project root.
- **`specs/`** off the root — engineering work specs. Specs are **workflow
  artifacts, not user documentation**: they never live under `docs/`.
  - Specs live at `specs/[name]-spec.md`.
  - **`specs/INDEX.md`** — the active-work index (spec ↔ plan ↔ status).
  - **`specs/schemas/`** — machine-readable artifacts that accompany specs
    (JSON schemas, protocol definitions).
  - **`specs/archive/`** — completed specs.
- **`docs/`** off the root — **user-facing documentation only** (guide,
  reference). Authored in markdown; site builders import the markdown.
- **`agents/`** off the root.
  - Plans live at `agents/[name]-plan.md`; completed plans move to
    **`agents/archive/`**.
  - **`agents/state/[clone-id]/focus.md`** — the focus stack for *this working
    copy* (maintained by the **implement** skill), where `[clone-id]` is
    `<hostname>-<slugified-absolute-path>`. Plans are shared across clones;
    attention is not. Stack entries are one line each — a bare id plus its push
    date (`<entry>  YYYY-MM-DD`) — written only via the twilight focus CLI.
    Completion status lives in the plan's checkboxes — there is
    **no** separate completed-log. **Plans carry no focus of their own** — there
    are no per-plan `[name]-focus.md` files. Write only your own clone's file;
    never read or edit a sibling clone's.

## What a spec is (a.k.a. SRD / SRS)
A spec focuses on the **requirements and use cases** — the **why** and the **what**.
Structure:
- A **definition section** that defines the application, feature, or capability.
- **Feature subsections** that decompose aspects of the design or featureset, each
  complete with **enumerated use cases**.

## What a plan is
A plan is the specification converted into an **actionable work request**. It includes:
- A basic description of the work.
- The APIs, SDKs, or systems to be used.
- What should be **deliverable** once the work is complete.

Then a subsection for **each unit of work** (usually corresponding to one commit),
each containing three subsections of line items:
1. **TDD** — the tests written *before* coding starts. Passing all of these tests is
   part of the implicit acceptance criteria for the section.
2. **Coding** — the actual implementation items.
3. **Acceptance** — any explicit requirements beyond tests passing.

The entire document is **numbered in outline format** so every section and line item
has a unique identifier. The plan's checkboxes (`- [ ]` / `- [x]` / `- [~]`) are the
**source of truth for what's done** — the stack never records completion.

## Lifecycle — INDEX + archive
`specs/INDEX.md` lists **active work only**: one row per in-flight spec —
spec ↔ plan ↔ status (`draft` while spec/plan are being authored, `active` once
approved, `blocked` when stalled). Creating a spec adds its row. **Closing a plan
removes it**: when every unit in `agents/[name]-plan.md` is `- [x]`, move
`specs/[name]-spec.md` → `specs/archive/`, move `agents/[name]-plan.md` →
`agents/archive/`, and drop the INDEX row. The archived spec + plan pair
(checkboxes intact) is the durable record — never a separate completed-log.

## Work state — the focus stack (`agents/state/[clone-id]/focus.md`)
A LIFO of attention: top = what you're working now. Entries are one line each —
`<plan>:<outline-id>` for plan work, `[explore: <what>]` for unplanned work.
Interrupts push; completions pop; what surfaces is what you were doing. The stack
records **departures from plan order only** — the plan's checkboxes and
dependency ordering already say what's next, so an empty stack means "follow the
active plan."

**Plans carry no focus.** A plan's checkboxes own completion and its dependency
ordering says what is next, so "where I was in plan X" is always derivable — it is
that plan's first unchecked (`- [ ]`) or blocked (`- [~]`) item. Per-plan
`[name]-focus.md` files were retired 2026-07-09; a second copy of that state only
created a way for the two to disagree.

The stack is **homed per working copy** under `agents/state/[clone-id]/focus.md`,
where `[clone-id]` is `<hostname>-<slug>` and `<slug>` is the clone's absolute
path with the leading `/` dropped and every `/` replaced by `-` (e.g.
`proton-home-julian-code-cpp-cajeta-two`). Sibling clones routinely share one
`agents/` repo — they share plans and specs, but attention is per working copy,
and a single shared `focus.md` would be corrupted by concurrent agents. Each clone
writes only its own file. The **implement** skill governs this.

## Workflow
1. **Scoping new work** → first create a new spec and write it *with the developer*.
   Load the **design** skill — it governs the authoring of *both* the spec and
   the plan.
2. **Once the spec and plan are complete and approved** → load the **implement**
   skill. It drives the focus stack so the documents accurately store state, and
   state stays visible to the developer.
