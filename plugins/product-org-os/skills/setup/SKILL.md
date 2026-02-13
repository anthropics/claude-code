---
name: setup
description: "Initialize the Product Org plugin - creates context folders and index files. Use when user says 'set up the plugin', 'initialize', or is starting fresh with Product Org OS."
argument-hint: (no arguments needed)
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: utility
compatibility: Requires Product Org OS v3+ context layer and rules
---

Initialize the **Product Org Plugin** for first-time use. This creates the context folder structure and all necessary index files in your current working directory.

## V2V Phase

**Cross-phase** - Setup is a prerequisite for all V2V work. Run once per project.

**Prerequisites**: None (this is the starting point)
**Outputs used by**: All skills that use the context layer

## What Gets Created

```
.claude/
└── rules/
    ├── agent-spawn-protocol.md   # Agent response & spawning protocol
    ├── mcp-integration.md        # MCP tool detection and graceful fallback
    ├── auto-context.md           # Auto-context injection before deliverables
    ├── context-graph.md          # Cross-reference graph for context entries
    └── delegation-protocol.md    # 4 agent delegation patterns
context/
├── README.md               # How to use the context layer
├── index.json              # Master index with structured indexes (v3.0)
├── decisions/
│   └── index.md            # Decision registry
├── bets/
│   └── index.md            # Strategic bet registry
├── assumptions/
│   └── registry.md         # Assumption tracker
├── portfolio/
│   └── active-bets.md      # Current portfolio state
├── learnings/
│   └── index.md            # Accumulated learnings
├── handoffs/
│   └── current-session.md  # Agent delegation context
├── feedback/
│   ├── index.md            # Feedback registry
│   └── themes.md           # Recurring patterns
├── documents/
│   └── registry.md         # Document registry for all strategic docs
├── roi/
│   ├── session-log.md      # Per-session ROI tracking
│   └── history/
│       └── README.md       # Monthly ROI aggregation
└── interactions/
    ├── index.json          # Interaction metadata & indexes
    └── current-session.md  # Rolling session summary
```

## When to Run

Run `/setup` once when you first install the plugin in a new project. The skill is idempotent - it won't overwrite existing files.

## Process

### 0. Pre-Flight Audit (MANDATORY — Run Before Any Writes)

Before creating or modifying anything, scan the workspace and build an inventory of what already exists. This makes `/setup` safe to run at any stage — fresh install, partial setup, or fully initialized.

**Scan these locations:**

| Category | Check | Items |
|----------|-------|-------|
| **Rules** | `.claude/rules/agent-spawn-protocol.md`, `.claude/rules/mcp-integration.md`, `.claude/rules/auto-context.md`, `.claude/rules/context-graph.md`, `.claude/rules/delegation-protocol.md` | 5 files |
| **Directories** | `context/`, `context/decisions/`, `context/bets/`, `context/assumptions/`, `context/portfolio/`, `context/learnings/`, `context/handoffs/`, `context/feedback/`, `context/documents/`, `context/roi/`, `context/roi/history/`, `context/interactions/` | 12 dirs |
| **Index files** | `context/README.md`, `context/decisions/index.md`, `context/bets/index.md`, `context/assumptions/registry.md`, `context/portfolio/active-bets.md`, `context/learnings/index.md`, `context/handoffs/current-session.md`, `context/feedback/index.md`, `context/feedback/themes.md`, `context/documents/registry.md` | 10 files |
| **ROI files** | `context/roi/session-log.md`, `context/roi/history/README.md` | 2 files |
| **Interaction files** | `context/interactions/index.json`, `context/interactions/current-session.md` | 2 files |
| **JSON index** | `context/index.json` | 1 file |

**Build a status report:**

```
Pre-flight audit:
  Rules:       [0/5] or [X/5]
  Directories: [X/12]
  Index files: [X/10]
  ROI files:   [X/2]
  Interaction: [X/2]
  JSON index:  [0/1] or [1/1]
  ─────────────────────────────
  Total:       [X/32] already exist
```

