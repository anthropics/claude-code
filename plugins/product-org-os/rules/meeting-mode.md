# Meeting Mode (MANDATORY)

This rule governs how multi-agent responses are presented to users. **Violations of this rule undermine the entire value proposition of the Product Org OS.**

---

## The Fundamental Principle

> **Users invoke agents to hear FROM those agents, not ABOUT those agents.**

When a user invokes `@plt`, `@pm`, or any agent, they expect to hear that agent's voice - not a summary, not a paraphrase, not "the agent said."

---

## HARD PROHIBITIONS (NEVER DO THESE)

### NEVER Summarize Agent Responses

**WRONG:**
```
The agents provided their perspectives. Here's a summary of their findings...
```

**WRONG:**
```
After gathering input from the team, the key themes are...
```

**WRONG:**
```
The PM agent reviewed the document and found several gaps...
```

### NEVER Speak About Agents in Third Person

**WRONG:**
```
The VP Product expressed concern about...
```

**RIGHT:**
```
**📈 VP Product:**
"I'm concerned about..."
```

### NEVER Hide Agent Voices Behind Synthesis

**WRONG:**
```
## Summary
Based on cross-functional input, we recommend...
```

**RIGHT:**
```
**📈 VP Product:**
"From a strategic perspective..."

**📋 Director PM:**
"On the delivery side..."

---
## Synthesis
Based on the above perspectives, we recommend...
```

### NEVER Combine Multiple Agent Perspectives Into One Voice

**WRONG:**
```
The leadership team believes we should prioritize feature X because of market timing and resource availability.
```

**RIGHT:**
```
### Director PMM:
"Market timing is critical - we need to launch before Q3."

### Director PM:
"We have the resources if we delay the API project."

---
**Alignment**: Both agree on prioritizing feature X.
```

---

## MANDATORY Response Structure

When presenting responses from spawned agents, you MUST follow this structure:

### Step 1: Show Who's Being Consulted
```markdown
## [Topic]

**Present**: [List of agents/roles]

---
```

### Step 2: Show Each Agent's Response WITH ATTRIBUTION
```markdown
### [Role Name]:
"[Direct quote or first-person response from the agent]"

### [Role Name]:
"[Direct quote or first-person response from the agent]"

---
```

### Step 3: ONLY THEN Provide Synthesis
```markdown
## Points of Agreement
- [What they align on]

## Points of Tension
- [Where they disagree]

## Synthesis / Recommendation
[Your synthesis AFTER showing individual voices]
```

---

## Self-Check Before Responding (MANDATORY)

**Before sending ANY response that involves agent outputs, ask yourself:**

1. [ ] Can the user see each agent's individual perspective?
2. [ ] Is each agent's contribution attributed with their role name?
3. [ ] Are agents speaking in first person ("I think..." not "The agent thinks...")?
4. [ ] Does synthesis come AFTER individual perspectives, not instead of them?
5. [ ] If I removed the synthesis, would the user still see what each agent said?

**If ANY answer is NO, rewrite your response before sending.**

---

## Why This Is Non-Negotiable

### 1. Trust
Users need to verify that different perspectives were actually considered. Summaries hide the reasoning.

### 2. Learning
Users learn their organization's dynamics by seeing how different roles think. Summaries flatten this.

### 3. Debugging
When a decision goes wrong, users need to trace which perspective missed something. Summaries destroy the audit trail.

### 4. Value Proposition
The entire point of the Product Org OS is simulating a real product organization. In real orgs, you hear from real people - not filtered summaries.

---

## Agent Response Format

When agents respond, they MUST:

1. **Start with their role name in bold**: `**📝 Product Manager:**`
2. **Speak in first person**: "I see...", "My concern is...", "I recommend..."
3. **Be conversational**: Like a colleague in a meeting, not a formal report
4. **Stay in character**: Maintain their role's perspective and priorities

**Example of correct agent response:**

```markdown
**📣 Director of Product Marketing:**

"Looking at this from a market perspective, I have two concerns. First, our positioning against Competitor X is weak if we don't include the integration feature. Second, the timing puts us right in their launch window - we'd be announcing into their news cycle.

My recommendation: either accelerate to beat them by 3 weeks, or delay to let their launch settle. The middle ground is the worst option."
```

---

## Enforcement

### Scope: ALL Agent Responses

This rule applies to **every** agent response presented to a user, regardless of invocation method:

| Invocation | Rule Applies? | Who Enforces |
|------------|---------------|--------------|
| `@pm` (single agent) | YES | Parent session presenting the response |
| `@product` (gateway) | YES | Gateway presenting collected responses |
| `@plt` (PLT gateway) | YES | PLT presenting all perspectives |
| Agent spawns sub-agent | YES | Parent agent presenting sub-agent input |

### Enforcement Mechanism

See `rules/agent-spawn-protocol.md` **Section 10: Parent Session Presentation Requirements** for the binding rules on how to present agent output.

The key insight: **Spawned agents already follow the rules** (via the injection template). The violation happens when the **parent session** converts their first-person responses into third-person summaries or report-style output.

### For PLT Sessions
The `/product-leadership-team` skill MUST spawn separate agents and present their responses individually. Role-playing multiple perspectives yourself is prohibited for FULL PLT sessions.

### For Single Agent Invocations
When a user invokes a single agent (e.g., `@pm`), that agent's response should be clearly attributed and in first person.

### For Parallel Agent Patterns
All agents spawned in parallel must have their responses shown individually before any synthesis.

### For Gateway Execution (`@product`)

When `/product` gateway executes a plan and collects deliverables:

1. **Each agent's completion MUST be presented as them speaking** — not as a status report
2. **"Agent delivered X" is WRONG** — Agent should say "I've completed X, here's what I found..."
3. **Tables of deliverables are supplementary** — They don't replace agent voices
4. **Progress updates can be brief** — But completion messages must show the agent's voice

---

## Common Violations and Fixes

| Violation | Fix |
|-----------|-----|
| "The team agreed that..." | Show each team member's statement, then note agreement |
| "After review, the recommendation is..." | Show the review first, attribute perspectives, then recommend |
| "Key findings include..." | Show who found what, then summarize findings |
| "Concerns were raised about..." | Show who raised which concern |
| "The analysis shows..." | Show who analyzed what, then present results |

---

## V2V Operating Principle

> "In a real organization, you hear from people - not about people. The Product Org OS simulates a real organization. Therefore, users hear from agents - not about agents."
