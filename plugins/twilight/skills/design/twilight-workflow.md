---
name: twilight-workflow
description: The spec → plan → implement workflow with a durable focus stack, governed by the twilight design and implement skills. Document locations come from the project's .twilight config.
---

# The spec → plan → implement workflow

## Project structure
Locations are recorded in `.twilight` at the project root (defaults shown):

- **`specs/`** (`SPECS_DIR`) — engineering work specs, one per unit of work at
  `<name>-spec.md`, plus:
  - **`INDEX.md`** — the active-work index (spec ↔ plan ↔ status).
  - **`archive/`** — completed specs.
- **`agents/`** (`PLANS_DIR`) — plans at `<name>-plan.md`; completed plans move
  to its **`archive/`**.
- **`agents/state/`** (`STATE_DIR`) — the focus stack: `focus.md`,
  `focus-archive.md` (snapshots from resets), `focus.lock` (owning session).
  With `MULTI_CLONE=1`, state is keyed per working copy under
  `<STATE_DIR>/<clone-id>/`.

Stack entries are one line each — a bare id plus its push date
(`<entry>  YYYY-MM-DD`) — written only via the twilight focus CLI. Completion
status lives in the plan's checkboxes; there is **no** separate completed-log,
and plans carry no focus of their own.

## What a spec is (a.k.a. SRD / SRS)
A spec focuses on the **requirements and use cases** — the **why** and the **what**.
Structure:
- A **definition section** that defines the application, feature, or capability.
- **Feature subsections** that decompose aspects of the design or featureset, each
  complete with **enumerated use cases**.

## What a plan is
A plan is the specification converted into an **actionable work request**: a
description, the systems to be used, the deliverables, then dependency-ordered
units of work, each with **TDD**, **Coding**, and **Acceptance** line items as
checkboxes (`[ ]` open, `[x]` done, `[~]` blocked; `- <id> [ ]` and `- [ ] <id>`
forms both supported).

## The cycle
1. **design** skill: classify the ask (feature / increment / exploration); for
   features, author the spec collaboratively, get approval, then the plan, get
   approval, register in the INDEX.
2. **implement** skill: execute the plan test-first, driving the focus stack;
   pops are gated on checkbox evidence; the stack survives sessions and context
   resets — trust the files over memory.
3. When every unit is done: archive spec + plan, clear the INDEX row.
