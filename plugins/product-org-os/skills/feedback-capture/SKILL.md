---
name: feedback-capture
description: Capture and analyze product feedback with full metadata
argument-hint: [paste feedback or describe source]
---

Capture, document, and analyze **product feedback** with complete metadata and structured analysis.

## V2V Phase

**Phase 6: Learning & Adaptation** - Feedback capture is the input to the learning loop.

**Prerequisites**: Feedback encountered (customer, sales, support, etc.)
**Outputs used by**: All phases (informs decisions, validates assumptions)

## Auto-Initialization

**Before capturing feedback, ensure the context folder structure exists.** If missing:

1. Check if `context/feedback/` folder exists
2. If not, create:
   - `context/feedback/index.md` (empty registry template)
   - `context/feedback/themes.md` (empty themes template)
3. When saving to `context/feedback/[YYYY]/`, create the year folder if needed

If the entire context structure is missing, inform the user to run `/setup` first.

## Purpose

Every piece of feedback is valuable organizational intelligence. This skill ensures feedback is captured systematically with its source, context, and analysis - enabling pattern recognition and informed decision-making.

## CRITICAL: When to Use

**Agents MUST invoke `/feedback-capture` whenever they encounter feedback from:**
- Customer conversations or quotes
- Sales call notes or deal feedback
- Support tickets or escalations
- User research findings
- Survey responses
- Product reviews or social mentions
- Internal stakeholder feedback
- Competitive win/loss information
- Partner or channel feedback

**Do not let feedback pass through a conversation without capturing it.**

## Process

### 1. Extract Metadata

Gather all available context about the feedback:

| Field | Description | Required |
|-------|-------------|----------|
| **Feedback Date** | When the feedback was given | Yes |
| **Source Type** | Customer / Prospect / Sales / Support / Research / Internal | Yes |
| **Source Name** | Person, company, or study name | Yes |
| **Source Role** | Title/role if known | If available |
| **Product** | Which product (for multi-product orgs, e.g., AXIA, SKYMOD) | If applicable |
| **Feature** | What feature/area the feedback relates to | Yes |
| **Product Version** | Version number if applicable | If available |
| **Channel** | How feedback was received | Yes |
| **Customer Segment** | Enterprise / SMB / Startup / etc. | If known |
| **Contract Value** | ARR or deal size if known | If available |

### 2. Record Raw Feedback

Capture the feedback verbatim or as close to original as possible:
- Direct quotes are preferred
- If paraphrasing, note it
- Include relevant context around the quote
- Preserve the customer's language and terminology

### 3. Analyze the Feedback

#### Summary
Write a 1-2 sentence summary of the core feedback.

#### Key Insights
Extract 2-4 specific insights from the feedback:
- What is the underlying need or problem?
- What would success look like for this person?
- What's blocking them currently?

#### Sentiment Assessment
- **Positive**: Praise, satisfaction, advocacy
- **Negative**: Complaint, frustration, churn risk
- **Neutral**: Informational, neither positive nor negative
- **Mixed**: Contains both positive and negative elements

#### Impact Assessment

| Dimension | How to Assess |
|-----------|---------------|
| **Urgency** | Is this blocking the customer? Time-sensitive? |
| **Frequency** | First time hearing this, or recurring pattern? |
| **Revenue Impact** | Risk to existing revenue or opportunity for expansion? |
| **Strategic Relevance** | Does this relate to an active strategic bet? |

#### Categorization
- **Type**: Bug / Feature Request / Usability / Pricing / Support / General
- **Topics**: Assign 2-5 topic tags for searchability
- **Segment**: Customer segment if identifiable

### 4. Make Connections

Check the context registry for related items:

#### Related Feedback
- Run `/feedback-recall [topic]` to find similar past feedback
- Link to related entries if this reinforces a pattern

#### Linked Decisions
- Does this feedback validate or challenge a past decision?
- Reference relevant DR-IDs

#### Linked Bets
- Does this relate to an active strategic bet?
- Reference relevant SB-IDs

#### Linked Assumptions
- Does this validate or invalidate a tracked assumption?
- Reference relevant A-IDs
- **If an assumption is invalidated, flag for re-decision**

### 5. Recommend Actions

Based on the analysis:
- What should be done with this feedback?
- Who should be informed?
- Should this trigger a follow-up?

### 6. Save to Registry

1. Generate feedback ID: `FB-[YYYY]-[NNN]` (check index for next number)
2. Create full entry file: `context/feedback/[YYYY]/FB-[YYYY]-[NNN].md`
3. Update `context/feedback/index.md` with summary row
4. Check if this creates/strengthens a theme in `context/feedback/themes.md`

### 7. Report Capture

Confirm what was saved:
```
Feedback captured: FB-2026-015
- Source: [Customer Name] ([Segment])
- Topic: [Main topic]
- Sentiment: [Sentiment]
- Linked to: [Any connections]
- Theme contribution: [If applicable]
```

## Output Template

```markdown
# Feedback: FB-[YYYY]-[NNN]

## Metadata
| Field | Value |
|-------|-------|
| **ID** | FB-[YYYY]-[NNN] |
| **Captured Date** | [Today] |
| **Feedback Date** | [When given] |
| **Source Type** | [Type] |
| **Source Name** | [Name] |
| **Source Role** | [Role] |
| **Product** | [Product name - for multi-product orgs] |
| **Feature** | [Feature/area] |
| **Product Version** | [Version] |
| **Channel** | [Channel] |
| **Captured By** | @[agent] |

## Raw Feedback

> "[Exact quote or close paraphrase]"

[Additional context if needed]

## Analysis

### Summary
[1-2 sentence summary]

### Key Insights
1. [Insight 1]
2. [Insight 2]
3. [Insight 3]

### Sentiment
**[Positive/Negative/Neutral/Mixed]** — [Brief explanation]

### Impact Assessment
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Urgency | [H/M/L] | [Why] |
| Frequency | [First/Recurring] | [Notes] |
| Revenue Impact | [H/M/L] | [Notes] |
| Strategic Relevance | [H/M/L] | [Which bet] |

### Categorization
- **Type**: [Type]
- **Topics**: [tag1], [tag2], [tag3]
- **Segment**: [Segment]

## Connections

### Related Feedback
- [FB-IDs of similar feedback]

### Linked Decisions
- [DR-IDs] — [How it relates]

### Linked Bets
- [SB-IDs] — [How it relates]

### Linked Assumptions
- [A-IDs] — [Validates/Invalidates]

## Recommended Actions
- [ ] [Action 1]
- [ ] [Action 2]
```

## Instructions

1. When encountering ANY feedback, immediately invoke this skill
2. Ask clarifying questions if metadata is missing
3. Always capture raw feedback verbatim when possible
4. Always perform analysis - don't just store raw data
5. Always check for connections to existing context
6. Always save to the registry
7. Flag if feedback invalidates assumptions or triggers re-decisions
8. Note if feedback contributes to an emerging or established theme

## Theme Detection

After saving, check if this feedback:
- Matches an existing theme → Update theme with new data point
- Shares topics with 2+ other entries → Suggest new emerging theme
- Represents a significant new pattern → Flag for theme consideration
