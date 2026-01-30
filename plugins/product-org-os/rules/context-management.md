---
globs:
  - "**/*"
---

# Context Management Rules

The Context Layer provides organizational memory across sessions and agents. Follow these rules to maintain context integrity.

## Core Behaviors

### Auto-Registration of Strategic Documents (MANDATORY)

**ALL skill outputs that produce strategic documents MUST be auto-registered.** This happens silently - no prompting the user.

When a skill completes and writes a document to the filesystem:

1. **Auto-register immediately**: Add entry to `context/documents/index.md`
2. **Capture metadata**:
   - Generate ID: `DOC-[YYYY]-[NNN]`
   - Title: From document H1 or filename
   - Type: Based on skill used (see Document Types table)
   - Skill: The skill that generated it
   - Date: Current date
   - Owner: From session context
   - Product: If multi-product org, from context
   - Location: File path where document was written
   - Tags: Auto-generated from content
3. **Cross-reference**: Link to related decisions/bets if mentioned

**Skills that trigger auto-registration:**

| V2V Phase | Skills |
|-----------|--------|
| Phase 1 | `/strategic-intent`, `/vision-statement`, `/market-analysis`, `/competitive-landscape`, `/competitive-analysis`, `/market-segment` |
| Phase 2 | `/business-case`, `/business-plan`, `/pricing-strategy`, `/pricing-model`, `/positioning-statement`, `/decision-record`, `/strategic-bet`, `/decision-charter`, `/escalation-rule`, `/portfolio-tradeoff` |
| Phase 3 | `/product-roadmap`, `/roadmap-theme`, `/roadmap-item`, `/gtm-strategy`, `/gtm-brief`, `/launch-plan`, `/strategy-communication`, `/prd`, `/prd-outline`, `/feature-spec`, `/user-story` |
| Phase 4 | `/campaign-brief`, `/sales-enablement`, `/stakeholder-brief`, `/launch-readiness` |
| Phase 5 | `/onboarding-playbook`, `/value-realization-report`, `/customer-health-scorecard` |
| Phase 6 | `/qbr-deck`, `/outcome-review`, `/retrospective` |

**Exclusions** (do NOT auto-register):
- Assessments/checks: `/maturity-check`, `/pm-level-check`, `/phase-check`, `/commitment-check`, `/ownership-map`, `/customer-value-trace`, `/collaboration-check`, `/scale-check`
- Context operations: `/context-save`, `/context-recall`, `/portfolio-status`, `/handoff`, `/feedback-capture`, `/feedback-recall`, `/interaction-recall`
- Utility: `/setup`, `/present`

### After Creating Decisions or Bets

When you complete a `/decision-record` or `/strategic-bet`:

1. **Auto-register the document** (per above rules)
2. **Also save to context registry**: Run `/context-save` to:
   - Add entry to the appropriate index (decisions/bets)
   - Extract assumptions to the assumption registry
   - Update portfolio if it's an active bet

### Before Making Decisions

When asked to make or analyze a decision:

1. **Check for prior context**: Run `/context-recall [topic]` to find:
   - Related past decisions
   - Active strategic bets that may constrain choices
   - Relevant assumptions and their status
   - Applicable learnings
2. **Reference findings**: Incorporate relevant context into your analysis
3. **Flag conflicts**: If the new direction might conflict with past decisions, highlight this

### Before Delegating to Another Agent

When you need to invoke another agent for work:

1. **Capture context**: Run `/handoff` to create a briefing document
2. **Include in delegation**: Reference `@context/handoffs/current-session.md` in your delegation prompt
3. **Specify what's inherited**: Make clear what constraints and context the receiving agent should honor

### At Start of Strategic Sessions

When beginning strategic planning or portfolio work:

1. **Check portfolio state**: Run `/portfolio-status` to understand:
   - Current active bets
   - Upcoming checkpoints
   - At-risk assumptions
2. **Align new work**: Ensure proposed work fits within or explicitly changes the portfolio

### After Retrospectives and Outcome Reviews

When completing `/retrospective`, `/outcome-review`, or `/decision-quality-audit`:

1. **Extract learnings**: Offer to save learnings with `/context-save`
2. **Update assumptions**: Mark assumptions as validated or invalidated
3. **Flag re-decisions**: If outcomes trigger re-decision criteria, highlight this

### When Encountering Feedback (MANDATORY)

**ALL agents MUST capture feedback immediately when encountered.** Feedback includes:
- Customer quotes or complaints
- Feature requests from any source
- User research findings
- Sales or support feedback
- Competitive mentions
- Stakeholder input
- Market signals

When you encounter feedback:

