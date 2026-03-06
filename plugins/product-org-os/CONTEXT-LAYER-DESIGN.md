# Context Layer Design

## Overview

The Context Layer provides **persistent memory** across sessions and agents. It enables:
- Decisions to be remembered and referenced
- Agents to share context when delegating work
- Portfolio state to be tracked over time
- Assumptions to be validated against outcomes
- **V2V phase tracking** for initiatives across the 6-phase flow
- **Principle adherence tracking** via the scorecard system

## Integration with V2V Operating System

The Context Layer is a core component of the V2V Operating System (v2.2.0):

| V2V Phase | Context Usage |
|-----------|---------------|
| Phase 1: Strategic Foundation | Store strategic intent, market analysis findings |
| Phase 2: Strategic Decisions | Record decisions, capture assumptions |
| Phase 3: Strategic Commitments | Track commitments, validate phase prerequisites |
| Phase 4: Coordinated Execution | Handoffs between agents, launch coordination |
| Phase 5: Business Outcomes | Value realization data, customer health |
| Phase 6: Learning Loop | Learnings, retrospectives, principle scorecards |

The context layer embodies the V2V learning loop: decisions lead to outcomes, outcomes validate assumptions, validated/invalidated assumptions become learnings, learnings improve future decisions.

---

## Folder Structure

```
product-org-plugin/
├── context/                          # Persistent state folder
│   ├── README.md                     # How to use context layer
│   ├── documents/                    # Strategic documents registry (AUTO-POPULATED)
│   │   └── index.md                  # All skill-generated documents
│   ├── decisions/                    # Decision registry
│   │   ├── index.md                  # Master list of all decisions
│   │   └── [YYYY]/                   # Organized by year
│   │       └── DR-YYYY-NNN.md        # Individual decision records
│   ├── bets/                         # Strategic bet registry
│   │   ├── index.md                  # Master list of all bets
│   │   └── [YYYY]/                   # Organized by year
│   │       └── SB-YYYY-NNN.md        # Individual strategic bets
│   ├── assumptions/                  # Assumption tracker
│   │   └── registry.md               # All assumptions with status
│   ├── portfolio/                    # Current state
│   │   └── active-bets.md            # What we're currently betting on (with V2V phase tracking)
│   ├── learnings/                    # Accumulated wisdom
│   │   └── index.md                  # Indexed learnings from retrospectives
│   ├── feedback/                     # Customer/market feedback
│   │   ├── index.md                  # Master list of all feedback
│   │   ├── themes.md                 # Recurring feedback patterns
│   │   └── [YYYY]/                   # Organized by year
│   │       └── FB-YYYY-NNN.md        # Individual feedback records
│   ├── principles/                   # Operating principles tracking
│   │   ├── README.md                 # Principles folder documentation
│   │   └── scorecard.md              # Periodic principle adherence assessment
│   └── handoffs/                     # Agent-to-agent context
│       └── current-session.md        # Active session context
├── skills/
│   └── context/                      # Context management skills
│       ├── context-save/SKILL.md
│       ├── context-recall/SKILL.md
│       ├── portfolio-status/SKILL.md
│       ├── handoff/SKILL.md
│       ├── relevant-learnings/SKILL.md
│       ├── feedback-capture/SKILL.md    # NEW in v2.2.0
│       └── feedback-recall/SKILL.md     # NEW in v2.2.0
└── rules/
    └── context-management.md         # NEW: Context governance rule
```

---

## New Skills

### 1. `/context-save` - Save to Context Registry

**Purpose**: After creating a decision record, strategic bet, or completing an outcome review, save key information to the context registry.

**When invoked**: Automatically suggested after `/decision-record`, `/strategic-bet`, `/retrospective`, `/outcome-review`

**What it does**:
1. Extracts key metadata (ID, owner, date, status, assumptions)
2. Updates the appropriate index file
3. Links related decisions/bets
4. Extracts assumptions to the assumption registry

