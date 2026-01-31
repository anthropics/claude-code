---
globs:
  - "**/*"
---

# Operating Principles Enforcement

This rule defines how the 8 V2V Operating Principles are enforced through skills and automated triggers.

## Principle-to-Skill Mapping

| # | Principle | Validator Skill | Enforcement Method |
|---|-----------|-----------------|-------------------|
| 1 | End-to-End Ownership | `/ownership-map` | Map accountability chain |
| 2 | Decision Quality | `/decision-record`, `/decision-quality-audit` | Structured decisions |
| 3 | Customer Obsession | `/customer-value-trace` | Trace to customer value |
| 4 | Strategic Clarity | `/strategic-bet`, `/commitment-check` | Explicit assumptions |
| 5 | Outcome Focus | `/outcome-review` | Outputs vs outcomes |
| 6 | Collaborative Excellence | `/collaboration-check` | RACI validation |
| 7 | Continuous Learning | `/retrospective`, `/context-save` | Learning capture |
| 8 | Scalable Systems | `/scale-check` | Scale assessment |

---

## Auto-Trigger Rules

### When Creating Decisions

After generating a `/decision-record` or `/strategic-bet`:

1. **Suggest customer value trace**: "Would you like to validate customer value alignment? (`/customer-value-trace`)"
2. **Suggest collaboration check**: "Should we verify stakeholder consultation? (`/collaboration-check`)"
3. **Always offer context save**: "Should I save this to the context registry? (`/context-save`)"

### When Making Commitments

Before finalizing `/commitment-check`:

1. **Require ownership map**: Verify end-to-end accountability chain
2. **Verify phase prerequisites**: Check Phase 1 and Phase 2 deliverables exist
3. **Validate assumptions**: Ensure key assumptions are explicit and testable

### When Reviewing Outcomes

After completing `/outcome-review` or `/retrospective`:

1. **Distinguish outputs vs outcomes**: Explicitly separate what was shipped from what was achieved
2. **Validate/invalidate assumptions**: Update assumption registry
3. **Extract learnings**: Offer to save learnings with `/context-save`
4. **Check re-decision triggers**: Flag if any criteria are met

### When Designing Processes or Systems

When creating processes, workflows, or system designs:

1. **Suggest scale check**: "Would you like to assess scalability? (`/scale-check`)"
2. **Consider maturity level**: Match complexity to org maturity

---

## Required Pre-Work Checklist

### For Major Decisions (Decision Records, Strategic Bets)

Before producing the deliverable:

- [ ] **Context check**: `/context-recall [topic]` - Find related past decisions
- [ ] **Feedback check**: `/feedback-recall [topic]` - See customer/market feedback
- [ ] **Phase awareness**: Identify which V2V phase this belongs to

After producing the deliverable:

- [ ] **Customer value trace**: Can trace to customer benefit
- [ ] **Stakeholders consulted**: Right people provided input
- [ ] **Assumptions explicit**: Key assumptions documented

### For Commitments (Roadmaps, Launch Plans, PRDs)

Before producing the deliverable:

- [ ] **Phase 1 complete**: Strategic foundation exists
- [ ] **Phase 2 complete**: Business case approved, pricing defined
- [ ] **Ownership clear**: Single accountable owner identified

After producing the deliverable:

- [ ] **Commitment check**: Run `/commitment-check` before "point of no return"
- [ ] **Ownership map**: End-to-end accountability documented

### For Outcome Reviews

Before producing the deliverable:

- [ ] **Original assumptions**: Retrieve from context registry
- [ ] **Success criteria**: Find original targets

After producing the deliverable:

- [ ] **Outputs vs outcomes**: Clearly distinguished
- [ ] **Assumptions status**: Marked validated/invalidated
- [ ] **Learnings captured**: Saved to context

---

## Principle Validation Details

### Principle 1: End-to-End Ownership

**Validation questions**:
- Who is accountable for the outcome (not just output)?
- Is there a clear ownership chain from strategy to customer value?
- Are there any "orphan" handoffs without ownership transfer?

**Red flags**:
- "The team" is accountable (must be a person)
- Ownership stops at delivery ("we shipped it")
- No one owns post-launch success

### Principle 2: Decision Quality

**Validation questions**:
- Is there a single accountable owner?
- Are success criteria measurable?
- Are re-decision triggers defined?

**Red flags**:
- Decision by committee
- Vague success criteria ("improve user experience")
- No conditions for revisiting

### Principle 3: Customer Obsession

**Validation questions**:
- What customer problem does this solve?
- What evidence supports customer need?
- How will customer benefit be measured?

**Red flags**:
- Internal-only justification
- No customer evidence cited
- Success measured by output, not outcome

### Principle 4: Strategic Clarity

**Validation questions**:
- What are we betting?
- What assumptions are we making?
- What would prove us wrong?

**Red flags**:
- Hidden assumptions
- No explicit tradeoffs
- Can't articulate the bet

### Principle 5: Outcome Focus

**Validation questions**:
- What outcome (not output) are we targeting?
- How will we know we succeeded?
- What's the leading indicator? Lagging indicator?

**Red flags**:
- Success = shipped
- Only measuring activity
- No distinction between output and outcome

### Principle 6: Collaborative Excellence

**Validation questions**:
- Who should have input?
- Were they consulted?
- Who is affected and informed?

**Red flags**:
- Surprised stakeholders
- Late-stage rework requests
- "We didn't know about this"

### Principle 7: Continuous Learning

**Validation questions**:
- What did we learn?
- How is it documented?
- How will it be applied?

**Red flags**:
- No retrospectives
- Lessons not written down
- Same mistakes repeated

### Principle 8: Scalable Systems

**Validation questions**:
- Does this work at 2x scale?
- Does this work at 10x scale?
- What breaks at 100x?

**Red flags**:
- Over-engineered for current size
- No consideration of growth
- Processes that require heroes

---

## Enforcement in Skills

### Enhanced Decision Record

The `/decision-record` skill includes:
- **Customer Value Link**: How does this trace to customer benefit?
- **Stakeholders Consulted**: Who provided input?
- **Assumptions**: What are we assuming is true?

### Enhanced Strategic Bet

The `/strategic-bet` skill includes:
- **Customer Evidence**: What customer data supports this bet?
- **Scalability Consideration**: Does this approach scale?

### Enhanced Outcome Review

The `/outcome-review` skill includes:
- **Outputs vs Outcomes**: Explicit section distinguishing them

### Enhanced Commitment Check

The `/commitment-check` skill includes:
- **Ownership Chain**: End-to-end accountability mapping
- **Phase Prerequisites**: Verification of Phase 1 and Phase 2 completion

---

## V2V Operating Principle

> "Principles without enforcement are platitudes. Build the principles into the tools so they become habitual, not heroic."
