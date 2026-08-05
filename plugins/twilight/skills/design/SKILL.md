---
name: design
description: Author or revise a spec (<specs>/<name>-spec.md) and its plan (<plans>/<name>-plan.md) when scoping new work — requirements + enumerated use cases in the spec, an outline-numbered TDD work plan in the plan, registered in the INDEX. Use when starting a new application, feature, or capability. Governs both documents.
---

# design — author the spec and the plan

Use this when **scoping new work**. It governs the authoring of **both** documents:

- the **spec** — the *why* and the *what* (requirements + use cases), and
- the **plan** — the actionable *how* (an outline-numbered, TDD-structured work request).

Work **collaboratively with the developer**: ask questions, propose options with a
recommendation, iterate, and get explicit approval. Do not write the whole thing in
one pass and assume sign-off.

## Proportionality tiers — classify before any documents

Not every ask deserves a spec. On any work request, classify it into a tier,
**state the classification before proceeding**, and follow the user's override if
they disagree:

| Tier | When | Artifacts |
|------|------|-----------|
| **feature** | New application, feature, or capability | Full spec + plan via this skill |
| **increment** | Small change within existing planned work | New line item(s) in the governing plan, then implement |
| **exploration** | Question, investigation, throwaway | `[explore: <what>]` focus-stack entry only — no documents |

Only the **feature** tier continues into the rest of this skill.

## 0. Establish the project structure — with the user, not for them

On first use in a project, **negotiate where the documents live**. Propose the
defaults, let the user decide, and record the choices in a `.twilight` file at
the project root (KEY=VALUE lines):

| Key | Meaning | Default |
|-----|---------|---------|
| `SPECS_DIR` | Specs and the INDEX | `specs` |
| `PLANS_DIR` | Plans | `agents` |
| `STATE_DIR` | Focus stack state | `<PLANS_DIR>/state` |
| `MULTI_CLONE` | Per-working-copy stacks (see implement skill) | `0` |

Then create (inside the chosen directories): `INDEX.md` (active-work index),
an `archive/` under each of specs and plans for completed work, and install the
bundled governing memory `twilight-workflow.md` at the project root.

**Ask before touching `CLAUDE.md`.** Making the governing memory always-loaded
requires an import line (`@twilight-workflow.md`) in the project's `CLAUDE.md` —
propose that edit and apply it **only with the user's explicit approval**. If
declined, the workflow still functions; the memory is simply loaded on demand.

(The bundled file lives at `${CLAUDE_PLUGIN_ROOT}/skills/design/twilight-workflow.md`.)

## 1. Write the spec → `<SPECS_DIR>/<name>-spec.md`

**Register it immediately**: add a row to the INDEX with status `draft`
(create the file with a `| Spec | Plan | Status |` table if missing). The INDEX
lists **active work only** — the **implement** skill removes the row and archives
the documents when the plan closes.

A spec (a.k.a. SRD / SRS) focuses on **requirements and use cases — the why and the
what**, never the implementation. Outline-number every section and item so each is
uniquely addressable (1, 1.1, 1.1.1, …).

1. **Definition** — define the application / feature / capability: its purpose and
   scope, the problem it solves, constraints, and explicit non-goals.
2. **Feature subsections** (`2`, `3`, …) — one per decomposed aspect of the design or
   featureset. Each subsection states that aspect's requirements and lists
   **enumerated use cases** (`2.1`, `2.2`, …). Write each use case concretely:
   actor + trigger + expected outcome ("as a X, when Y, then Z").

Drive it as a conversation — surface open questions and trade-offs, recommend, and
converge. **Do not start the plan until the spec is approved.**

## 2. Write the plan → `<PLANS_DIR>/<name>-plan.md`

The plan converts the approved spec into an **actionable work request**. Lead with:

- **Description** — a basic description of the work.
- **Systems** — the APIs, SDKs, or systems to be used.
- **Deliverables** — what is delivered once the work is complete.

Then a subsection for **each unit of work**. Every unit has exactly three
line-item subsections:

- **TDD** — the tests to write *before* any code. Passing all of them is the implicit
  acceptance criterion for the unit.
- **Coding** — the implementation items.
- **Acceptance** — explicit requirements beyond tests passing.

Outline-number the whole document so every section and line item is uniquely
identifiable (e.g. `3.2.1` = unit 3, TDD, item 1). Trace each unit back to the spec
use case(s) it satisfies.

Render each line item as a **markdown checkbox** so the **implement** skill can
track progress — `- <id> [ ]` and `- [ ] <id>` are both supported; implement marks
`[x]` when done and `[~]` when blocked. Because implement works units in plan order
("next" is always the first unchecked item), **order the units by dependency**: any
unit that depends on another must come after it.

## 3. Approval and hand-off

Both documents are drafts until the developer approves them. On approval, flip the
spec's row in the INDEX from `draft` to `active` and hand off to the
**implement** skill to build the plan.
