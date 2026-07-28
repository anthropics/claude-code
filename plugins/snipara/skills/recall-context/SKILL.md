---
name: recall-context
description: Recall previous context, decisions, or learnings from past interactions. Use this when the user references previous work, asks about decisions made earlier, or starts a new session that may benefit from prior context.
---

When the user references previous context or decisions:

1. Use the `mcp__snipara__rlm_recall` tool with:
   - `query`: What to search for in memory
   - `type`: Filter by type (fact, decision, learning, preference, todo, context)
   - `limit`: Number of memories to return (default: 5)

2. At the start of sessions, proactively recall recent context:
   - `rlm_recall(query="recent session context", type="context", limit=3)`

3. Present recalled memories with their relevance scores.

Example recalls:
- "What did we decide about auth?" → query="authentication decision", type="decision"
- "What was I working on?" → query="recent work progress", type="context"
- "What patterns do we use?" → query="coding patterns", type="learning"