---

### 2. `/context-recall` - Query Past Context

**Purpose**: Before making a new decision or formulating a bet, recall relevant past context.

**When invoked**: At the start of strategic work, or when an agent needs historical context

**What it does**:
1. Searches decision/bet indexes by topic keywords
2. Returns relevant past decisions with their rationale
3. Shows related assumptions and their validation status
4. Surfaces relevant learnings

**Example usage**:
```
/context-recall pricing
→ Returns all decisions/bets related to pricing, their outcomes, and learnings
```

---

### 3. `/portfolio-status` - Current State View

**Purpose**: Show the current state of all active strategic bets and major decisions.

**When invoked**: At the start of any strategic planning session, or when PLT needs overview

**What it does**:
1. Reads `context/portfolio/active-bets.md`
2. Shows status of each active bet (proposed/active/validated/invalidated)
3. Highlights upcoming re-decision checkpoints
4. Shows assumption validation status

---

### 4. `/handoff` - Agent Context Transfer

**Purpose**: When one agent delegates to another, capture and transfer context.

**When invoked**: Before any agent-to-agent delegation

**What it does**:
1. Captures current session context (what was discussed, decided, constraints)
2. Writes to `context/handoffs/current-session.md`
3. Receiving agent reads handoff file to inherit context

---

### 5. `/relevant-learnings` - Find Applicable Learnings

**Purpose**: Before starting work on a topic, find past learnings that may apply.

**When invoked**: At the start of any strategic or planning work

**What it does**:
1. Searches learnings index by topic keywords
2. Returns learnings with their confidence level and guidance
3. Links to source decisions/retrospectives

---

### 6. `/feedback-capture` - Capture Customer/Market Feedback

**Purpose**: Immediately capture and analyze feedback when encountered during work.

**When invoked**: Whenever feedback is encountered (customer quotes, feature requests, complaints, research findings)

**What it does**:
1. Records raw feedback verbatim
2. Captures complete metadata (source, date, channel, segment, version)
3. Analyzes sentiment, impact, and categorization
4. Links to related decisions, bets, and assumptions
5. Updates feedback index and theme tracking

---

### 7. `/feedback-recall` - Query Past Feedback

**Purpose**: Before work in an area, check what customers have said about it.

**When invoked**: At the start of feature planning, decision-making, or analysis

**What it does**:
1. Searches feedback index by topic, source, or theme
2. Returns relevant feedback with analysis
3. Identifies patterns and recurring themes

---

## Principles Scorecard

The Context Layer now includes **principle adherence tracking** via `context/principles/scorecard.md`.

### Purpose

Track organizational adherence to the 8 Operating Principles over time, enabling:
- Periodic assessment of principle application
- Identification of gaps and improvement areas
- Trend tracking (improving, stable, declining)
- Connection to validation skills (`/ownership-map`, `/customer-value-trace`, `/collaboration-check`, `/scale-check`)

### When to Update

1. After running `/decision-quality-audit`
2. After outcome reviews and retrospectives
3. Quarterly as part of organizational health assessment

### Scoring

Each principle is scored 1-5:
- **5**: Consistently exemplified across the organization
- **4**: Strong adherence with minor gaps
- **3**: Adequate adherence with improvement areas
- **2**: Inconsistent adherence, significant gaps
- **1**: Principle not effectively applied

---

## New Rule: Context Management

**File**: `rules/context-management.md`

**Applies to**: All paths

**Key behaviors**:
1. After creating a decision record → suggest `/context-save`
2. After creating a strategic bet → suggest `/context-save`
3. Before making similar decisions → run `/context-recall`
4. Before agent delegation → run `/handoff`
5. At start of strategic sessions → run `/portfolio-status`

---

## Index File Formats

### `context/decisions/index.md`