**Decision logic:**
- If **32/32** exist → Skip to Step 6 (welcome) and report "Already fully initialized"
- If **0/32** exist → Fresh install, run all steps
- If **1-31/32** exist → Partial setup, create only what's missing (never overwrite)

Display the audit result to the user before proceeding.

### 1. Check Current Directory

Confirm the user's working directory is where they want the context layer created.

### 2. Create Directory Structure

Create **only missing** directories (skip any that already exist):
- `context/`
- `context/decisions/`
- `context/bets/`
- `context/assumptions/`
- `context/portfolio/`
- `context/learnings/`
- `context/handoffs/`
- `context/feedback/`
- `context/documents/`
- `context/roi/`
- `context/roi/history/`
- `context/interactions/`

Use `mkdir -p` (or equivalent) which is inherently safe for existing directories.

### 3. Create Index Files

Create each index file with its initial template. **Only create files that don't already exist** — never overwrite:

#### context/README.md
```markdown
# Context Layer

The Context Layer provides **persistent memory** for your AI product organization. It enables decisions to be remembered, agents to share context, and the organization to learn from outcomes.

## Quick Commands

| Command | Purpose |
|---------|---------|
| `/context-save` | Save decision, bet, or learning |
| `/context-recall [topic]` | Query past decisions/context |
| `/portfolio-status` | View current strategic bets |
| `/handoff` | Capture context for delegation |
| `/relevant-learnings [topic]` | Find applicable past learnings |
| `/feedback-capture` | Capture and analyze feedback |
| `/feedback-recall [topic]` | Query past feedback |
| `/interaction-recall [topic]` | Query past conversations |

## Folder Structure

- `decisions/` - Decision records with rationale
- `bets/` - Strategic bets with assumptions
- `assumptions/` - Tracked assumptions for validation
- `portfolio/` - Current active portfolio state
- `learnings/` - Accumulated organizational wisdom
- `handoffs/` - Agent-to-agent context passing
- `feedback/` - Customer and market feedback
- `documents/` - Registry of all strategic documents
- `interactions/` - Conversation history and session summaries

## How It Works

1. After decisions/bets: `/context-save` extracts to registry
2. Before new work: `/context-recall` finds related context
3. For delegation: `/handoff` briefs receiving agent
4. For feedback: `/feedback-capture` documents with analysis
5. After outcomes: Reviews update assumptions and extract learnings
```

#### context/decisions/index.md
```markdown
# Decision Registry

*Last updated: —*

## All Decisions

| ID | Title | Date | Owner | Status | Tags |
|----|-------|------|-------|--------|------|
| — | No decisions recorded yet | — | — | — | — |

## Quick Filters

### By Status
- **Accepted**: —
- **Proposed**: —
- **Superseded**: —

### By Tag
*Tags will appear here as decisions are added*

---

Use `/context-save` after creating a decision record to add it here.
```

#### context/bets/index.md
```markdown
# Strategic Bet Registry

*Last updated: —*

## All Strategic Bets

| ID | Title | Date | Owner | Status | Key Assumption |
|----|-------|------|-------|--------|----------------|
| — | No bets recorded yet | — | — | — | — |

## Quick Filters

### By Status
- **Active**: —
- **Completed**: —
- **Abandoned**: —

### By Owner
*Owners will appear here as bets are added*

---

Use `/context-save` after creating a strategic bet to add it here.
```

#### context/assumptions/registry.md
```markdown
# Assumption Registry

*Last updated: —*

## All Tracked Assumptions

| ID | Assumption | Source | Confidence | Validation Method | Status | Outcome |
|----|------------|--------|------------|-------------------|--------|---------|
| — | No assumptions tracked yet | — | — | — | — | — |

## By Status

### Pending Validation
*Assumptions awaiting validation*

### Validated
*Assumptions confirmed true*

### Invalidated
*Assumptions proven false - may trigger re-decisions*

---

Assumptions are extracted automatically when saving decisions and bets with `/context-save`.
```

