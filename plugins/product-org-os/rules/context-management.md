---
globs:
  - "**/*"
---

# Context Management Rules

The Context Layer provides organizational memory across sessions and agents.

## v3 Enhancements

1. **Auto-Context Injection** (`rules/auto-context.md`): Auto-injects relevant context before agents produce deliverables
2. **Cross-Reference Graph** (`rules/context-graph.md`): Connects decisions ↔ bets ↔ assumptions ↔ feedback ↔ learnings
3. **Structured JSON Indexes** (`context/index.json` v3.0): Multi-dimensional indexes for fast queries

---

## Core Behaviors

### Auto-Registration of Strategic Documents (MANDATORY)

ALL skill outputs producing strategic documents MUST be auto-registered silently to `context/documents/index.md` with metadata (ID: `DOC-[YYYY]-[NNN]`, title, type, skill, date, owner, product, location, tags). Cross-reference to related decisions/bets.

**Registrable skills**: All Phase 1-6 document-producing skills (see `rules/v2v-flow.md` for skill lists).

**Exclusions**: Assessments/checks, context operations, utility skills.

### After Creating Decisions or Bets

1. Auto-register the document
2. Run `/context-save` to add to decisions/bets index, extract assumptions, update portfolio

### Before Making Decisions

1. `/context-recall [topic]` — find related past decisions, active bets, assumptions, learnings
2. Incorporate relevant context; flag conflicts with past decisions

### Before Delegating to Another Agent

1. Run `/handoff` to create briefing → 2. Reference `@context/handoffs/current-session.md`

### When Encountering Feedback (MANDATORY)

ALL agents MUST capture feedback immediately via `/feedback-capture`: verbatim quotes, full metadata, analysis, categorization, connections to decisions/bets/assumptions.

### After Retrospectives and Outcome Reviews

1. Offer to save learnings with `/context-save`
2. Mark assumptions as validated/invalidated
3. Flag re-decision triggers if criteria are met

---

## Principle Enforcement Triggers

### When Creating Decisions

After `/decision-record` or `/strategic-bet`:
1. Suggest `/customer-value-trace` and `/collaboration-check`
2. Always offer `/context-save`

### When Making Commitments (Phase 2→3)

Before `/commitment-check`:
1. Require `/ownership-map` — verify end-to-end accountability
2. Verify Phase 1-2 deliverables exist
3. Validate assumptions are explicit and testable

**Run validators**: `/ownership-map`, `/customer-value-trace`, `/collaboration-check`, `/scale-check`

| Trigger | Validators |
|---------|-----------|
| Creating commitments | `/ownership-map`, `/commitment-check` |
| Making decisions | `/customer-value-trace`, `/collaboration-check` |
| Committing resources | `/scale-check` |
| Phase transitions | `/phase-check` |

### Pre-Work Checklists

**For Decisions/Bets** — Before: `/context-recall`, `/feedback-recall`, identify V2V phase. After: verify customer value trace, stakeholder consultation, explicit assumptions.

**For Commitments** — Before: Phase 1-2 complete, single accountable owner. After: `/commitment-check`, `/ownership-map`.

**For Outcome Reviews** — Before: retrieve original assumptions + success criteria. After: distinguish outputs vs outcomes, update assumptions, capture learnings.

### When Reviewing Outcomes

1. Separate outputs from outcomes
2. Validate/invalidate assumptions
3. Extract and save learnings
4. Check re-decision triggers

---

## ROI Display (Deliverables Only)

Show ROI when a tangible deliverable is produced. Skip for Q&A, lookups, recalls, system ops.

Format: `⏱️ ~[X] hrs/min saved in [Y]s (vs. [brief manual equivalent])`

Calculation: Look up base time in `reference/roi-baselines.md` × complexity factor (Simple 0.5×, Standard 1.0×, Complex 1.5×, Enterprise 2.0×).

---

## Context File Locations

| Type | Index | Records |
|------|-------|---------|
| Documents | `context/documents/index.md` | (by path) |
| Decisions | `context/decisions/index.md` | `context/decisions/[YYYY]/` |
| Strategic Bets | `context/bets/index.md` | `context/bets/[YYYY]/` |
| Assumptions | `context/assumptions/registry.md` | (in registry) |
| Portfolio | `context/portfolio/active-bets.md` | (in file) |
| Learnings | `context/learnings/index.md` | (in index) |
| Handoffs | `context/handoffs/current-session.md` | (overwritten) |
| Feedback | `context/feedback/index.md` | `context/feedback/[YYYY]/` |
| Interactions | `context/interactions/index.json` | `context/interactions/[YYYY]/` |

## ID Conventions

Documents: `DOC-[YYYY]-[NNN]` | Decisions: `DR-[YYYY]-[NNN]` | Bets: `SB-[YYYY]-[NNN]` | Assumptions: `A-[NNN]` | Learnings: `L-[NNN]` | Feedback: `FB-[YYYY]-[NNN]` | Themes: `TH-[NNN]` | Interactions: `IX-[YYYY]-[NNNNN]`

## Multi-Product Organizations

Optional `product:` field for filtering. Single-product orgs ignore it. Use consistent product names. Filter with `product:AXIA` in recall commands. Records without product are cross-product.

---

## V2V Operating Principle

> "Organizational memory is a competitive advantage. Document decisions not for bureaucracy, but for learning velocity."