1. **Immediately run `/feedback-capture`** - Do not continue without capturing
2. **Record complete metadata**: Source, date, channel, segment, version
3. **Capture verbatim**: Preserve exact words when possible
4. **Analyze and categorize**: Type, sentiment, impact, topics
5. **Make connections**: Link to decisions, bets, assumptions
6. **Check for themes**: Does this reinforce an existing pattern?

### Before Starting Work in an Area

When beginning work on a feature, decision, or analysis:

1. **Check feedback history**: Run `/feedback-recall [topic]` to see what customers have said
2. **Identify patterns**: Look for themes that should inform your work
3. **Note gaps**: If no feedback exists, consider whether to gather some

### V2V Phase Awareness

When working on any initiative:

1. **Identify current phase**: Use `/phase-check [initiative]` to assess:
   - Which V2V phase the work belongs to
   - Whether prerequisites from earlier phases exist
   - What deliverables are expected at this phase
2. **Verify prerequisites**: Before Phase 3 (commitments), ensure Phase 1-2 work exists
3. **Use appropriate skills**: Match skills to the current phase (see `reference/v2v-skill-map.md`)

### Before Major Commitments (Phase 2→3)

When crossing the "point of no return":

1. **Run commitment validation**: Use `/commitment-check [initiative]` to verify:
   - Phase 1 and Phase 2 prerequisites complete
   - Ownership chain is clear
   - Assumptions are explicit
2. **Run principle validators**:
   - `/ownership-map` - Is there single accountability end-to-end?
   - `/customer-value-trace` - Does this trace to customer value?
   - `/collaboration-check` - Were stakeholders consulted?
   - `/scale-check` - Will this work at scale?
3. **Document the commitment**: Save with `/context-save`

### Principle Validation Triggers

Use principle validators at these key points:

| Trigger | Run These Validators |
|---------|---------------------|
| Creating commitments | `/ownership-map`, `/commitment-check` |
| Making decisions | `/customer-value-trace`, `/collaboration-check` |
| Committing resources | `/scale-check` |
| Phase transitions | `/phase-check` |

### After Agent/Gateway/Skill Interactions (Interaction Logging)

After every loggable interaction (agent spawns, gateway invocations, skill deliverables), log to the interaction history. See `rules/interaction-logging.md` for the complete logging protocol.

**Quick reference** — the parent session must:
1. Read `context/interactions/index.json` to get `nextId`
2. Generate entry ID (`IX-YYYY-NNNNN`)
3. Append markdown entry to `context/interactions/YYYY/YYYY-MM-DD.md`
4. Update `index.json` (entries array + topic/agent/date indexes)
5. Update `context/interactions/current-session.md`

**Exclusions** (do NOT log):
- Context retrieval: `/context-recall`, `/feedback-recall`, `/relevant-learnings`, `/portfolio-status`, `/interaction-recall`
- Assessments/checks: `/maturity-check`, `/pm-level-check`, `/phase-check`
- System operations: `/setup`, `/clear-demo`, `/reset-demo`
- Simple greetings, meta-questions, failed operations

### After Completing ANY Skill or Agent Task (MANDATORY)

**Display ROI inline after every skill/agent completion.** This is non-negotiable per `rules/roi-display.md`.

**SCOPE**: ROI reflects PRODUCT WORK (strategy, decisions, requirements, GTM, analysis, documentation) - NOT coding/development effort.

1. **Calculate time saved**:
   - Look up base time in `reference/roi-baselines.md`
   - Apply complexity factor (Simple: 0.5×, Standard: 1.0×, Complex: 1.5×, Enterprise: 2.0×)

2. **Display single line**:
   ```
   ⏱️ ~[X] min saved (vs. [brief manual equivalent])
   ```

3. **Skip ONLY for**:
   - Context retrieval: `/context-recall`, `/feedback-recall`, `/relevant-learnings`, `/portfolio-status`
   - Pure assessments: `/phase-check` (no deliverable)
   - System operations: `/setup`, `/clear-demo`, `/reset-demo`
   - Failed operations

**This makes ROI visible on every interaction - the primary Free → Pro conversion driver.**

## Context File Locations

| Content Type | Index Location | Full Records |
|--------------|----------------|--------------|
| **Documents** | `context/documents/index.md` | (referenced by path) |
| Decisions | `context/decisions/index.md` | `context/decisions/[YYYY]/` |
| Strategic Bets | `context/bets/index.md` | `context/bets/[YYYY]/` |
| Assumptions | `context/assumptions/registry.md` | (in registry) |
| Portfolio State | `context/portfolio/active-bets.md` | (in file, includes V2V phase tracking) |
| Learnings | `context/learnings/index.md` | (in index) |
| Handoffs | `context/handoffs/current-session.md` | (overwritten) |
| Feedback | `context/feedback/index.md` | `context/feedback/[YYYY]/` |
| Themes | `context/feedback/themes.md` | (in file) |
| Principles | `context/principles/scorecard.md` | (in file) |
| Interactions | `context/interactions/index.json` | `context/interactions/[YYYY]/` |