#### context/portfolio/active-bets.md
```markdown
# Active Portfolio

*Last updated: —*

## Current Strategic Bets

No active bets. Use `/strategic-bet` to create one, then `/context-save` to add it here.

## Portfolio Health

| Metric | Status |
|--------|--------|
| Active Bets | 0 |
| At-Risk Assumptions | — |
| Upcoming Checkpoints | — |

## Next Checkpoints

*Checkpoint dates will appear here as bets are added*
```

#### context/learnings/index.md
```markdown
# Learnings Index

*Last updated: —*

## All Learnings

| ID | Learning | Source | Date | Tags | Confidence |
|----|----------|--------|------|------|------------|
| — | No learnings recorded yet | — | — | — | — |

## By Category

### Strategy
*Strategic learnings*

### Product
*Product development learnings*

### GTM
*Go-to-market learnings*

### Customer
*Customer-related learnings*

### Process
*Operational learnings*

---

Learnings are extracted from retrospectives and outcome reviews via `/context-save`.
```

#### context/handoffs/current-session.md
```markdown
# Current Session Handoff

*No active handoff context*

Use `/handoff` to capture context when delegating work to another agent.
```

#### context/feedback/index.md
```markdown
# Feedback Registry

*Last updated: —*

## All Captured Feedback

| ID | Date | Source Type | Source | Topic | Sentiment | Linked To |
|----|------|-------------|--------|-------|-----------|-----------|
| — | No feedback captured yet | — | — | — | — | — |

## Quick Filters

### By Source Type
- **Customer**: —
- **Prospect**: —
- **Sales**: —
- **Support**: —
- **Research**: —
- **Internal**: —

### By Sentiment
- **Positive**: —
- **Negative**: —
- **Neutral**: —
- **Mixed**: —

### By Topic
*Topics will appear here as feedback is captured*

---

Use `/feedback-capture` whenever you encounter customer or market feedback.
```

#### context/feedback/themes.md
```markdown
# Feedback Themes

*Last updated: —*

## Established Themes
*Patterns with 3+ supporting feedback entries*

No established themes yet.

## Emerging Themes
*Patterns with 2 supporting entries - watching*

No emerging themes yet.

## Addressed Themes
*Themes that have been resolved*

None yet.

---

Themes are identified automatically when related feedback accumulates.
```

#### context/documents/registry.md
```markdown
# Document Registry

*Last updated: —*

The Document Registry tracks all strategic documents created by skills. This enables Document Intelligence - skills can find and update existing documents rather than always creating new ones.

## All Documents

| ID | Type | Title | Path | Status | V2V Phase | Related | Updated |
|----|------|-------|------|--------|-----------|---------|---------|
| — | No documents registered yet | — | — | — | — | — | — |

## By Type

### Requirements (PRDs, Specs, Stories)
*No documents yet*

### Strategy (Intent, Bets, Decisions)
*No documents yet*

### Roadmap (Themes, Items)
*No documents yet*

### GTM (Strategy, Launch Plans, Campaigns)
*No documents yet*

### Business (Cases, Pricing, Analysis)
*No documents yet*

### Operational (Playbooks, Reports, Scorecards)
*No documents yet*

### Learning (Reviews, Retrospectives)
*No documents yet*

## By Status

### Active
*Documents currently in use*

### Draft
*Work in progress*

### Archived
*Historical documents*

## Registered Directories

*Directories containing strategic documents (searched when finding documents)*

| Directory | Contains | Notes |
|-----------|----------|-------|
| — | No directories registered yet | — |

---

## How It Works

1. **When skills create documents**: They register here with ID, type, path
2. **When skills update documents**: They search here first by type/topic
3. **When skills find documents**: They list matching entries from this registry

### Document ID Conventions

| Type | Format | Example |
|------|--------|---------|
| PRD | `PRD-[YYYY]-[NNN]` | PRD-2026-001 |
| Decision | `DR-[YYYY]-[NNN]` | DR-2026-015 |
| Strategic Bet | `SB-[YYYY]-[NNN]` | SB-2026-003 |
| Roadmap Theme | `RT-[YYYY]-[NNN]` | RT-2026-002 |
| Launch Plan | `LP-[YYYY]-[NNN]` | LP-2026-001 |

Skills auto-generate IDs when creating documents.
```

