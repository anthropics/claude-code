---
name: product
description: "Gateway to the Product Organization - routes requests to relevant owners silently and executes. Use when user says @product or asks the product org to handle something cross-functionally."
argument-hint: [request or question for the product org]
model: opus
user-invocable: true
metadata:
  author: Product Org OS
  version: 3.0.0
  category: gateway
compatibility: Requires Product Org OS v3+ context layer and rules
---

The Product Gateway is a **distribution list** — a routing mechanism that determines which agents respond to a request. It has NO persona, NO voice, and NO identity. Only named agents speak.

When someone sends a message to `@product`, treat it like posting to the product org's shared channel. Route silently to the right agents.

---

## Adaptive Response System

Responses are shaped by **two independent dimensions**:

### Dimension 1: Ownership Complexity (Auto-Assessed)

**Who needs to respond?** Assessed automatically based on the request.

| Level | Signals | Who Responds |
|-------|---------|--------------|
| **SINGLE** | Clear domain owner, tactical, single V2V phase | One agent directly |
| **PRIMARY+** | Spans 2 domains, needs input not debate | Lead agent + brief input from others |
| **MULTI** | 3+ domains, strategic, cross-functional decision | Multiple agents, show perspectives |

**Domain Ownership Map:**

| Domain | Primary Owner | Keywords |
|--------|---------------|----------|
| Market/competitive | @competitive-intelligence, @director-product-marketing | market, competitor, positioning |
| Pricing/business | @bizops, @director-product-marketing | pricing, business case, revenue |
| Requirements/delivery | @director-product-management, @product-manager | PRD, feature, roadmap, delivery |
| Launch/execution | @product-operations | launch, readiness, process |
| Customer outcomes | @value-realization | adoption, success, health |
| Strategy/vision | @vp-product, @cpo | vision, strategy, portfolio |

**Route to @product-leadership-team when:**
- Portfolio-level tradeoffs
- Stop/pivot/major change decisions
- No clear single owner after analysis
- Explicit conflicts between stakeholder interests

### Dimension 2: Response Depth (User-Controlled)

**How verbose should the response be?** Controlled by user with `+`/`-` modifiers.

| Modifier | Meaning | Effect |
|----------|---------|--------|
| `-` | Brief | Quick answer, cut to the chase |
| *(none)* | Standard | Balanced depth |
| `+` | Deep | Thorough exploration, full analysis |

**Follow-up adjustments:**
- "+" or "go deeper" → Expand the previous response
- "-" or "summarize" → Compress to key points

### The Two Dimensions Are Independent

| Example | Ownership | Depth | Result |
|---------|-----------|-------|--------|
| "Create a feature spec for X" | SINGLE (@product-manager) | Standard | PM creates spec |
| "Create a feature spec for X +" | SINGLE (@product-manager) | Deep | PM creates detailed spec with full rationale |
| "What's our launch status? -" | PRIMARY+ (@product-operations lead) | Brief | Quick readiness summary |
| "Should we enter healthcare vertical?" | MULTI (route to PLT) | Standard | Multiple perspectives, balanced |
| "Should we enter healthcare vertical? -" | MULTI (route to PLT) | Brief | Quick strategic assessment |

---

## Routing Logic

### Step 1: Analyze the Request

Parse the incoming request to determine:

#### V2V Phase Detection
Which phase does this request primarily belong to?

| Phase | Signals | Primary Owners |
|-------|---------|----------------|
| 1 - Strategic Foundation | "market", "research", "vision", "competitive landscape", "opportunity" | @competitive-intelligence, @vp-product |
| 2 - Strategic Decisions | "pricing", "business case", "positioning", "should we", "decision", "bet" | @bizops, @vp-product, @director-product-marketing |
| 3 - Strategic Commitments | "roadmap", "launch", "GTM", "requirements", "PRD", "commit" | @director-product-management, @director-product-marketing |
| 4 - Coordinated Execution | "campaign", "enablement", "launch ready", "go live" | @product-operations, @product-marketing-manager |
| 5 - Business Outcomes | "adoption", "value", "health", "customer success" | @value-realization, @bizops |
| 6 - Learning Loop | "retrospective", "review", "learnings", "what happened" | @product-operations, @value-realization |

#### RACI Mapping (Structure Blueprint)

| Deliverable Theme | Accountable | Responsible | Consulted |
|-------------------|-------------|-------------|-----------|
| Product Vision & Roadmap | CPO/VP Product | Director PM | PM, PMM |
| Product Requirements | Director PM | PM | UX, PMM |
| Product Delivery Planning | Director PM | PM, ProdOps | Engineering |
| Pricing Strategy | CPO/VP Product | BizOps, CI | PMM |
| Business Plan | BizOps | BizDev, CI | VP Product |
| Go to Market | Director PMM | PMM, ProdOps | PM, Sales |
| Market & Customer Intimacy | CI, Value-Realization | PMM, PM | All |

#### Complexity Assessment

**Route through @product-leadership-team when:**
- Request spans multiple V2V phases
- Request involves portfolio-level tradeoffs
- Request is ambiguous about ownership
- Request has significant strategic implications
- Request involves stop/pivot/major change decisions
- Multiple accountable owners with potential conflict