```markdown
# Decision Registry

| ID | Title | Date | Owner | Status | Tags |
|----|-------|------|-------|--------|------|
| DR-2026-001 | API Pricing Model | 2026-01-15 | @cpo | Accepted | pricing, api, monetization |
| DR-2026-002 | Market Expansion | 2026-01-18 | @vp-product | Proposed | growth, international |

## Quick Filters

### By Status
- **Accepted**: DR-2026-001
- **Proposed**: DR-2026-002

### By Tag
- **pricing**: DR-2026-001
- **growth**: DR-2026-002
```

### `context/assumptions/registry.md`

```markdown
# Assumption Registry

| ID | Assumption | Source | Confidence | Validation Method | Status | Validated Date |
|----|------------|--------|------------|-------------------|--------|----------------|
| A-001 | Enterprise buyers prefer annual contracts | SB-2026-001 | Medium | Customer interviews (n=20) | Validated | 2026-03-01 |
| A-002 | SMB segment has 30% price sensitivity | DR-2026-001 | Low | A/B pricing test | Pending | - |

## Pending Validation
- A-002: Due 2026-02-15, Owner: @bizops

## Recently Validated
- A-001: Confirmed with 85% preference rate
```

### `context/portfolio/active-bets.md`

```markdown
# Active Portfolio

*Last updated: 2026-01-21*

## Active Bets with V2V Phase Tracking

| Bet ID | Name | Current Phase | P1 | P2 | P3 | P4 | P5 | Status | Health |
|--------|------|---------------|----|----|----|----|----|----|--------|
| SB-2026-001 | Enterprise Expansion | Phase 4 | ✓ | ✓ | ✓ | In Progress | - | Active | 🟢 |
| SB-2026-002 | Platform API Launch | Phase 2 | ✓ | In Progress | - | - | - | Proposed | 🟡 |

**Phase Legend**: P1=Strategic Foundation, P2=Strategic Decisions, P3=Strategic Commitments, P4=Coordinated Execution, P5=Business Outcomes

## Active Bets Detail

### SB-2026-001: Enterprise Expansion
- **Status**: Active
- **V2V Phase**: 4 - Coordinated Execution
- **Owner**: @cpo
- **Next checkpoint**: 2026-02-15 (Early signal)
- **Key assumption at risk**: A-001 (Enterprise annual contracts)
- **Health**: 🟢 On track

### SB-2026-002: Platform API Launch
- **Status**: Proposed
- **V2V Phase**: 2 - Strategic Decisions
- **Owner**: @vp-product
- **Awaiting**: PLT approval
- **Dependencies**: DR-2026-001 (Pricing model)
- **Phase 2 Blockers**: Pricing strategy pending finalization
- **Health**: 🟡 Pending decision

## Upcoming Checkpoints

| Date | Bet | Checkpoint | Decision Needed | Phase Transition |
|------|-----|------------|-----------------|------------------|
| 2026-02-15 | SB-2026-001 | Early signal | Continue/Pivot/Stop | Phase 4 → 5? |
| 2026-03-01 | SB-2026-002 | Mid-point | Double down/Maintain/Wind down | Phase 2 → 3? |
```

### `context/handoffs/current-session.md`

```markdown
# Session Context Handoff

*Generated: 2026-01-21 14:30*

## Delegating Agent
@cpo

## Receiving Agent
@director-product-management

## Task Being Delegated
Develop detailed PRD for Feature X

## Context Inherited

### Active Strategic Bet
SB-2026-001: Enterprise Expansion

### Relevant Decisions
- DR-2026-001: API Pricing Model (Accepted)
  - Key constraint: Must support usage-based billing

### Constraints
- Timeline: Q2 launch required
- Budget: Engineering team of 4
- Dependencies: Billing system upgrade (in progress)

### Assumptions to Preserve
- A-001: Enterprise buyers prefer annual contracts
- A-002: SMB segment has 30% price sensitivity

### Prior Discussion Summary
CPO and PLT agreed that Feature X is critical path for SB-2026-001.
Must integrate with existing enterprise SSO.
Marketing wants beta program with 5 design partners.

## Expected Deliverable
Complete PRD following /prd template with emphasis on enterprise requirements.
```

