# Auto-Context Injection

## Core Rule

Before agents produce deliverables, automatically inject relevant context from the index. This eliminates the need for manual `/context-recall` for common patterns while preserving the option for explicit queries.

## How It Works

1. **Parse the user's request** for topic keywords (feature names, product areas, decision types)
2. **Query `context/index.json`** topic indexes for matches
3. **If matches found**, include a summary in the agent's working context
4. **Agent sees**: An "Auto-Context" section with related items

## Injection Triggers

| Agent Task | What Gets Injected |
|-----------|-------------------|
| Creating a decision record | Related past decisions on the same topic, active bets in the area |
| Writing a PRD or feature spec | Related feedback, existing decisions, active bets, past learnings |
| Conducting an outcome review | Original bet assumptions, defined success criteria, related feedback |
| Formulating a strategic bet | Related learnings, competitive context, existing decisions |
| Capturing feedback | Related existing feedback themes, connected decisions |
| Creating a roadmap | Active bets, portfolio state, related decisions |
| GTM planning | Related positioning decisions, competitive landscape, pricing decisions |

## Injection Format

When auto-context finds relevant items, present them as:

```
## Auto-Context: [N] related items found

### Related Decisions
- **DR-2026-003**: API pricing model → Accepted (2026-01-15)
  Topics: pricing, api, monetization

### Related Feedback
- **FB-2026-012**: Customer requested usage-based billing (2026-02-01)
  Sentiment: Neutral | Impact: High

### Active Bets
- **SB-2026-001**: Enterprise pricing tier → In Progress
  Key assumption: Enterprise customers need dedicated support

> These were auto-injected based on topic matching. Use `/context-recall [topic]` for deeper queries.
```

## When NOT to Inject

- Simple Q&A that doesn't produce deliverables
- System operations (`/setup`, `/clear-demo`)
- Context retrieval operations (`/context-recall`, `/feedback-recall`) — these ARE the query
- When the user explicitly provides all context needed

## Relevance Matching

Topic matching uses these strategies:
1. **Exact ID match**: If request mentions DR-2026-003, inject that record
2. **Keyword match**: Match request keywords against `topicIndex` in index.json
3. **Product match**: If multi-product org, filter by product context
4. **Phase match**: Match V2V phase of the task to phase-indexed items

## Depth Control

- **Default**: Inject up to 5 most relevant items (brief summaries)
- **Deep mode**: When explicitly requested, inject full records
- **Quiet mode**: Skip auto-injection (for speed or when context is known)

## Integration with Context Layer

Auto-context reads from but never writes to the context index. Writing happens through:
- `/context-save` — explicit save
- `/feedback-capture` — explicit capture
- Auto-registration of strategic documents (per `context-management.md`)

## V2V Operating Principle

> "The best context system is invisible. Agents should work with organizational memory naturally, not through manual lookups."