### 3b. Create Agent Spawn Protocol Rule

Create `.claude/rules/agent-spawn-protocol.md` if it doesn't already exist.

This rule file ensures spawned agents follow the Product Org response protocol (identity, conversational style, ROI display) even though they run in isolated contexts without access to `.claude/rules/`.

The file content is the canonical `agent-spawn-protocol.md` from the plugin's `rules/` folder. Copy it verbatim.

### 3c. Create v3 Rule Files

Create these rule files in `.claude/rules/` if they don't already exist:
- `.claude/rules/mcp-integration.md` — Copy from plugin's `rules/mcp-integration.md`
- `.claude/rules/auto-context.md` — Copy from plugin's `rules/auto-context.md`
- `.claude/rules/context-graph.md` — Copy from plugin's `rules/context-graph.md`
- `.claude/rules/delegation-protocol.md` — Copy from plugin's `rules/delegation-protocol.md`

### 4. Create ROI Tracking Structure

Create ROI tracking folders and files:
- `context/roi/session-log.md`
- `context/roi/history/README.md`

### 4b. Create Interaction Tracking Files

Create interaction log files:

#### context/interactions/index.json
```json
{
  "version": "1.0",
  "lastUpdated": "",
  "nextId": 1,
  "entries": [],
  "topicIndex": {},
  "agentIndex": {},
  "dateIndex": {}
}
```

#### context/interactions/current-session.md
```markdown
# Current Session

*No active session*

Use any agent (`@pm`, `@plt`) or skill (`/prd`, `/decision-record`) to start logging interactions.
```

### 5. Create JSON Index

Create `context/index.json` for fast topic-based retrieval:

```json
{
  "version": "3.0",
  "lastUpdated": "[current date]",
  "decisions": {
    "entries": [],
    "topicIndex": {},
    "productIndex": {},
    "phaseIndex": {}
  },
  "bets": {
    "entries": [],
    "topicIndex": {},
    "statusIndex": {}
  },
  "feedback": {
    "entries": [],
    "sourceIndex": {},
    "sentimentIndex": {},
    "topicIndex": {}
  },
  "documents": {
    "entries": [],
    "typeIndex": {},
    "phaseIndex": {}
  },
  "learnings": {
    "entries": [],
    "topicIndex": {}
  },
  "assumptions": {
    "entries": [],
    "statusIndex": {},
    "betIndex": {}
  },
  "crossReferences": {
    "decisionToBet": {},
    "betToAssumption": {},
    "feedbackToDecision": {},
    "learningToDecision": {},
    "documentToDecision": {},
    "documentToBet": {},
    "feedbackToTheme": {}
  }
}
```

### 6. First-Run Welcome

Display welcome message with exploration guidance:

```markdown
# Welcome to Product Org OS!

Your AI-powered product organization is ready. Works with Claude Code, Cursor, Copilot, and other Agent Skills-compatible tools.

---

## Explore with Demo Content

This plugin includes **demo content** so you can see how everything works:

| Demo Content | Description |
|--------------|-------------|
| 3 decisions | Pricing, API versioning, mobile-first |
| 2 strategic bets | Enterprise tier, self-serve growth |
| 7 feedback entries | Customer interviews, support, sales |
| 1 PRD | Dashboard redesign |

**Try these commands:**
```
/context-recall pricing        → See pricing-related decisions
/context-recall enterprise     → See enterprise strategy context
/portfolio-status              → View active strategic bets
/feedback-recall onboarding    → See onboarding feedback patterns
```

---

## Meet Your Team

Invoke agents for their perspective:

| Agent | Focus | Try |
|-------|-------|-----|
| `@pm` | Requirements, delivery | `@pm review the dashboard PRD` |
| `@vp-product` | Strategy, portfolio | `@vp-product our enterprise strategy` |
| `@plt` | Leadership decisions | `@plt should we prioritize enterprise or self-serve?` |

---

## Ready for Real Work?

Just start creating! Demo content **auto-filters** once you have production data:
- Your real decisions, bets, and feedback take precedence
- Demo content is automatically excluded from queries
- No need to run `/clear-demo` - it's optional

Demo content stays available for reference. Use `--include-demo` to see it alongside your data, or `/clear-demo` if you prefer a clean folder.

---

## Quick Reference

| Task | Command |
|------|---------|
| Create a PRD | `/prd [topic]` |
| Document a decision | `/decision-record [topic]` |
| Capture feedback | `/feedback-capture` |
| Check portfolio | `/portfolio-status` |
| Get PM perspective | `@pm [question]` |
| Leadership meeting | `@plt [question]` |

**Full documentation**: See `reference/v2v-skill-map.md` and `reference/agent-roster.md`
```

