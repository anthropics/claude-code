---
name: feedback-recall
description: Query past feedback by topic, source, or theme
argument-hint: [topic, feature, or customer segment]
---

Search and synthesize **past feedback** to inform current work.

## V2V Phase

**Cross-phase** - This skill surfaces customer voice before work in any phase.

**Prerequisites**: Feedback captured in the registry
**Outputs used by**: All phases (ensures customer-informed decisions)

## Purpose

Before making decisions, developing features, or analyzing markets, recall what customers and stakeholders have already told us. This skill surfaces relevant past feedback with its analysis and patterns.

## When to Use

Invoke `/feedback-recall [query]` when:
- Starting work on a feature (what have customers said about this area?)
- Making a decision (what feedback supports or challenges this direction?)
- Preparing for customer conversations (what have they told us before?)
- Analyzing a market segment (what patterns exist in their feedback?)
- Validating assumptions (what evidence do we have?)
- Investigating a problem (what related complaints exist?)

## Process

### 1. Parse the Query

Accept various query types, with optional filters:
- **Topic**: `/feedback-recall onboarding` → feedback about onboarding
- **Feature**: `/feedback-recall API integration` → feedback about API
- **Segment**: `/feedback-recall enterprise` → feedback from enterprise customers
- **Source**: `/feedback-recall Acme Corp` → feedback from specific customer
- **Sentiment**: `/feedback-recall negative pricing` → negative pricing feedback
- **Theme**: `/feedback-recall TH-005` → feedback linked to a specific theme
- **Product**: `/feedback-recall onboarding product:AXIA` → filtered to AXIA product
- **Demo**: `/feedback-recall onboarding --include-demo` → include demo data

**Filters**:
- `product:[name]` - Filter to specific product
- `--include-demo` - Include demo data (marked with `[DEMO]`)
- `--demo-only` - Show only demo data (for testing/learning)

### 1b. Check for Production Data (Demo Filtering)

**Before searching**, determine if production data exists:

1. Check main context folders (NOT `context/demo/`):
   - `context/feedback/index.md` - Any non-demo entries?
   - Any files in `context/feedback/[YYYY]/` that aren't demo?

2. Apply demo filtering rule:
   | Production Data? | Flag | Behavior |
   |-----------------|------|----------|
   | No | (any) | Include demo with `[DEMO]` markers |
   | Yes | (none) | **Exclude demo data**, show excluded count |
   | Yes | `--include-demo` | Include demo with `[DEMO]` markers |
   | (any) | `--demo-only` | Only demo data |

3. Demo data is identified by:
   - Path contains `context/demo/`
   - ID contains "DEMO" (e.g., `FB-DEMO-001`)

### 2. Search Feedback Registry

Read `context/feedback/index.md` and search for:
- Topic tag matches
- Source name matches
- Product/feature matches
- Segment matches
- Sentiment matches

For strong matches, read the full feedback entry from `context/feedback/[YYYY]/`.

### 3. Check Themes

Read `context/feedback/themes.md` for:
- Established themes related to the query
- Theme status and trend information
- Aggregated insights across multiple feedback entries

### 4. Synthesize Results

```markdown
## Feedback Recall: [Query]

*Found [N] feedback entries related to "[query]"*

### Summary
[2-3 sentence synthesis of what feedback tells us about this topic]

### Sentiment Overview
| Sentiment | Count | Trend |
|-----------|-------|-------|
| Positive | [N] | [↑/↓/→] |
| Negative | [N] | [↑/↓/→] |
| Neutral | [N] | [↑/↓/→] |

### Key Themes

#### [TH-NNN]: [Theme Name]
- **Status**: [Status]
- **Frequency**: [N] mentions
- **Trend**: [Improving/Stable/Declining]
- **Summary**: [Theme summary]

### Representative Feedback

#### FB-[YYYY]-[NNN]: [Summary]
- **Source**: [Source] ([Segment])
- **Date**: [Date]
- **Sentiment**: [Sentiment]
- **Key Quote**: "[Quote]"
- **Insight**: [Key insight]

[Repeat for top 3-5 most relevant]

### All Related Feedback

| ID | Date | Source | Sentiment | Summary |
|----|------|--------|-----------|---------|
| [ID] | [Date] | [Source] | [Sent] | [Summary] |

### Patterns Observed
- [Pattern 1]
- [Pattern 2]
- [Pattern 3]

### Connections to Context

**Related Decisions**:
- [DR-IDs mentioned in feedback entries]

**Related Bets**:
- [SB-IDs mentioned in feedback entries]

**Assumption Evidence**:
- [A-ID]: [Supported/Challenged] by [N] feedback entries

### Recommendations

Based on this feedback:
1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

### Gaps

Areas where we lack feedback:
- [Gap 1 - consider gathering more data]
- [Gap 2]
```

### 5. Highlight Actionable Insights

Call out:
- Strong patterns that should inform decisions
- Contradictions between feedback entries
- Feedback that challenges current assumptions
- Urgent issues requiring immediate attention
- Opportunities identified across multiple sources

## Instructions

1. Accept query from user (required)
2. Parse optional `product:[name]` filter from query
3. Read `context/feedback/index.md`
4. Read `context/feedback/themes.md`
5. Search for matches across all dimensions
6. If product filter specified, filter results to that product only
7. For top matches, read full feedback entries
8. Synthesize findings into actionable summary
9. Highlight patterns and themes
10. Note connections to decisions, bets, assumptions
11. Identify gaps where more feedback is needed
12. Provide recommendations based on feedback

## Query Examples

```
/feedback-recall pricing
→ All feedback mentioning pricing, value, cost, ROI

/feedback-recall enterprise onboarding
→ Feedback from enterprise segment about onboarding

/feedback-recall negative
→ All negative sentiment feedback

/feedback-recall Acme Corp
→ All feedback from Acme Corp

/feedback-recall API
→ Feedback about API functionality, integrations

/feedback-recall Q4 2025
→ Feedback received in Q4 2025

/feedback-recall feature requests
→ All feature request type feedback

/feedback-recall pricing product:AXIA
→ Pricing feedback for AXIA product only

/feedback-recall product:SKYMOD
→ All feedback for SKYMOD product
```

## If No Feedback Found

```markdown
## Feedback Recall: [Query]

No feedback found matching "[query]".

This could indicate:
1. No feedback has been captured in this area yet
2. Try different keywords: [suggest alternatives]
3. This may be a gap in our customer intelligence

**Recommendation**: Consider gathering feedback in this area through:
- Customer interviews
- Sales team outreach
- Support ticket analysis
- Survey or research study
```

## Integration with Other Skills

- After `/feedback-recall`, consider `/context-recall` for related decisions
- Feedback insights should inform `/decision-record` analysis
- Feedback patterns can validate/invalidate `/strategic-bet` assumptions
- Use findings to enhance `/prd` customer problem sections