## Multi-Product Organizations

For organizations managing multiple products (e.g., a holding company with several product lines), the context layer supports an optional `product:` field for filtering and organization.

### How It Works

- **Single-product organizations**: Ignore the product field entirely. Everything works as before.
- **Multi-product organizations**: Add a `Product` field to records and use `product:` filter in queries.

### Product Field in Records

When creating decisions, bets, or feedback for a specific product:

```markdown
**Product**: AXIA
```

When a record applies across products or at the holding company level:
- Leave blank, or
- Use `Product: [Company Name]` or `Product: all`

### Filtering by Product

Use the `product:` filter in recall commands:

```
/context-recall pricing product:AXIA
→ Returns only pricing-related context for AXIA

/feedback-recall onboarding product:SKYMOD
→ Returns only onboarding feedback for SKYMOD

/portfolio-status product:AXIA
→ Returns portfolio for AXIA only

/context-recall pricing
→ Returns pricing context across ALL products (no filter)
```

### Index File Format

Index files include an optional Product column:

```markdown
| ID | Title | Date | Owner | Product | Status | Tags |
|----|-------|------|-------|---------|--------|------|
| DR-2026-001 | API Pricing | 2026-01-15 | @pm | AXIA | Accepted | pricing, api |
| DR-2026-002 | Brand Guidelines | 2026-01-20 | @marketing | SKYMOD | Accepted | brand |
| DR-2026-003 | Shared Infra | 2026-01-22 | @cto | | Accepted | infra |
```

Records without a Product value are considered cross-product or unscoped.

### Best Practices

1. **Be consistent**: Use the same product names throughout (e.g., always "AXIA", not "Axia" or "axia")
2. **Cross-product items**: Explicitly mark items that span products, or leave Product blank
3. **Product-level portfolios**: Consider separate portfolio views per product using `/portfolio-status product:AXIA`
4. **Learnings**: Some learnings apply broadly - don't over-filter these

### Plugin Portability

This feature is **fully optional**. Organizations with a single product can ignore it completely:
- The product field is optional in all templates
- If no product filter is specified, queries return all results
- Index files work with or without the Product column

## ID Conventions

- **Documents**: `DOC-[YYYY]-[NNN]` (e.g., DOC-2026-001)
- **Decisions**: `DR-[YYYY]-[NNN]` (e.g., DR-2026-001)
- **Strategic Bets**: `SB-[YYYY]-[NNN]` (e.g., SB-2026-003)
- **Assumptions**: `A-[NNN]` (sequential, e.g., A-015)
- **Learnings**: `L-[NNN]` (sequential, e.g., L-042)
- **Feedback**: `FB-[YYYY]-[NNN]` (e.g., FB-2026-001)
- **Themes**: `TH-[NNN]` (sequential, e.g., TH-005)
- **Interactions**: `IX-[YYYY]-[NNNNN]` (e.g., IX-2026-00042)

## Quality Standards

### For Documents (Auto-Registered)
- File path is accurate and accessible
- Title reflects document purpose
- Tags enable searchability
- V2V phase is correctly identified
- Product is specified (if multi-product org)

### For Decisions
- Single accountable owner (not a team)
- Measurable success criteria
- Specific re-decision triggers
- Tags for searchability

### For Assumptions
- Clear, testable statement
- Defined validation method
- Validation timeline
- Link to source decision/bet

### For Learnings
- One clear insight per learning
- Evidence supporting the learning
- Guidance on when to apply
- Confidence level

### For Feedback
- Raw feedback captured verbatim
- Complete metadata (source, date, channel, segment)
- Analysis with sentiment and impact assessment
- Categorization with searchable topics
- Connections to decisions, bets, assumptions

### For Themes
- Minimum 3 feedback entries to establish
- Clear pattern description
- Status tracking (Emerging → Established → Addressed)
- Linked supporting feedback

## Maintenance

- **Weekly**: No action needed (indexes are updated on save)
- **Quarterly**: Archive completed/invalidated items
- **Annually**: Move old records to `context/archive/[YYYY]/`

## V2V Operating Principle

> "Organizational memory is a competitive advantage. Document decisions not for bureaucracy, but for learning velocity."

The context layer embodies the V2V learning loop: decisions lead to outcomes, outcomes validate assumptions, validated/invalidated assumptions become learnings, learnings improve future decisions.