### 7. Report Completion

Use these markers to distinguish what happened:

- `✓` — Created (new)
- `·` — Already existed (skipped)

```
Product Org Plugin initialized successfully!

Context structure:
[✓/·] .claude/rules/agent-spawn-protocol.md
[✓/·] .claude/rules/mcp-integration.md
[✓/·] .claude/rules/auto-context.md
[✓/·] .claude/rules/context-graph.md
[✓/·] .claude/rules/delegation-protocol.md
[✓/·] context/README.md
[✓/·] context/decisions/index.md
[✓/·] context/bets/index.md
[✓/·] context/assumptions/registry.md
[✓/·] context/portfolio/active-bets.md
[✓/·] context/learnings/index.md
[✓/·] context/handoffs/current-session.md
[✓/·] context/feedback/index.md
[✓/·] context/feedback/themes.md
[✓/·] context/documents/registry.md
[✓/·] context/roi/session-log.md
[✓/·] context/roi/history/README.md
[✓/·] context/interactions/index.json
[✓/·] context/interactions/current-session.md
[✓/·] context/index.json

Created: X new | Skipped: Y existing
```

If everything already existed, show:
```
Product Org Plugin — already fully initialized.
All 32 items present. No changes made.
```

### 8. Interactive Onboarding Choice (MANDATORY)

After creating the files, use the **AskUserQuestion tool** to present this choice:

**Question**: "How would you like to get started?"

**Options**:
1. **Take the tour** (Recommended) - "Interactive 5-step walkthrough of gateways, agents, and skills with demo data"
2. **Explore on my own** - "Show me a quick reference and let me dive in"

---

### 9a. If User Chooses "Take the tour"

Walk through the 5-step interactive architecture tour. Each step introduces a concept, the user tries it, sees the result, then continues to the next step.

**Architecture Hierarchy**: Gateway → Agent → Skill → Document → Utility

---

```markdown
## 🚪 Step 1: Gateways (Entry Points)

Product Org OS has two main entry points that route requests to the right experts:

| Gateway | What It Does |
|---------|--------------|
| `@product` | Routes to relevant owners, coordinates execution |
| `@plt` (Product Leadership Team) | Gets multi-perspective input on decisions |

**Try this with the demo data:**
```
@plt Based on our enterprise strategy and customer feedback,
should we prioritize the dashboard redesign or API improvements?
```

This will spawn multiple agents who weigh in with their perspectives.
```

*Wait for user to run the command, then continue to Step 2...*

---

```markdown
## 👤 Step 2: Individual Agents (Expert Perspectives)

Beyond gateways, you can invoke specific agents directly for their expertise:

| Agent | Focus |
|-------|-------|
| `@pm` | Requirements, delivery, user stories |
| `@vp-product` | Strategy, portfolio, pricing |
| `@pmm` | Positioning, GTM, competitive |

**Try this:**
```
@pm Review the dashboard PRD and identify any gaps in the requirements.
```

The PM agent will analyze the demo PRD and give their perspective.
```

*Wait for user to run the command, then continue to Step 3...*

---

