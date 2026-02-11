# Context Cross-Reference Graph

## Purpose

The cross-reference graph connects context entries to each other, enabling agents to follow relationships between decisions, bets, assumptions, feedback, and learnings. This turns flat context records into a navigable knowledge graph.

## Link Types

| From | To | Relationship | Example |
|------|-----|-------------|---------|
| Decision | Bet | Decision made in context of bet | DR-2026-003 → SB-2026-001 |
| Decision | Decision | Decision supersedes or relates to another | DR-2026-005 → DR-2026-002 |
| Bet | Assumption | Bet depends on assumption being true | SB-2026-001 → A-015 |
| Feedback | Decision | Feedback informed or challenges decision | FB-2026-012 → DR-2026-003 |
| Learning | Decision | Learning derived from decision outcome | L-042 → DR-2026-001 |
| Document | Decision | Document created for/by this decision | DOC-2026-005 → DR-2026-003 |
| Document | Bet | Document supports this bet | DOC-2026-008 → SB-2026-002 |
| Feedback | Feedback | Feedback entries form a theme | FB-2026-012 → TH-005 |

## Storage in index.json

Cross-references are stored in the `crossReferences` section of `context/index.json`:

```json
{
  "crossReferences": {
    "decisionToBet": {
      "DR-2026-003": ["SB-2026-001"],
      "DR-2026-005": ["SB-2026-001", "SB-2026-003"]
    },
    "betToAssumption": {
      "SB-2026-001": ["A-015", "A-016"]
    },
    "feedbackToDecision": {
      "FB-2026-012": ["DR-2026-003"]
    },
    "learningToDecision": {
      "L-042": ["DR-2026-001"]
    }
  }
}
```

## Auto-Linking Rules

When `/context-save` creates a new entry:

1. **Scan for ID references**: Look for patterns like DR-*, SB-*, FB-*, A-*, L-*, DOC-* in the entry content
2. **Create bidirectional links**: If DR-2026-005 mentions SB-2026-001, link both directions
3. **Update index.json**: Add to appropriate crossReferences section
4. **Log the link**: Note in the entry metadata what was auto-linked

When `/feedback-capture` records feedback:
1. **Check for decision/bet mentions**: Link feedback to referenced decisions or bets
2. **Check for theme matches**: If feedback matches an existing theme pattern, link to theme
3. **Update theme strength**: Increment theme count if new feedback supports existing theme

## Query Enhancement

When `/context-recall` runs a query:

1. **Find direct matches**: Standard topic/keyword search
2. **Follow cross-references one level**: For each match, include directly-linked items
3. **Attribute the link**: Show why related items appear: `[via: DR-2026-003]`
4. **Limit expansion**: Max 3 cross-referenced items per direct match to prevent noise

### Example Query Result

```
/context-recall pricing

## Direct Matches
- **DR-2026-003**: API pricing model → Accepted
- **DR-2026-007**: Free tier limits → Accepted

## Cross-Referenced (1 level)
- **SB-2026-001**: Enterprise market bet [via: DR-2026-003]
- **FB-2026-012**: Customer billing feedback [via: DR-2026-003]
- **L-042**: Pricing experiment learnings [via: DR-2026-007]
```

## Graph Maintenance

### When to Prune
- When a decision is superseded, mark old links as `superseded`
- When a bet is closed, archive its assumption links
- When feedback themes are addressed, mark theme links as `resolved`

### Integrity Checks
When running `/portfolio-status` or `/context-recall`:
- Verify linked IDs still exist
- Flag broken links (referenced ID not found)
- Suggest cleanup for stale links

## V2V Operating Principle

> "Context without connections is just data. The cross-reference graph turns individual records into organizational intelligence."
