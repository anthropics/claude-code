# ROI Time-Savings Baselines

This reference provides baseline time-savings estimates for skills and agents. Actual savings are calculated dynamically based on complexity factors.

**SCOPE**: All time savings represent **PRODUCT MANAGEMENT WORK** - research, analysis, writing, stakeholder alignment, documentation, reviews. NOT software development or coding.

---

## Calculation Method

**Formula**: `Base Time × Complexity Factor = Estimated Savings`

Time savings represent the manual **product work** effort - research, writing, formatting, stakeholder review, iteration, alignment meetings - that the skill automates.

---

## Complexity Factors

| Factor | Multiplier | Applied When |
|--------|------------|--------------|
| Simple | 0.5× | Single topic, minimal research, straightforward |
| Standard | 1.0× | Typical complexity (default) |
| Complex | 1.5× | Multiple stakeholders, significant research |
| Enterprise | 2.0× | Cross-functional, strategic, multi-phase |

---

## Skill Baselines (Minutes)

### Strategy Skills (Phase 1-2)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/strategic-intent` | 180 | Executive alignment + documentation |
| `/vision-statement` | 120 | Research + wordsmithing + iteration |
| `/strategic-bet` | 180 | Analysis + assumption mapping + validation criteria |
| `/decision-record` | 60 | Documentation + stakeholder alignment |
| `/decision-charter` | 90 | Governance design + RACI + approval flow |
| `/portfolio-tradeoff` | 120 | Options analysis + impact assessment |

### Market & Competitive Skills (Phase 1-2)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/market-analysis` | 240 | Research + synthesis + segmentation |
| `/competitive-landscape` | 180 | Competitor research + positioning map |
| `/competitive-analysis` | 120 | Focused competitor comparison |
| `/market-segment` | 90 | Segment definition + sizing |
| `/positioning-statement` | 60 | Messaging framework + differentiation |

### Business & Pricing Skills (Phase 2)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/business-case` | 180 | Financial modeling + justification |
| `/business-plan` | 300 | Comprehensive planning + projections |
| `/pricing-strategy` | 180 | Market analysis + model design |
| `/pricing-model` | 90 | Specific pricing structure |

### Roadmap Skills (Phase 3)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/product-roadmap` | 240 | Prioritization + sequencing + visualization |
| `/roadmap-theme` | 60 | Theme definition + initiatives mapping |
| `/roadmap-item` | 30 | Item specification + dependencies |

### GTM & Launch Skills (Phase 3-4)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/gtm-strategy` | 240 | Cross-functional GTM planning |
| `/gtm-brief` | 60 | Quick GTM summary |
| `/launch-plan` | 180 | Launch coordination + timeline |
| `/launch-readiness` | 45 | Checklist verification |
| `/campaign-brief` | 60 | Campaign specification |
| `/sales-enablement` | 120 | Sales materials + training content |

### Requirements Skills (Phase 3)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/prd` | 240 | Requirements gathering + writing + review |
| `/prd-outline` | 45 | Structure planning |
| `/feature-spec` | 90 | Feature documentation |
| `/user-story` | 20 | Story + acceptance criteria |

### Operations Skills (Phase 4-5)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/stakeholder-brief` | 45 | Communication drafting |
| `/onboarding-playbook` | 120 | Process documentation |
| `/value-realization-report` | 90 | Metrics compilation + analysis |
| `/customer-health-scorecard` | 60 | Health assessment |

### Learning Skills (Phase 6)

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/outcome-review` | 90 | Outcome analysis + learning extraction |
| `/retrospective` | 60 | Team reflection + action items |
| `/decision-quality-audit` | 60 | Process review + recommendations |
| `/qbr-deck` | 180 | Quarterly compilation + presentation |

### Context Skills

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/context-save` | 10 | Documentation + indexing |
| `/context-recall` | 15 | Search + retrieval + synthesis |
| `/feedback-capture` | 15 | Documentation + categorization |
| `/feedback-recall` | 15 | Pattern retrieval |
| `/portfolio-status` | 20 | Status compilation |
| `/relevant-learnings` | 15 | Learning retrieval |
| `/handoff` | 20 | Context packaging |