---

## Integration with Existing Skills

### Modified Behavior for `/decision-record`

Add to end of instructions:
```markdown
## Context Integration

After generating the decision record:

1. Ask: "Should I save this to the decision registry? (`/context-save`)"
2. If yes, extract and save:
   - Decision ID, title, date, owner, status
   - Tags (auto-generated from content)
   - Assumptions (add to assumption registry)
   - Related decisions (link if mentioned)
3. Update `context/decisions/index.md`
```

### Modified Behavior for `/strategic-bet`

Add to end of instructions:
```markdown
## Context Integration

After generating the strategic bet:

1. Ask: "Should I save this to the portfolio? (`/context-save`)"
2. If yes, extract and save:
   - Bet ID, title, date, owner, status
   - All explicit assumptions → assumption registry
   - Add to `context/portfolio/active-bets.md` if status is Active
3. Update `context/bets/index.md`
```

### Modified Behavior for All Agents

Add to agent instructions:
```markdown
## Context Awareness

Before starting strategic work:

1. Run `/context-recall [topic]` to check for related past decisions
2. Run `/portfolio-status` to understand current strategic priorities
3. Reference relevant context in your deliverables

Before delegating to another agent:

1. Run `/handoff` to capture current context
2. Explicitly mention the handoff file in your delegation prompt
```

---

## How It All Works (Simple Explanation)

### The Problem Today

Imagine you're the CPO. On Monday, you work with Claude to make a pricing decision. You consider three options, weigh tradeoffs, and decide on usage-based pricing with a rationale.

Two weeks later, your PM asks Claude to write a PRD for a new feature. Claude has no idea about the pricing decision. The PM has to manually explain all the context, or the PRD might contradict the pricing strategy.

**Even worse**: Three months later, you revisit pricing. Claude doesn't remember why you chose usage-based pricing, what assumptions you made, or what would trigger a re-decision.

### The Solution: Context Layer

The Context Layer is like giving your AI product org a **shared memory**.

#### 1. Decisions Get Remembered

When you make a decision with `/decision-record`, it gets saved to a registry:
- The decision itself
- Why you made it
- What assumptions it's based on
- When to revisit it

Next time anyone asks about pricing, `/context-recall pricing` instantly surfaces that decision.

#### 2. Assumptions Get Tracked

Every strategic bet has assumptions. Today they live in documents that get forgotten.

With the Context Layer, assumptions are extracted to a central registry:
- "Enterprise buyers prefer annual contracts" - Confidence: Medium - Validation: Customer interviews
- Status: Pending → Validated → Invalidated

When an assumption is invalidated, you know which decisions need revisiting.

#### 3. Agents Share Context

When CPO delegates to Director PM:
- `/handoff` captures everything discussed
- Director PM "inherits" the context automatically
- No re-explanation needed

It's like passing a briefing document between team members.

#### 4. Portfolio State is Always Current

`/portfolio-status` shows:
- What bets are active
- What's coming up for re-decision
- Which assumptions are at risk
- Overall health of the portfolio

Any agent can query this to understand "what are we currently focused on?"

### The Simple Mental Model

Think of it as three things:

| Component | Analogy | Purpose |
|-----------|---------|---------|
| **Decision Registry** | Meeting minutes that everyone can search | "What did we decide about X?" |
| **Assumption Tracker** | Risk register for beliefs | "What are we betting on being true?" |
| **Handoff Protocol** | Briefing document for new team member | "Here's what you need to know" |

### Example Flow

