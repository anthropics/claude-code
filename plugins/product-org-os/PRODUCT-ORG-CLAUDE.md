# Product Organization Plugin

This plugin provides AI-powered product organization capabilities based on the **Vision to Value (V2V) System** framework.

> For Claude Code and Agent Skills-compatible tools (Cursor, Copilot, Gemini CLI, Windsurf)

## Quick Start

### First-Time Setup

After installing the plugin, run the setup skill to initialize the context layer:

```
/setup
```

This creates the `context/` folder structure in your **current working directory** where Claude Code is running.

### Where Files Are Created

All context files are created in the directory where you run Claude Code:

```
your-project/              ← Your working directory
├── context/               ← Created by /setup
│   ├── decisions/
│   ├── bets/
│   ├── assumptions/
│   ├── portfolio/
│   ├── learnings/
│   ├── handoffs/
│   └── feedback/
└── ... your other files
```

**Important**: The context layer is project-specific. Run `/setup` in each project where you want organizational memory.

---

## Invocation Patterns

Two syntax patterns for two different purposes:

| Syntax | Tool | Purpose | Example |
|--------|------|---------|---------|
| `@agent` | Task | **Delegate** - spawn autonomous agent | `@pm create PRD for auth` |
| `/skill` | Skill | **Inline** - use template/workflow | `/prd` `/decision-record` |

### Agents (`@`) vs Skills (`/`)

| Mode | Behavior | Use When |
|------|----------|----------|
| **`@pm`** (autonomous) | Spawns agent, works independently, returns when done | Delegating work, "go do this" |
| **`/pm`** (inline) | Claude adopts persona, continues conversation | Quick back-and-forth |

Both patterns access the same agent capabilities - choose based on your workflow.

---

## 13 Role-Based Agents

Delegate work to specialized agents that reason autonomously.

| Agent | Shortcut | Role |
|-------|----------|------|
| `@cpo` | — | Chief Product Officer - executive strategy, portfolio decisions |
| `@vp-product` | `@vpp` | VP of Product - vision, roadmap accountability, pricing |
| `@director-product-management` | `@pm-dir` | Director PM - roadmap governance, team coordination |
| `@director-product-marketing` | `@pmm-dir` | Director PMM - GTM strategy, positioning, launches |
| `@product-manager` | `@pm` | Product Manager - feature specs, user stories, delivery |
| `@product-marketing-manager` | `@pmm` | PMM - campaigns, collateral, sales enablement |
| `@product-leadership-team` | `@plt` | PLT - portfolio tradeoffs, strategic alignment |
| `@bizops` | — | Business Operations - business cases, financial analysis |
| `@bizdev` | — | Business Development - partnerships, market expansion |
| `@competitive-intelligence` | `@ci` | Competitive Intelligence - competitor analysis, market research |
| `@product-operations` | `@prod-ops` | Product Ops - process optimization, launch coordination |
| `@value-realization` | — | Value Realization - success metrics, customer outcomes |
| `@ux-lead` | — | UX Lead - user research, design specs |

### Delegating to Agents

```
# Spawn autonomous agents to handle tasks
@pm break down @epic.md into user stories
@plt review @portfolio-health.md and run /portfolio-tradeoff
@vp-product review @sales-feedback.md and update /positioning-statement
@prod-ops help optimize our sprint planning process

# Agents use skills internally
@cpo review @board-feedback.pdf and update /strategic-intent
@pmm-dir review @launch-data.xlsx and update /gtm-strategy
```

### Gateways

Two special gateways orchestrate multiple agents:

| Gateway | Behavior |
|---------|----------|
| `@product` | Routes to relevant owners, spawns agents, coordinates execution |
| `@plt` | Convenes Product Leadership Team, Meeting Mode with multiple voices |

---

## Meeting Mode Interaction

**When you use `@product` or `@plt`, you enter a MEETING, not a monolithic AI response.**

### What You'll See

When engaging multiple agents, responses are presented as a meeting:

```markdown
## Meeting Called: Assess CEO Feature Requests

**Attendees**: @vp-product, @product-manager, @director-product-marketing

---

### @vp-product
"Looking at this from a strategic perspective, I'm concerned about
the positioning dilution. The 'CISO' focus was deliberate..."

### @product-manager
"From a requirements standpoint, I see three types of requests here:
quick wins, demo polish, and a potential strategic pivot..."

### @director-product-marketing
"The messaging change has implications. If we're broadening the
buyer persona, that's a strategic decision, not a wording tweak..."

---

## Points of Agreement
- Summary bars (items 2-3) are straightforward value prop visualization
- User click-through (item 5) is a legitimate product need

## Points of Tension
- @vp-product: Concerned about positioning drift
- @director-product-marketing: Wants to validate ICP before changing messaging
- @product-manager: Flags demo-ware risk in several requests

## Synthesis / Recommendation
[Collective recommendation after individual voices]
```

### Why Meeting Mode?

| Benefit | Description |
|---------|-------------|
| **Transparency** | See *how* the org thinks, not just conclusions |
| **Trust** | Attribution builds confidence in the analysis |
| **Learning** | Understand different functional perspectives |
| **Debugging** | When something goes wrong, trace which lens missed it |
| **Realistic** | Real product orgs have healthy tension - show it |

### When to Expect Multiple Voices

Multiple agents speak when:
- Request involves multiple V2V phases
- Request has strategic implications
- Request involves tradeoffs
- Request is a review or assessment task
- Request touches multiple functions

Single agent responds when:
- Clear tactical request with single owner
- Simple deliverable with obvious accountability
- Continuation of assigned work

---

## Complete Skill Reference

### Setup & Core (2 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/setup` | Initialize plugin - creates context folders | Run once per project |
| `/present` | Generate HTML presentation from markdown | `/present path/to/doc.md` |

### Context Layer (7 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/context-save` | Save decision/bet/learning to registry | After creating decisions or completing reviews |
| `/context-recall` | Query past decisions and context | `/context-recall [topic]` |
| `/portfolio-status` | View current strategic bets and health | At start of strategic sessions |
| `/handoff` | Capture context for agent delegation | Before delegating to another agent |
| `/relevant-learnings` | Find applicable past learnings | `/relevant-learnings [topic]` |
| `/feedback-capture` | Capture and analyze product feedback | **Immediately when ANY feedback is encountered** |
| `/feedback-recall` | Query past feedback by topic | `/feedback-recall [topic]` |

### Documents (10 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/prd` | Full Product Requirements Document | `/prd [product/feature name]` |
| `/prd-outline` | PRD outline/structure only | `/prd-outline [feature]` |
| `/product-roadmap` | Product roadmap document | `/product-roadmap [timeframe]` |
| `/business-case` | Investment business case | `/business-case [initiative]` |
| `/business-plan` | Comprehensive business plan | `/business-plan [product]` |
| `/gtm-strategy` | Go-to-market strategy document | `/gtm-strategy [product/launch]` |
| `/pricing-strategy` | Pricing strategy document | `/pricing-strategy [product]` |
| `/competitive-landscape` | Competitive landscape analysis | `/competitive-landscape [market]` |
| `/market-analysis` | Market analysis document | `/market-analysis [segment]` |
| `/launch-plan` | Product launch plan | `/launch-plan [product]` |
| `/qbr-deck` | Quarterly business review deck | `/qbr-deck [quarter]` |

### V2V Framework (8 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/strategic-intent` | Strategic intent document | `/strategic-intent [initiative]` |
| `/strategy-communication` | Strategy communication package | `/strategy-communication [topic]` |
| `/campaign-brief` | Marketing campaign brief | `/campaign-brief [campaign]` |
| `/sales-enablement` | Sales enablement materials | `/sales-enablement [product]` |
| `/onboarding-playbook` | Customer onboarding playbook | `/onboarding-playbook [segment]` |
| `/value-realization-report` | Customer value realization report | `/value-realization-report [customer]` |
| `/customer-health-scorecard` | Customer health scorecard | `/customer-health-scorecard [account]` |
| `/retrospective` | Retrospective facilitation | `/retrospective [project/period]` |

