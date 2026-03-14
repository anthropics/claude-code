---
name: tour
description: "Interactive walkthrough of Product Org OS - learn how agents, gateways, skills, and context work together. Use when user says 'show me around', 'how does this work', 'give me a tour', or is new to Product Org OS."
argument-hint: (no arguments needed)
model: haiku
allowed-tools:
  - Read
  - Glob
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: utility
compatibility: Requires Product Org OS v3+ context layer and rules
---

# Product Org OS Tour

Interactive 5-step walkthrough that teaches the system through hands-on exploration with demo data. Shows the real patterns you'll use daily.

## Phase

**Cross-phase** - Onboarding and education skill.

## When to Use

- First-time users learning how to work with the product org
- Returning users wanting a refresher
- Demonstrating the system to colleagues
- After running `/reset-demo` to explore with sample data

## Prerequisites

- Context layer should exist (`context/` folder)
- Demo data recommended (run `/reset-demo` if cleared)

## Process

### 1. Check Prerequisites

Verify context layer exists:
- If `context/` folder missing: Suggest running `/setup` first
- If `context/demo/` empty: Note that demo data is missing, suggest `/reset-demo`
- Otherwise: Proceed with tour

### 2. Welcome

```markdown
## Product Org OS Tour

Welcome! This tour teaches you how to work with your AI product organization through 5 hands-on steps:

**Agent + File → Gateway → Context → Skills → Framework**

Each step shows a real pattern you'll use. Try the commands and see results before continuing.

Demo data **auto-filters** once you have production data—no cleanup needed.

---

Let's start with **Step 1: Delegating Work to Agents**...
```

### 3. Step 1: Agent + File (The Core Pattern)

```markdown
## Step 1: Delegating Work to Agents

The most common pattern: invoke an agent with context files.

| Agent | Focus |
|-------|-------|
| `@pm` | Requirements, PRDs, user stories, delivery |
| `@pmm` | Positioning, GTM, competitive analysis |
| `@vp-product` | Strategy, portfolio, pricing |

**Try this:**
```
@pm @context/demo/feedback/FB-DEMO-001-sso-requirement.md @context/demo/feedback/FB-DEMO-007-api-webhooks.md create a PRD for enterprise API integrations
```

**What happens:**
1. The PM agent reads your feedback files for context
2. Uses the `/prd` skill internally to structure the work
3. Delivers a production-ready PRD grounded in customer feedback

**Key insight:** You delegate the *outcome*—the agent chooses the *method*. Agents use skills like `/prd`, `/user-story`, and `/feature-spec` internally.
```

*Wait for user to run the command, then continue to Step 2...*

---

### 4. Step 2: The @product Gateway

```markdown
## Step 2: When You Don't Know Who to Ask

The `@product` gateway routes requests to the right agents and coordinates execution.

**Try this:**
```
@product launch a self-serve upgrade flow for freemium users. Context: @context/demo/bets/SB-DEMO-002-self-serve.md @context/demo/feedback/FB-DEMO-002-onboarding-friction.md
```

**What happens:**
1. Gateway analyzes your request
2. Routes to relevant owners (PM for requirements, PMM for positioning, ProdOps for launch)
3. Coordinates responses into an execution plan

**When to use `@product`:** When your request spans multiple functions or you're not sure which agent owns it. The gateway figures it out.

**When to use individual agents:** When you know exactly who you need (`@pm` for PRD work, `@pmm` for positioning).
```

*Wait for user to run the command, then continue to Step 3...*

---

### 5. Step 3: The Context Layer (Institutional Memory)

```markdown
## Step 3: How the System Remembers

Unlike chat threads that forget, the context layer gives every agent access to your organization's memory:

| Stored | Purpose |
|--------|---------|
| Decisions | Past choices with rationale |
| Strategic Bets | Active initiatives with assumptions |
| Feedback | Customer voice across sources |
| Learnings | What worked and what didn't |
| Documents | PRDs, strategies, plans |

**Try this:**
```
/context-recall enterprise
```

You'll see past decisions, active bets, and constraints related to "enterprise."

**Now try using context in a task:**
```
@pm @context/demo/decisions/DR-DEMO-001-pricing-model.md update the enterprise PRD to reflect our pricing decision
```

The agent uses your past decision as context for current work.

**Key insight:** Every decision, bet, and learning you save becomes available to all agents. Run `/context-save` after important work to build organizational memory.
```

