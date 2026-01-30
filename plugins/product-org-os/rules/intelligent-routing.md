# Intelligent Routing

This rule governs how requests are analyzed and routed to the appropriate agents with minimal user friction.

---

## Core Principle

> **Route autonomously. Ask only when truly necessary.**

Users invoke the Product Org OS to get things done, not to answer routing questions. Make the decision and execute.

---

## Routing Decision Process

### Step 1: Analyze Intent

What is the user trying to accomplish?

| Signal | Interpretation |
|--------|----------------|
| Explicit @ mention | Route to that agent immediately |
| Explicit / command | Execute that skill immediately |
| Clear domain keywords | Route to domain owner |
| Ambiguous request | Apply decision matrix |

### Step 2: Identify Scope

| Scope | Indicators | Action |
|-------|------------|--------|
| **Single skill** | "Create a PRD", "Write user stories" | Execute skill directly |
| **Single agent** | Clear domain, single perspective needed | Spawn one agent |
| **Multi-agent** | Cross-functional, strategic decision | Spawn agents in parallel |
| **PLT** | Portfolio tradeoff, no clear owner | Invoke @plt |

### Step 3: Select Minimum Agents

**Always prefer fewer agents:**
- 1 agent over 2
- 2 agents over 3
- 3 agents over PLT

More agents = more coordination overhead. Use the minimum needed.

### Step 4: Generate Guidance

When routing to an agent, provide rich context:
- The user's request
- Any referenced documents (`@file`)
- Relevant constraints from context
- Expected deliverable

### Step 5: Execute

Route immediately. Do not ask for confirmation.

---

## Enhanced Decision Matrix

| Intent Pattern | Keywords | Route To | May Spawn Sub-Agent |
|----------------|----------|----------|---------------------|
| **Requirements** | PRD, feature, user story, spec, acceptance criteria | `@pm` | `@ux-lead` for research |
| **Pricing/Business** | pricing, business case, ROI, revenue, cost, financial | `@bizops` | `@ci` for market data |
| **GTM/Positioning** | launch, positioning, messaging, go-to-market, campaign | `@pmm-dir` | `@pmm`, `@prod-ops` |
| **Competitive** | competitor, market share, win/loss, differentiation | `@ci` | `@pmm` for positioning |
| **Strategy/Vision** | vision, strategy, direction, portfolio, bet | `@vp-product` | `@bizops` for analysis |
| **Roadmap** | roadmap, prioritization, timeline, planning | `@pm-dir` | `@pm` for details |
| **Launch Ops** | readiness, coordination, process, launch checklist | `@prod-ops` | `@pm`, `@pmm` |
| **Customer Outcomes** | adoption, success, health, churn, value | `@value-realization` | `@bizops` |
| **Partnerships** | partner, integration, ecosystem, channel | `@bizdev` | `@ci`, `@bizops` |
| **Design/UX** | user research, usability, design, wireframe | `@ux-lead` | `@pm` |
| **Multi-stakeholder** | "what should we do", "help me decide", portfolio tradeoff | `@plt` | Multiple |

---

## Question Threshold

### ONLY Ask When

1. **Truly ambiguous** - Request could mean opposite things
   - "Should we do X or Y?" when X and Y are mutually exclusive
   - Request references unknown context

2. **Critical info missing** - Cannot proceed without it
   - "Create a PRD for..." but no topic specified
   - References a file that doesn't exist

3. **User explicitly requested options**
   - "What are my options for..."
   - "Help me choose between..."

### NEVER Ask Because

- Multiple agents could handle it (pick the best one)
- Confidence is "medium" (make the decision)
- You want confirmation (just do it)
- You're unsure which skill to use (pick the most likely)

---

## Sub-Agent Spawning

Agents should proactively spawn sub-agents when:

### 1. Specialized Expertise Needed
```
@pm creating PRD → spawns @ux-lead for user research insights
```

### 2. Different RACI Perspective Required
```
@vp-product on pricing → spawns @bizops for financial modeling
```

### 3. Cross-Functional Validation Needed
```
@pmm-dir on launch → spawns @prod-ops for readiness check
```

### How to Spawn Sub-Agents

Agents use the Task tool with `subagent_type: "general-purpose"`:

```
Task tool call:
  subagent_type: "general-purpose"
  description: "UX research input for onboarding PRD"
  prompt: |
    You are the UX Lead. [Load persona from skills/ux-lead/SKILL.md]

    Context: The PM is creating a PRD for the onboarding flow.

    Task: Provide user research insights relevant to onboarding.

    Respond conversationally, starting with "🎨 UX Lead:"
```

### Sub-Agent Response Integration

When sub-agents return:
1. **Incorporate their insights** into your deliverable
2. **Attribute their contribution** in the document
3. **Maintain your voice** - you're still the lead

---

## Approval-Free Operation

### Configuration for Seamless Agent Chains

To prevent constant approval prompts, configure Claude Code permissions:

```json
{
  "permissions": {
    "allow": [
      "Task(product-manager*)",
      "Task(vp-product*)",
      "Task(cpo*)",
      "Task(director-product-management*)",
      "Task(director-product-marketing*)",
      "Task(product-marketing-manager*)",
      "Task(bizops*)",
      "Task(bizdev*)",
      "Task(competitive-intelligence*)",
      "Task(product-operations*)",
      "Task(ux-lead*)",
      "Task(value-realization*)",
      "Task(product-leadership-team*)",
      "Skill(*)"
    ]
  }
}
```

### What This Enables

- Agent chains run to completion without interruption
- Sub-agents spawn and return seamlessly
- PLT sessions collect all perspectives in parallel
- Complex workflows execute as single units

---

## Routing Explanation

When routing, briefly explain the choice (one line):

```
Routing to 📝 Product Manager (best fit for PRD creation with research input)
```

For multi-agent routing:
```
This requires cross-functional input. Spawning:
- 📈 VP Product (strategic perspective)
- 🧮 BizOps (financial analysis)
- 🔭 Competitive Intelligence (market context)
```

---

## Examples

### Example 1: Clear Single Agent
```
User: "I need a PRD for the authentication feature"

Action: Route to @pm immediately
Explanation: "Routing to 📝 Product Manager for PRD creation"
```

### Example 2: Sub-Agent Needed
```
User: "Create a pricing strategy for our enterprise tier"

Action: Route to @bizops, which spawns @ci for market data
Explanation: "Routing to 🧮 BizOps for pricing strategy"
[BizOps internally spawns @ci for competitive pricing data]
```

### Example 3: Multi-Agent Parallel
```
User: "We need to decide whether to launch the enterprise tier in Q2 or Q3"

Action: Spawn @vp-product, @pmm-dir, @bizops in parallel
Explanation: "This is a strategic launch timing decision. Gathering perspectives from VP Product, Director PMM, and BizOps."
```

### Example 4: PLT Required
```
User: "Should we pivot from horizontal to vertical positioning?"

Action: Invoke @plt (full session)
Explanation: "This is a strategic pivot decision requiring PLT discussion."
```

---

## V2V Operating Principle

> "Routing is invisible when done well. Users should feel like they're talking to a team that just gets things done."

The best routing is the one users don't notice - they ask, things happen, value is delivered.