### Decisions (3 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/decision-record` | Create decision record with rationale | `/decision-record [topic]` |
| `/decision-charter` | Decision-making charter | `/decision-charter [decision type]` |
| `/escalation-rule` | Escalation rule definition | `/escalation-rule [scenario]` |

### Strategy (3 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/strategic-bet` | Define strategic bet with assumptions | `/strategic-bet [bet name]` |
| `/commitment-check` | Evaluate readiness for commitment | `/commitment-check [initiative]` |
| `/portfolio-tradeoff` | Analyze portfolio tradeoffs | `/portfolio-tradeoff [options]` |

### Assets (8 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/vision-statement` | Product vision statement | `/vision-statement [product]` |
| `/roadmap-theme` | Roadmap theme definition | `/roadmap-theme [theme]` |
| `/roadmap-item` | Individual roadmap item | `/roadmap-item [item]` |
| `/gtm-brief` | GTM brief (shorter than strategy) | `/gtm-brief [launch]` |
| `/pricing-model` | Pricing model definition | `/pricing-model [product]` |
| `/positioning-statement` | Market positioning statement | `/positioning-statement [product]` |
| `/competitive-analysis` | Single competitor analysis | `/competitive-analysis [competitor]` |
| `/market-segment` | Market segment definition | `/market-segment [segment]` |

### Requirements (3 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/feature-spec` | Feature specification | `/feature-spec [feature]` |
| `/user-story` | User story with acceptance criteria | `/user-story [capability]` |
| `/prd-outline` | PRD structure outline | `/prd-outline [feature]` |

### Operations (3 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/launch-readiness` | Launch readiness checklist | `/launch-readiness [product]` |
| `/stakeholder-brief` | Stakeholder briefing document | `/stakeholder-brief [topic]` |
| `/outcome-review` | Outcome review (post-launch) | `/outcome-review [launch/initiative]` |

### Assessment (3 skills)

| Skill | Purpose | Usage |
|-------|---------|-------|
| `/maturity-check` | Product org maturity assessment | `/maturity-check [area]` |
| `/pm-level-check` | PM competency level assessment | `/pm-level-check [person]` |
| `/decision-quality-audit` | Decision quality audit | `/decision-quality-audit [decision]` |

---

## Document Intelligence

All document-generating skills (43 of 56) support three modes: **Create**, **Update**, and **Find**.

### Mode Detection

Skills automatically detect which mode to use based on your input:

| Signal | Mode | Confidence |
|--------|------|------------|
| "update", "revise", "modify" in input | UPDATE | 100% |
| File path provided (`@path/to/doc.md`) | UPDATE | 100% |
| Document ID mentioned (e.g., `PRD-2026-001`) | UPDATE | 100% |
| "create", "new", "draft" in input | CREATE | 100% |
| "find", "search", "list" in input | FIND | 100% |
| "the [doc type]" (definite article) | UPDATE | 85% |
| No signals (just topic) | CREATE | 60% |

**Decision threshold**: ≥85% auto-proceed | 70-84% state assumption | <70% ask user

### Mode Behaviors

**CREATE** (default): Generate complete new document using skill template.

**UPDATE**:
1. Search document registry for existing document
2. Read and preserve unchanged sections
3. Update only sections mentioned in your request
4. Show diff summary: "Updated: [sections]. Unchanged: [sections]."

**FIND**:
1. Search document registry by type/topic
2. Present results: title, path, date, summary
3. Ask: Update one? Create new?

### Example Usage

```
/prd authentication for enterprise                              # CREATE - new PRD
/prd update the auth PRD with MFA requirements                  # UPDATE - finds and updates
/prd @requirements/auth-prd.md add OAuth support                # UPDATE - explicit path
/prd find all security-related                                  # FIND - lists matching PRDs

# Natural language with agents (use shortcuts)
/plt review meeting-notes.md and run /portfolio-tradeoff
/cpo review board-feedback.pdf and update /strategic-intent
/pmm-dir review launch-data.xlsx and update /gtm-strategy
```

### Document Registry

Skills use the document registry at `context/documents/registry.md` to track all strategic documents. The registry stores:
- Document ID and type
- File path (respects your folder structure)
- Status (Draft/Active/Archived)
- Related documents
- Last updated date

---