### Assessment Skills

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/maturity-check` | 45 | Maturity assessment |
| `/pm-level-check` | 30 | Competency assessment |
| `/phase-check` | 15 | Phase verification |
| `/commitment-check` | 30 | Readiness validation |

### Principle Validators

| Skill | Base Time | Manual Equivalent |
|-------|-----------|-------------------|
| `/ownership-map` | 30 | Accountability tracing |
| `/customer-value-trace` | 30 | Value chain validation |
| `/collaboration-check` | 20 | RACI verification |
| `/scale-check` | 30 | Scalability assessment |

---

## Agent Baselines (Minutes)

Agent time savings depend heavily on task complexity. Base times represent typical delegation.

| Agent | Base Time | Typical Tasks |
|-------|-----------|---------------|
| `@pm` | 90 | PRD review, requirements analysis, user stories |
| `@vp-product` | 120 | Strategic direction, pricing decisions, portfolio |
| `@cpo` | 150 | Org design, portfolio decisions, system design |
| `@pm-dir` | 90 | Cross-team coordination, requirements governance |
| `@pmm-dir` | 90 | GTM strategy, positioning, competitive response |
| `@pmm` | 60 | Campaign execution, collateral, research synthesis |
| `@product-mentor` | 45 | Career coaching, stakeholder navigation, CV review, OS optimization |
| `@bizops` | 90 | Business cases, financial analysis, KPI tracking |
| `@bizdev` | 90 | Partnership strategy, deal structuring |
| `@ci` | 60 | Competitive analysis, market research |
| `@prod-ops` | 60 | Process optimization, launch coordination |
| `@ux-lead` | 60 | Design specs, usability assessment |
| `@value-realization` | 60 | ROI analysis, adoption tracking |

### PLT Meeting Mode

| Pattern | Base Time | Manual Equivalent |
|---------|-----------|-------------------|
| `@plt` (full session) | 300 | Coordinating multi-stakeholder meeting |
| `@product` (routing) | 60 | Determining right owner + delegation |

---

## Dynamic Adjustment Examples

### Simple `/prd`
```
Base: 240 min × Simple (0.5) = 120 min saved
Context: Single feature, clear requirements, one user type
```

### Complex `/pricing-strategy`
```
Base: 180 min × Complex (1.5) = 270 min saved
Context: Multiple segments, competitive pressure, tiered model
```

### Enterprise `@plt` Session
```
Base: 300 min × Enterprise (2.0) = 600 min saved
Context: Portfolio tradeoff, cross-functional alignment, strategic bet
```

---

## Usage Notes

1. **Product work only** - All estimates represent PM/product activities (analysis, documentation, alignment), NOT coding or development
2. **Complexity detection is automatic** - Based on prompt length, topic breadth, stakeholder mentions
3. **Conservative estimates** - These represent productive time, not calendar time
4. **Cumulative tracking** - Session totals aggregate across all skill/agent invocations
5. **Learning improves estimates** - Actual usage patterns refine baseline accuracy over time

### Correct ROI Framing Examples
- "~4 hours saved (vs. manual PRD writing + stakeholder reviews)"
- "~2 hours saved (vs. conducting competitive analysis manually)"
- "~90 min saved (vs. documenting decision + aligning stakeholders)"

### INCORRECT ROI Framing (NEVER use)
- "vs. coding this feature" (wrong scope)
- "vs. implementing manually" (wrong scope)
- "vs. building this" (wrong scope)

---

## V2V Operating Principle

> "Time saved is time reinvested in higher-value work. Track it to demonstrate and improve the leverage AI provides to product organizations."
