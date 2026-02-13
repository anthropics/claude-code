---
globs:
  - "**/*"
---

# Skill Awareness & Routing

Skill catalog, invocation syntax, routing rules, and agent selection for the V2V Product Org Plugin.

---

## Invocation Syntax (MANDATORY)

| Notation | Tool | Purpose | Example |
|----------|------|---------|---------|
| `/skill-name` | Skill tool | Invoke template/workflow **inline** | `/prd`, `/decision-record` |
| `@agent-name` | Task tool | Spawn **individual autonomous agent** | `@pm`, `@vp-product` |
| `@product`, `@plt` | Skill tool | Trigger **gateway protocol** (Meeting Mode) | `@product launch feature` |
| `@file.md` | Context | Include file contents in conversation | `@strategy.md` |

**Individual Agents** (`@pm`, `@vp-product`): Spawn a single agent via Task tool. One perspective, one voice.
**Gateways** (`@product`, `@plt`): Trigger multi-agent Meeting Mode via Skill tool. Multiple perspectives + synthesis.

### Dual-Mode Invocation

| Mode | Syntax | Behavior | Use Case |
|------|--------|----------|----------|
| **Inline** | `/pm` | Skill tool — Claude adopts persona, continues conversation | Quick back-and-forth |
| **Autonomous** | `@pm` | Task tool — Spawns agent, returns when done | Delegating work |

---

## Automatic Routing (MANDATORY)

When user mentions `@agent` or `@gateway`, **immediately invoke without asking**. When user uses `/skill`, **execute immediately**.

**Do NOT** ask "would you like me to route this?" — just do it.

### Routing Decision Process

1. Explicit `@` or `/` mention → Route to that agent/skill immediately
2. Clear domain keywords → Route to domain owner (see `agent-spawn-protocol.md` Section 6)
3. Multi-domain / ambiguous → Use `/product` gateway
4. Portfolio/strategic tradeoff → Use `/plt` gateway

**Always prefer fewer agents**: 1 over 2, 2 over 3, 3 over PLT.

### Enhanced Decision Matrix

| Intent Pattern | Keywords | Route To |
|----------------|----------|----------|
| Requirements | PRD, feature, user story, spec | `@pm` |
| Pricing/Business | pricing, business case, ROI, financial | `@bizops` |
| GTM/Positioning | launch, positioning, messaging, campaign | `@pmm-dir` |
| Competitive | competitor, market share, win/loss | `@ci` |
| Strategy/Vision | vision, strategy, portfolio, bet | `@vp-product` |
| Roadmap | roadmap, prioritization, planning | `@pm-dir` |
| Launch Ops | readiness, coordination, process | `@prod-ops` |
| Customer Outcomes | adoption, success, health, churn | `@value-realization` |
| Partnerships | partner, ecosystem, channel | `@bizdev` |
| Design/UX | user research, usability, design | `@ux-lead` |
| Multi-stakeholder | "help me decide", portfolio tradeoff | `@plt` |

### Question Threshold

**ONLY ask when**: Truly ambiguous (could mean opposite things), critical info missing (no topic specified), or user explicitly requested options.

**NEVER ask because**: Multiple agents could handle it, confidence is "medium", or you want confirmation.

---

## Document Intelligence

43 document-generating skills support three modes:
- **CREATE**: Default — `/prd authentication`
- **UPDATE**: When using "update", "revise", or providing a path
- **FIND**: When using "find", "search", or "list"

14 context/retrieval skills (context-save, context-recall, portfolio-status, relevant-learnings, handoff, feedback-capture, feedback-recall, interaction-recall, maturity-check, pm-level-check, setup, present, phase-check, interaction-recall) operate differently.

---

## Skills by V2V Phase

| Phase | Skills |
|-------|--------|
| **1. Foundation** | `/strategic-intent`, `/market-analysis`, `/competitive-landscape`, `/competitive-analysis`, `/vision-statement`, `/market-segment` |
| **2. Decisions** | `/business-case`, `/business-plan`, `/pricing-strategy`, `/pricing-model`, `/positioning-statement`, `/decision-record`, `/strategic-bet`, `/decision-charter`, `/escalation-rule` |
| **3. Commitments** | `/product-roadmap`, `/roadmap-theme`, `/roadmap-item`, `/gtm-strategy`, `/gtm-brief`, `/launch-plan`, `/strategy-communication`, `/commitment-check`, `/prd`, `/prd-outline`, `/feature-spec`, `/user-story` |
| **4. Execution** | `/campaign-brief`, `/sales-enablement`, `/launch-readiness`, `/stakeholder-brief` |
| **5. Outcomes** | `/onboarding-playbook`, `/value-realization-report`, `/customer-health-scorecard` |
| **6. Learning** | `/outcome-review`, `/retrospective`, `/decision-quality-audit`, `/relevant-learnings`, `/context-save`, `/feedback-capture` |
| **Cross-Phase** | `/context-recall`, `/feedback-recall`, `/interaction-recall`, `/portfolio-status`, `/portfolio-tradeoff`, `/handoff`, `/qbr-deck`, `/maturity-check`, `/pm-level-check`, `/phase-check`, `/ownership-map`, `/customer-value-trace`, `/collaboration-check`, `/scale-check` |

---

## Skill Selection by Task Type

**Strategic planning**: `/strategic-intent`, `/strategic-bet`, `/vision-statement`
**Market understanding**: `/market-analysis`, `/competitive-landscape`, `/market-segment`
**Commercial decisions**: `/business-case`, `/pricing-strategy`, `/decision-record`
**Execution planning**: `/product-roadmap`, `/gtm-strategy`, `/launch-plan`
**Requirements**: `/prd`, `/feature-spec`, `/user-story`
**Go-to-market**: `/campaign-brief`, `/sales-enablement`, `/launch-readiness`
**Customer success**: `/onboarding-playbook`, `/value-realization-report`
**Learning**: `/outcome-review`, `/retrospective`, `/decision-quality-audit`

**Before decisions**: `/context-recall`, `/feedback-recall`, `/customer-value-trace`
**Before commitments**: `/commitment-check`, `/ownership-map`, `/phase-check`
**After outcomes**: `/outcome-review`, `/scale-check`, `/context-save`

---

## V2V Operating Principle

> "Every skill exists for a reason. Choose the right skill for the task, not the task for the skill you know."

> "Routing is invisible when done well. Users should feel like they're talking to a team that just gets things done."