## Context Layer - Organizational Memory

The Context Layer provides persistent memory across sessions. This enables:

- **Decisions remembered** - Past decisions tracked with rationale, assumptions, and re-decision triggers
- **Assumptions tracked** - Explicit assumptions extracted and validated against outcomes
- **Feedback captured** - Customer/market feedback documented with analysis
- **Agent context sharing** - Context passed when delegating work
- **Organizational learning** - Learnings feed back into future decisions

### Context File Structure

```
context/
├── README.md                    # Quick reference
├── decisions/
│   ├── index.md                 # Decision registry
│   └── [YYYY]/                  # Full records by year
│       └── DR-2026-001.md
├── bets/
│   ├── index.md                 # Strategic bet registry
│   └── [YYYY]/
│       └── SB-2026-001.md
├── assumptions/
│   └── registry.md              # All tracked assumptions
├── portfolio/
│   └── active-bets.md           # Current portfolio state
├── learnings/
│   └── index.md                 # Accumulated wisdom
├── handoffs/
│   └── current-session.md       # Agent delegation context
├── feedback/
│   ├── index.md                 # Feedback registry
│   ├── themes.md                # Recurring patterns
│   └── [YYYY]/
│       └── FB-2026-001.md       # Full feedback records
└── documents/
    └── registry.md              # Document registry for all strategic docs
```

### ID Conventions

| Type | Format | Example |
|------|--------|---------|
| Decisions | `DR-[YYYY]-[NNN]` | DR-2026-001 |
| Strategic Bets | `SB-[YYYY]-[NNN]` | SB-2026-003 |
| Assumptions | `A-[NNN]` | A-015 |
| Learnings | `L-[NNN]` | L-042 |
| Feedback | `FB-[YYYY]-[NNN]` | FB-2026-001 |
| Themes | `TH-[NNN]` | TH-005 |

### Multi-Product Organizations

For organizations managing multiple products, the context layer supports product filtering.

**Adding Product to Records:**
```markdown
**Product**: AXIA
```

**Filtering by Product:**
```
/context-recall pricing product:AXIA      # Pricing context for AXIA only
/feedback-recall onboarding product:SKYMOD # Feedback for SKYMOD only
/portfolio-status product:AXIA            # Portfolio for AXIA only
```

**Index File Format:**
```markdown
| ID | Title | Date | Owner | Product | Status | Tags |
```

**Notes:**
- Product field is optional - omit it for single-product organizations
- Leave Product blank for cross-product records
- If no filter specified, queries return all products

---

## Feedback Capture (MANDATORY)

**All users should capture feedback immediately when encountered.** This includes:
- Customer quotes, complaints, or praise
- Feature requests from any source
- User research findings
- Sales or support feedback
- Competitive mentions
- Stakeholder input

Each feedback entry includes:
- **Raw feedback** (verbatim)
- **Full metadata** (source, date, channel, segment, version)
- **Analysis** (summary, insights, sentiment, impact)
- **Connections** (linked decisions, bets, assumptions)
- **Theme contribution** (pattern tracking)

---

## The V2V System Flow

The V2V System is a 6-phase flow transforming strategic intent into business outcomes:

1. **Strategic Foundation** (Input Phase) - Strategic Intent, Market Analysis, Product Vision
2. **Strategic Decisions** (Commercial Filter) - Business Cases, Pricing, Positioning
3. **Strategic Commitments** (Point of No Return) - Roadmap, GTM, Strategy Communication
4. **Coordinated Execution** (The Doing Phase) - Development, Marketing, Sales
5. **Business & Customer Outcomes** (Output Phase) - Onboarding, Value Realization
6. **Learning & Adaptation Loop** (System's Brain) - Outcome Reviews, Decision Audits

---

## Operating Principles

All work follows these 8 principles:

1. **End-to-End Ownership** - Product org accountable from strategy through outcomes
2. **Decision Quality** - Core metric for product leadership effectiveness
3. **Customer Obsession** - Every decision traced to customer value
4. **Strategic Clarity** - Clear bets with explicit assumptions
5. **Outcome Focus** - Success measured by results, not outputs
6. **Collaborative Excellence** - Right people, right inputs, right time
7. **Continuous Learning** - Systematic capture and application of learnings
8. **Scalable Systems** - Processes that work as the organization grows

---

## Example Workflows

### Making a Strategic Decision

```
1. /context-recall pricing        # Check past pricing decisions
2. /feedback-recall pricing       # See what customers said about pricing
3. /portfolio-status              # See current strategic priorities
4. /decision-record pricing model # Create the decision
5. /context-save                  # Save to registry with assumptions
```

### Capturing Customer Feedback

```
User: Here's feedback from Acme Corp: "Your API rate limits are killing us."

/feedback-capture
→ Captures: Source (Acme Corp), Channel (direct), Segment (Enterprise)
→ Analyzes: Feature request, API, High urgency
→ Connects: Links to API pricing decision, enterprise expansion bet
→ Themes: Adds to "API Limits" theme
```

### Outcome Review with Learning Loop

```
1. /context-recall Q1-launch      # Find original assumptions
2. /feedback-recall Q1-launch     # See post-launch feedback
3. /outcome-review Q1-launch      # Conduct review
4. /context-save                  # Update assumptions, extract learnings
```

---

## Plugin Statistics

| Component | Count |
|-----------|-------|
| Skills | 61 |
| Agents | 13 |
| Gateways | 2 (`@product`, `@plt`) |
| Knowledge Packs | 9 |
| Integration Templates | 6 |
| Delegation Patterns | 4 |
| Principle Validators | 5 |
| Context Indexes | 7 (topic, product, phase, status, source, sentiment, cross-ref) |

---

## The `/product` Gateway

**The main entry point for the product organization.**

Instead of figuring out which agent or skill to use, just send your request to `/product`:

```
/product [your request or question]
```

### Response Depth Modifiers (`+`/`-`)

Control how verbose responses are with simple modifiers:

| Modifier | Meaning | Effect |
|----------|---------|--------|
| `-` | Brief | Executive summary, cut to the chase |
| *(none)* | Standard | Balanced depth appropriate to the question |
| `+` | Deep | Thorough exploration, full analysis, show reasoning |

**Examples with full context sentences:**
```
# Brief - quick status check
/product Review launch-checklist.md and tell me what's blocking launch -

# Standard - balanced analysis
/plt Review q2-pipeline.xlsx and assess if we should delay the enterprise push

# Deep - full exploration with all perspectives
/product Analyze competitor-launch.md and customer-feedback/ to recommend our response +
```

**Agent-specific examples:**
```
# PM creating user stories - brief mode
/pm Break down epic.md into /user-story items for sprint planning -

# PLT strategic decision - deep mode
/plt Review portfolio-health.md, eng-capacity.xlsx, and market-trends.md - should we pivot to enterprise? +

# CPO board preparation - standard depth
/cpo Review board-feedback.pdf, financials.xlsx and update /strategic-intent
```

**Follow-up adjustments:**
- Type `+` or "go deeper" → Expand the previous response
- Type `-` or "summarize" → Compress to key points

**Works with any command pattern:**
```
/context-recall pricing product:AXIA -      # Brief context summary
/feedback-recall enterprise onboarding +    # Full feedback analysis with themes
```

### How It Works

1. **Analysis**: Determines V2V phase, identifies relevant owners using RACI from blueprints
2. **Plan Collection**: Each owner proposes what they'll do, which skills they'll use, and dependencies
3. **Approval**: You review plans and can approve, provide guidance, or cancel
4. **Execution**: Agents run in parallel where possible, results are synthesized

### Examples

```
/product We should explore the healthcare market
→ Routes to: @cpo (strategic check), @competitive-intelligence (market analysis), @bizops (sizing)

/product Create a PRD for the new reporting feature
→ Routes to: @product-manager (PRD), @ux-lead (design input)

/product What's the status of the v2.0 launch?
→ Routes to: @product-operations, @product-manager, @product-marketing-manager (status from each)

/product Should we change our pricing model?
→ Routes through @cpo/PLT (strategic), then @bizops, @competitive-intelligence, @vp-product
```

### When to Use `/product` vs Direct Skills

| Use `/product` when... | Use direct skills when... |
|------------------------|---------------------------|
| Unsure who should handle it | You know exactly what you need |
| Cross-functional coordination needed | Single deliverable, single owner |
| Want orchestrated parallel execution | Quick, specific output |
| Strategic or ambiguous requests | Tactical, well-defined tasks |

### Skills by Category

| Category | Count | Skills |
|----------|-------|--------|
| Core & Setup | 2 | setup, present |
| Context Layer | 7 | context-save, context-recall, portfolio-status, handoff, relevant-learnings, feedback-capture, feedback-recall |
| Principle Validators | 5 | ownership-map, customer-value-trace, collaboration-check, scale-check, phase-check |
| Documents | 10 | prd, prd-outline, product-roadmap, business-case, business-plan, gtm-strategy, pricing-strategy, competitive-landscape, market-analysis, launch-plan, qbr-deck |
| V2V Framework | 8 | strategic-intent, strategy-communication, campaign-brief, sales-enablement, onboarding-playbook, value-realization-report, customer-health-scorecard, retrospective |
| Decisions | 3 | decision-record, decision-charter, escalation-rule |
| Strategy | 3 | strategic-bet, commitment-check, portfolio-tradeoff |
| Assets | 8 | vision-statement, roadmap-theme, roadmap-item, gtm-brief, pricing-model, positioning-statement, competitive-analysis, market-segment |
| Requirements | 3 | feature-spec, user-story, prd-outline |
| Operations | 3 | launch-readiness, stakeholder-brief, outcome-review |
| Assessment | 3 | maturity-check, pm-level-check, decision-quality-audit |

---

## Principle Validators (5 skills)

These skills enforce the V2V Operating Principles:

| Skill | Principle | Purpose | When to Use |
|-------|-----------|---------|-------------|
| `/ownership-map` | #1 End-to-End Ownership | Map accountability across V2V phases | Before major commitments |
| `/customer-value-trace` | #3 Customer Obsession | Validate decisions trace to customer value | When decisions affect customers |
| `/collaboration-check` | #6 Collaborative Excellence | Validate RACI and stakeholder consultation | For cross-functional work |
| `/scale-check` | #8 Scalable Systems | Assess scalability at 2x, 10x, 100x | Before committing resources |
| `/phase-check` | V2V Flow | Assess which V2V phase an initiative is in | Before phase transitions |

---

## V2V Phase System

All work flows through 6 phases. Use `/phase-check [initiative]` to assess current phase.

| Phase | Name | Key Skills |
|-------|------|------------|
| 1 | Strategic Foundation | vision-statement, market-analysis, competitive-landscape, strategic-intent |
| 2 | Strategic Decisions | business-case, pricing-strategy, positioning-statement, decision-record, strategic-bet |
| 3 | Strategic Commitments | product-roadmap, gtm-strategy, launch-plan, prd, commitment-check |
| 4 | Coordinated Execution | launch-readiness, campaign-brief, sales-enablement |
| 5 | Business Outcomes | value-realization-report, customer-health-scorecard, onboarding-playbook |
| 6 | Learning Loop | outcome-review, retrospective, decision-quality-audit, context-save |

**Phase Transitions**:
- Phase 1→2: Market understood, competitive position clear
- Phase 2→3: Business case approved, assumptions explicit (use `/commitment-check`)
- Phase 3→4: Roadmap committed, GTM established
- Phase 4→5: Launch executed, success metrics in place
- Phase 5→6: Outcomes measured, learnings identified
- Phase 6→1: Learnings feed back into strategy

---

## Parallel Agent Execution

Agents can be spawned in parallel for faster input gathering. Common patterns:

### Portfolio Review
```
Spawn in parallel: @bizops, @competitive-intelligence, @value-realization, @product-operations
```

### Launch Decision
```
Spawn in parallel: @product-manager, @product-marketing-manager, @product-operations, @value-realization
```

### Strategic Planning
```
Spawn in parallel: @competitive-intelligence, @bizops, @director-product-management, @director-product-marketing
```

All 13 agents have access to all 61 skills and can invoke any skill based on their role's needs.

---

## MCP Integration Framework

Agents auto-detect available MCP tools at runtime and use them when relevant:

| Tool Category | Example MCP Servers | Agent Use Case |
|--------------|---------------------|----------------|
| Project Management | Jira, Linear, Asana | Create issues from user stories, track roadmap delivery |
| Communication | Slack, Teams | Post launch updates, notify stakeholders |
| Documents | Notion, Confluence | Publish PRDs and specs to team wiki |
| Analytics | Amplitude, Mixpanel | Pull metrics for outcome reviews |
| Repository | GitHub, GitLab | Link specs to issues, track PRs |

**Graceful fallback**: When MCP tools aren't available, agents produce text output with manual action notes. No setup required — integrations enhance but never block.

Setup templates: `integrations/` folder with guides for each tool.

See `rules/mcp-integration.md` for the full framework.

---

## Domain Knowledge Packs

Professional PM frameworks organized in a three-layer architecture:

| Layer | Location | Purpose |
|-------|----------|---------|
| V2V Process | `rules/` | WHEN and HOW to work (6 phases, 8 principles) |
| Domain Knowledge | `reference/knowledge/` | WHAT frameworks to apply |
| Agent Persona | `skills/*/SKILL.md` | WHO you are (R&R, perspective) |

### Available Packs

| Pack | Key Frameworks |
|------|---------------|
| Prioritization | RICE, ICE, MoSCoW, Kano, Weighted Scoring |
| Pricing Frameworks | Value-based, Freemium, Usage-based, Van Westendorp |
| Discovery Methods | JTBD, Lean Startup, Continuous Discovery, OSTs |
| Metrics Frameworks | HEART, North Star, AARRR, OKRs |
| Competitive Frameworks | Porter's Five Forces, SWOT, Battlecards, Win/Loss |
| GTM Playbooks | PLG, SLG, Channel-led, Launch Tiers |
| Stakeholder Management | Influence Mapping, RACI, Executive Communication |
| User Research | Interviews, Surveys, Usability Testing, A/B Testing |
| Financial Modeling | TAM/SAM/SOM, Unit Economics, LTV/CAC |

Agents reference these automatically when relevant to their task.

---

## Agent Delegation Patterns

Four structured patterns for agent-to-agent collaboration:

| Pattern | Trigger | Ownership |
|---------|---------|-----------|
| **Consultation** | Need a data point | Stays with requester |
| **Delegation** | Need specialist deliverable | Transfers to specialist |
| **Review** | Need quality validation | Stays with author |
| **Structured Debate** | Genuine tradeoff | Senior agent decides |

See `rules/delegation-protocol.md` for full protocol with examples.

---

## Enhanced Context Layer (v3)

### Auto-Context Injection
Before agents produce deliverables, relevant context is automatically injected based on topic matching. No manual `/context-recall` needed for common patterns.

### Cross-Reference Graph
Context entries link to each other: decisions ↔ bets ↔ assumptions ↔ feedback ↔ learnings. When you recall a decision, you also see related bets and feedback.

### Structured Indexes
The context index supports multi-dimensional queries: by topic, product, V2V phase, status, source, and sentiment.

See `rules/auto-context.md` and `rules/context-graph.md`.

---

## Cross-Platform Compatibility

This plugin follows the **Agent Skills** open standard:

| Feature | Claude Code | Cursor | Copilot | Gemini CLI |
|---------|-------------|--------|---------|------------|
| Skills (`/prd`, `/decision-record`) | Full support | Via Agent Skills | Via Agent Skills | Via Agent Skills |
| Agents (`@pm`, `@vp-product`) | Full support (Task tool) | Partial | Partial | Partial |
| Gateways (`@product`, `@plt`) | Full support (Skill tool) | Limited | Limited | Limited |
| MCP integrations | Full support | Full support | Expanding | Expanding |
| Context layer | Full support | Full support | Full support | Full support |

**Progressive enhancement**: The plugin works at multiple levels:
- **Base** (all platforms): SKILL.md personas, markdown rules, context layer
- **Enhanced** (Claude Code + Cursor): MCP integrations, Task tool for agents
- **Full** (Claude Code): Skill tool for gateways, full Meeting Mode