```
Day 1: CPO Session
─────────────────────
User: @cpo Let's decide on our API pricing model
CPO: [Creates decision record with /decision-record]
CPO: Should I save this to context?
User: Yes
CPO: [Runs /context-save - extracts to registry]

Day 15: PM Session
─────────────────────
User: @product-manager Write a PRD for the API feature
PM: [Runs /context-recall api pricing]
PM: I found DR-2026-001 about API pricing. Key constraints:
    - Usage-based billing required
    - Enterprise tier at $X/call
    I'll incorporate these into the PRD.

Day 45: Outcome Review
─────────────────────
User: @bizops Let's review how the API pricing is performing
BizOps: [Runs /context-recall api pricing]
BizOps: Checking assumptions from DR-2026-001...
        - A-002 (30% SMB price sensitivity): Testing showed 45%
        - This assumption was INVALIDATED
        - Re-decision trigger met. Recommend revisiting DR-2026-001.
```

---

## Document Auto-Registration (v2.3.0 - NEW)

### Overview

All skill outputs that produce strategic documents are **automatically registered** to `context/documents/index.md`. This happens silently - no user prompting required.

### What Gets Registered

| V2V Phase | Skills That Trigger Auto-Registration |
|-----------|---------------------------------------|
| Phase 1 | `/strategic-intent`, `/vision-statement`, `/market-analysis`, `/competitive-landscape`, `/competitive-analysis`, `/market-segment` |
| Phase 2 | `/business-case`, `/business-plan`, `/pricing-strategy`, `/pricing-model`, `/positioning-statement`, `/decision-record`, `/strategic-bet`, `/decision-charter`, `/escalation-rule` |
| Phase 3 | `/product-roadmap`, `/roadmap-theme`, `/roadmap-item`, `/gtm-strategy`, `/gtm-brief`, `/launch-plan`, `/strategy-communication`, `/prd`, `/prd-outline`, `/feature-spec`, `/user-story` |
| Phase 4 | `/campaign-brief`, `/sales-enablement`, `/stakeholder-brief`, `/launch-readiness` |
| Phase 5 | `/onboarding-playbook`, `/value-realization-report`, `/customer-health-scorecard` |
| Phase 6 | `/qbr-deck`, `/outcome-review`, `/retrospective` |

### Exclusions

These skills do NOT trigger auto-registration:
- **Assessments/checks**: `/maturity-check`, `/pm-level-check`, `/phase-check`, `/commitment-check`, `/ownership-map`, `/customer-value-trace`, `/collaboration-check`, `/scale-check`
- **Context operations**: `/context-save`, `/context-recall`, `/portfolio-status`, `/handoff`, `/feedback-capture`, `/feedback-recall`
- **Utility**: `/setup`, `/present`

### Registration Data Captured

| Field | Source |
|-------|--------|
| ID | Auto-generated: `DOC-[YYYY]-[NNN]` |
| Title | Document H1 or filename |
| Type | Based on skill used |
| Skill | The skill that generated it |
| Date | Current date |
| Owner | From session context |
| Product | From context (if multi-product) |
| Location | File path where written |
| Tags | Auto-generated from content |

### Querying Documents

Documents can be found via:
- `/context-recall [topic]` - Searches documents as well as decisions/bets
- Reading `context/documents/index.md` directly
- Filtering by product: `/context-recall [topic] product:AXIA`

---

## Implementation Status (v2.3.0)

All context layer features are now implemented:

### ✅ Completed Features

| Phase | Feature | Status |
|-------|---------|--------|
| **Foundation** | `context/` folder structure | ✅ Complete |
| | `/context-save` skill | ✅ Complete |
| | `/context-recall` skill | ✅ Complete |
| | `rules/context-management.md` | ✅ Complete |
| **Portfolio** | `/portfolio-status` skill | ✅ Complete |
| | Index file templates | ✅ Complete |
| | V2V phase tracking columns | ✅ Complete |
| **Agent Integration** | `/handoff` skill | ✅ Complete |
| | Agent context awareness | ✅ Complete (all 13 agents) |
| | Decision/bet skills context integration | ✅ Complete |
| **Learning Loop** | `/retrospective` → learnings | ✅ Complete |
| | `/outcome-review` → assumptions | ✅ Complete |
| | `/relevant-learnings` skill | ✅ Complete |
| **Feedback System** | `/feedback-capture` skill | ✅ Complete |
| | `/feedback-recall` skill | ✅ Complete |
| | Feedback themes tracking | ✅ Complete |
| **Principles** | `context/principles/` folder | ✅ Complete |
| | Principles scorecard template | ✅ Complete |
| | Principle validator skills | ✅ Complete (5 skills) |
| **Documents (v2.3)** | `context/documents/` folder | ✅ Complete |
| | Auto-registration rules | ✅ Complete |
| | Document index template | ✅ Complete |