*Wait for user to run the commands, then continue to Step 4...*

---

### 6. Step 4: Direct Skills (Power User Mode)

```markdown
## Step 4: When You Know What You Need

Skills are the templates and workflows that agents use internally. You can invoke them directly when you know the exact deliverable you want.

| Skill | Creates |
|-------|---------|
| `/prd` | Product Requirements Document |
| `/decision-record` | Structured decision with rationale |
| `/strategic-bet` | Bet with explicit assumptions |
| `/positioning-statement` | Market positioning |
| `/launch-plan` | Complete launch playbook |

**Try this:**
```
/decision-record Should we add webhook support to the API?
```

This creates a structured decision record with options, rationale, assumptions, and re-decision triggers.

**When to use skills directly:**
- You know exactly what deliverable you need
- You want a specific template/framework
- You're doing focused work, not delegating

**When to use agents:**
- You want judgment and analysis, not just a template
- You need context interpreted and applied
- You're delegating an outcome, not specifying a format
```

*Wait for user to run the command, then continue to Step 5...*

---

### 7. Step 5: Portfolio & Phases

```markdown
## Step 5: Where Work Fits

Product Org OS organizes work into six phases from strategy to outcomes:

```
Foundation → Decisions → Commitments → Execution → Outcomes → Learning
 (Phase 1)   (Phase 2)    (Phase 3)     (Phase 4)   (Phase 5)  (Phase 6)
```

**Try this:**
```
/portfolio-status
```

This shows your active strategic bets and where they are in the flow.

**Skills map to phases:**
- Phase 1: `/market-analysis`, `/competitive-landscape`, `/vision-statement`
- Phase 2: `/business-case`, `/pricing-strategy`, `/decision-record`
- Phase 3: `/product-roadmap`, `/prd`, `/launch-plan`
- Phase 4-5: `/campaign-brief`, `/sales-enablement`, `/value-realization-report`
- Phase 6: `/outcome-review`, `/retrospective`

The context layer tracks which phase your work belongs to, ensuring nothing falls through the cracks.
```

*Wait for user to run the command, then show completion...*

---

### 8. Completion

```markdown
## Tour Complete!

You've learned the core patterns of Product Org OS:

| Pattern | When to Use | Example |
|---------|-------------|---------|
| `@agent @file.md task` | Delegating work with context | `@pm @research.md create PRD` |
| `@product task @files` | Don't know who to ask | `@product launch feature @strategy.md` |
| `/context-recall topic` | Before new decisions | `/context-recall pricing` |
| `/skill topic` | Know exact deliverable | `/decision-record webhook support` |
| `/portfolio-status` | Check strategic state | See active bets and phase progress |

---

### How Agents Use Skills (The "Magic" Explained)

When you delegate to an agent like `@pm`:
1. Agent reads your context files
2. Chooses appropriate skills internally (`/prd`, `/user-story`, etc.)
3. Applies judgment and analysis
4. Delivers structured output grounded in your context

You can use skills directly for power-user control, or let agents choose them for delegated work.

---

### What's Next?

| Goal | Command |
|------|---------|
| Start with your own work | `@product [your question or task]` |
| Create a PRD | `@pm @your-research.md create PRD for [feature]` |
| Check past decisions | `/context-recall [topic]` |
| Save important work | `/context-save` |
| See time saved | `/roi-report` |
| View full skill catalog | Visit yohayetsion.github.io/product-org-os |
| Run tour again | `/tour` |

**Demo data auto-filters** once you have production data—your real decisions, bets, and feedback take precedence. Use `--include-demo` to see demo alongside your data.
```

## Instructions

1. Check prerequisites (context layer, demo data)
2. Present each step one at a time
3. Wait for user to try the command before proceeding
4. Explain what happens internally (agents using skills)
5. Show how context files ground the work in business reality
6. End with completion summary and next steps

## Key Messages to Reinforce

- **Agents use skills internally** - transparency about how the system works
- **Context files = business grounding** - every example references real files
- **Delegate outcomes, not formats** - agents choose methods
- **Context layer = institutional memory** - the differentiator
- **6-phase framework = where work fits** - everything connects

## Notes

- Tour can be run multiple times
- Works best with demo data present
- Each step builds on previous concepts
- Users can exit anytime and resume later
- `/demo` is an alias for this skill
