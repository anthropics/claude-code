# Feedback Registry

*Last updated: —*

## All Captured Feedback

| ID | Date | Source Type | Source | Topic | Sentiment | Linked To |
|----|------|-------------|--------|-------|-----------|-----------|
| — | No feedback captured yet | — | — | — | — | — |

## Quick Filters

### By Source Type
- **Customer**: —
- **Prospect**: —
- **Sales**: —
- **Support**: —
- **User Research**: —
- **Market Research**: —
- **Internal**: —

### By Sentiment
- **Positive**: —
- **Neutral**: —
- **Negative**: —
- **Mixed**: —

### By Topic
*Topics will appear here as feedback is captured*

## Recent Feedback
*Most recent feedback will appear here*

---

## Feedback Entry Format

Each feedback entry is stored in `context/feedback/[YYYY]/FB-[YYYY]-[NNN].md` with:

```markdown
# Feedback: FB-[YYYY]-[NNN]

## Metadata
| Field | Value |
|-------|-------|
| **ID** | FB-[YYYY]-[NNN] |
| **Captured Date** | [When captured] |
| **Feedback Date** | [When feedback was given] |
| **Source Type** | Customer / Prospect / Sales / Support / Research / Internal |
| **Source Name** | [Person/company/study name] |
| **Source Role** | [Role/title if known] |
| **Product/Feature** | [What it relates to] |
| **Product Version** | [Version if applicable] |
| **Channel** | Interview / Survey / Support Ticket / Sales Call / Email / Social / Other |
| **Captured By** | [Agent that captured it] |

## Raw Feedback
[Exact quote or description of the feedback]

## Analysis

### Summary
[1-2 sentence summary of the feedback]

### Key Insights
- [Insight 1]
- [Insight 2]

### Sentiment
[Positive / Negative / Neutral / Mixed] - [Brief explanation]

### Impact Assessment
| Dimension | Rating | Notes |
|-----------|--------|-------|
| Urgency | High/Med/Low | [Why] |
| Frequency | First/Recurring | [Pattern notes] |
| Revenue Impact | High/Med/Low | [If known] |
| Strategic Relevance | High/Med/Low | [Which bet/decision it affects] |

### Categorization
- **Type**: Bug / Feature Request / Usability / Pricing / Support / General
- **Topics**: [tag1], [tag2], [tag3]
- **Segment**: [Customer segment if known]

## Connections

### Related Feedback
- [Links to similar feedback entries]

### Linked Decisions
- [DR-ID if this validates/invalidates a decision]

### Linked Bets
- [SB-ID if this relates to a strategic bet]

### Linked Assumptions
- [A-ID if this validates/invalidates an assumption]

## Recommended Actions
- [ ] [Action 1]
- [ ] [Action 2]

## Follow-up Status
| Date | Action | Owner | Status |
|------|--------|-------|--------|
| — | — | — | — |
```

## How to Capture Feedback

When any agent encounters feedback, they should run `/feedback-capture` to:
1. Extract metadata (source, timing, channel)
2. Record raw feedback verbatim
3. Analyze and categorize
4. Link to related context (decisions, bets, assumptions)
5. Save to this registry