### Related Skills (v2.2.0)

The context layer integrates with these skills:

**Context Management** (7 skills):
- `/context-save`, `/context-recall`, `/portfolio-status`, `/handoff`, `/relevant-learnings`, `/feedback-capture`, `/feedback-recall`

**Principle Validators** (5 skills):
- `/ownership-map` (Principle #1), `/customer-value-trace` (Principle #3), `/collaboration-check` (Principle #6), `/scale-check` (Principle #8), `/phase-check` (V2V Flow)

---

## File Sizes & Maintenance

The context files are designed to stay manageable:

- **Index files**: Summary only (ID, title, tags) - stays small
- **Full records**: Stored separately by year - archived over time
- **Handoff file**: Overwritten each session - never grows
- **Assumption registry**: Grows slowly, can be archived annually

Recommendation: Annual archive of validated/invalidated items to `context/archive/[YYYY]/`

---

## v3 Enhancements

### Structured JSON Indexes (v3.0)

The context index (`context/index.json`) is expanded from a flat entry list to multi-dimensional indexes:

| Index | Purpose | Used By |
|-------|---------|---------|
| `topicIndex` | Keyword-based lookup | `/context-recall`, auto-context |
| `productIndex` | Multi-product filtering | All context skills with `product:` filter |
| `phaseIndex` | V2V phase-based queries | `/portfolio-status`, `/phase-check` |
| `statusIndex` | Status-based filtering (bets, assumptions) | `/portfolio-status` |
| `sourceIndex` | Feedback source tracking | `/feedback-recall` |
| `sentimentIndex` | Feedback sentiment analysis | `/feedback-recall` |

### Auto-Context Injection

Defined in `rules/auto-context.md`. Before agents produce deliverables, the system automatically queries the index for relevant context and injects it into the agent's working context. This eliminates the manual "remember to run `/context-recall` first" step.

### Cross-Reference Graph

Defined in `rules/context-graph.md`. Context entries link to each other:
- Decisions ↔ Bets (decision made in context of bet)
- Bets ↔ Assumptions (bet depends on assumption)
- Feedback ↔ Decisions (feedback informs decision)
- Learnings ↔ Decisions (learning from decision outcome)
- Documents ↔ Decisions/Bets (document supports or records)

The graph enables `/context-recall` to follow links one level deep, surfacing related context that keyword search alone would miss.

### Architecture

```
┌──────────────────────────────────────────────────┐
│  context/index.json (v3.0)                       │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │ Topic Index  │  │ Product Index│               │
│  │ (keywords)   │  │ (per-product)│               │
│  └──────┬──────┘  └──────┬───────┘               │
│         │                │                        │
│  ┌──────▼──────────────▼───────┐                 │
│  │     Entry Records            │                 │
│  │  (decisions, bets, feedback, │                 │
│  │   learnings, documents)      │                 │
│  └──────────────┬───────────────┘                 │
│                 │                                  │
│  ┌──────────────▼───────────────┐                 │
│  │   Cross-Reference Graph      │                 │
│  │  (bidirectional links)       │                 │
│  └──────────────────────────────┘                 │
└──────────────────────────────────────────────────┘
         │                    │
    Auto-Context         Graph Traversal
    Injection            in /context-recall
```