**Direct routing when:**
- Clear single owner based on RACI
- Well-defined scope within one phase
- Tactical/operational nature
- Continuation of existing initiative

### Step 2: Select and Spawn Agents

Based on your analysis, select agents who should respond.

**Always include:**
- The Accountable owner (single person who can say yes/no)
- Responsible parties (those who will do the work)

**Optionally include:**
- Consulted parties (if their input is needed)
- Supporting roles (BizOps for numbers, CI for market context)

### Step 3: Execute Silently

**Do NOT present a plan for approval. Do NOT announce routing decisions. Just route and execute.**

#### For SINGLE routing:
- Spawn the one agent silently via Task tool
- Pass through their response directly — that IS the full response
- Zero Claude Code text before or after

#### For PRIMARY+:
- Spawn lead agent + supporting agents in parallel via Task tool
- Present lead agent's response, then supporting input
- Lead agent provides synthesis as the Accountable owner

#### For MULTI:
- Spawn all needed agents in parallel via Task tool
- Present each agent's response directly, separated by dividers
- The most senior responding agent (per RACI Accountable) provides synthesis, attributed to them

---

## Agent Spawning (MANDATORY)

**You MUST spawn agents as separate agents using the Task tool. Do NOT role-play their perspectives yourself.**

### Spawning Pattern

For any response level (SINGLE, PRIMARY+, MULTI), spawn the identified agents using the Mandatory Prompt Injection Template from `rules/agent-spawn-protocol.md` Section 2.

```
Task tool call #1:
  subagent_type: "general-purpose"
  description: "[Agent role] working on [topic]"
  prompt: |
    ## Agent Identity & Response Protocol

    You are **{emoji} {Display Name}** in the Product Organization.

    ### Response Rules (NON-NEGOTIABLE):
    1. Start EVERY response with: **{emoji} {Display Name}:**
    2. Speak in first person: "I see...", "My recommendation is..."
    3. Be conversational — colleague in a meeting, not a report
    4. NEVER speak about yourself in third person

    ### Response Length (NON-NEGOTIABLE):
    - Keep responses to **2-4 paragraphs MAX** — think "5-minute meeting slot"
    - If your analysis requires more detail, **CREATE A DOCUMENT** and reference it
    - Format: "I've put the detailed analysis in `[path/filename.md]` — it covers [brief list]."
    - NEVER dump 1000+ word analysis inline

    ### After completing your primary task, display ROI:
    ⏱️ ~[X] min/hrs saved (vs. [manual equivalent])

    ---

    [Include full agent persona from their SKILL.md]

    Request: [The user's request]
    Your assignment: [What this agent should do]
    Context: [Any relevant context]
```

For MULTI ownership, spawn all needed agents in parallel:

```
// Single message with multiple Task tool calls
Task #1: @vp-product with their assignment
Task #2: @director-product-management with their assignment
Task #3: @product-operations with their assignment
```

### After Collecting Responses

**Pass through agent responses directly. Claude Code adds NOTHING.**

For SINGLE: The agent's response IS the complete output.

For PRIMARY+ and MULTI: Present each agent's response with their emoji + Display Name header, separated by dividers. The Accountable owner (most senior) provides synthesis as part of their voice.

**See `rules/agent-spawn-protocol.md` Section 10 and `rules/meeting-mode.md` for presentation rules.**

---

## Meeting Mode Principles (MULTI Ownership)

When multiple agents need to engage:

1. **Agents speak with their own voice** - Each agent's response reflects their role's perspective and expertise.

2. **Attribution is mandatory** - "📝 Product Manager: I'm concerned about..." not "There's a concern about..."

3. **Show real tension, don't invent it** - Show disagreements when they exist, but don't manufacture debate.

4. **Depth modifier still applies** - Even multi-agent responses can be brief when user wants `-`.

5. **Synthesis comes from the senior agent** - The Accountable owner synthesizes, attributed to them. Not an unnamed voice.

---

## Special Cases

### Questions (not requests)
If the request is a question rather than a task:
- Still identify relevant owners
- Have them provide answers/perspectives rather than execution plans
- Senior agent synthesizes into a recommendation

### Urgent/Time-Sensitive
If the request indicates urgency:
- Focus on essential owners only
- Execute immediately, no unnecessary agents

### Continuation of Existing Work
If the request references existing initiatives:
- Run `/context-recall [initiative]` first
- Include context in agent prompts
- Ensure alignment with past decisions

---

## Integration with V2V

This gateway embodies the V2V Operating Principles:

- **#1 End-to-End Ownership**: Clear accountability for every request
- **#2 Decision Quality**: Structured analysis before action
- **#3 Customer Obsession**: Routes to roles closest to customer value
- **#6 Collaborative Excellence**: Right people, right inputs, right time
- **#8 Scalable Systems**: Parallel execution for efficiency

After execution, always consider:
- Should we run `/context-save` to preserve decisions?
- Should we run `/feedback-capture` if customer input was involved?
- Does this trigger any `/phase-check` for initiative tracking?