```markdown
## 🛠️ Step 3: Skills (Deliverable Creation)

Skills create production-ready deliverables following proven frameworks:

| Skill | Creates |
|-------|---------|
| `/prd` | Product Requirements Document |
| `/decision-record` | Structured decision with rationale |
| `/strategic-bet` | Bet with explicit assumptions |
| `/launch-plan` | Complete launch playbook |

**Try this:**
```
/decision-record Should we add webhook support to the API?
```

This creates a structured decision record you can fill in.
```

*Wait for user to run the command, then continue to Step 4...*

---

```markdown
## 📝 Step 4: Document Updates (Agent + Existing Doc)

Agents can work with existing documents in your codebase—not just create new ones.

**Try this:**
```
@pm Update the dashboard PRD to add acceptance criteria for the filtering feature.
```

The PM will read the existing PRD and add to it.
```

*Wait for user to run the command, then continue to Step 5...*

---

```markdown
## 🔧 Step 5: Utility Skills (Context Layer)

The context layer stores decisions, feedback, and learnings—organizational memory:

| Skill | Purpose |
|-------|---------|
| `/context-recall [topic]` | Find related decisions/context |
| `/feedback-recall [topic]` | Query customer feedback |
| `/portfolio-status` | View active strategic bets |
| `/clear-demo` | Remove demo data for production |

**Try this:**
```
/context-recall pricing
```

This shows how past decisions on pricing are retrieved.

### New in v3
| Feature | Description |
|---------|-------------|
| MCP Integrations | Agents auto-detect Jira, Slack, Analytics tools |
| Knowledge Packs | 9 PM framework references in `reference/knowledge/` |
| Cross-References | Context entries link to each other automatically |
```

*Wait for user to run the command, then show completion...*

---

```markdown
## 🎉 You're Ready!

You've seen the core patterns:

✓ **Gateways** for multi-perspective input (`@product`, `@plt`)
✓ **Agents** for expert perspectives (`@pm`, `@vp-product`)
✓ **Skills** for deliverable creation (`/prd`, `/decision-record`)
✓ **Document updates** with agents
✓ **Context layer** for organizational memory

---

### What's Next?

| Goal | Command |
|------|---------|
| Start using skills on YOUR product | `/prd [topic]` |
| Demo auto-filters | Once you have production data, demo is excluded |
| Include demo in queries | Use `--include-demo` flag |
| Clean up demo files (optional) | `/clear-demo` removes sample data |

**Quick reference:** See `reference/v2v-skill-map.md`
```

---

### 9b. If User Chooses "Explore on my own"

Show the quick reference and let them dive in:

```markdown
## 🚀 Quick Reference

### Entry Points
| Command | Use When |
|---------|----------|
| `@product [request]` | Need coordination across functions |
| `@plt [question]` | Strategic decision needs perspectives |
| `@pm [task]` | Requirements or delivery work |

### Common Skills
| Goal | Command |
|------|---------|
| Create a PRD | `/prd [topic]` |
| Document a decision | `/decision-record [topic]` |
| Define a strategic bet | `/strategic-bet [topic]` |
| Check past decisions | `/context-recall [topic]` |
| View portfolio | `/portfolio-status` |

### Demo Data
Sample data included—try: `/context-recall pricing`

Demo auto-filters when you have production data. Optional: `/clear-demo`

---

**Start with:** `@product [your question]` or `/prd [topic]`

Full documentation: `reference/v2v-skill-map.md`
```

---

## Instructions

1. **Run pre-flight audit** (Step 0) — scan all 32 items and display status
2. If fully initialized (32/32), report status and skip to onboarding choice
3. Ask user to confirm their working directory is correct
4. Create **only missing** folders using `mkdir -p` (Bash tool)
5. Create **only missing** files using Write tool — NEVER overwrite existing files
6. Report what was created vs. what was already present
7. **Use AskUserQuestion tool** to present the onboarding choice
8. Based on their choice, run either the guided demo tour (9a) or start-fresh flow (9b)

**Safety guarantee**: `/setup` is safe to run at any stage. It will never overwrite user data, never duplicate existing files, and will only fill gaps in an incomplete setup.
