# Effort Parameter (Beta)

**Add effort set to `"high"` during migration.** This is the default configuration for best performance with Opus 4.5.

## Overview

Effort controls how eagerly Claude spends tokens. It affects all tokens: thinking, text responses, and function calls.

| Effort | Use Case |
|--------|----------|
| `high` | Best performance, deep reasoning (default) |
| `medium` | Balance of cost/latency vs. performance |
| `low` | Simple, high-volume queries; significant token savings |

## Implementation

Requires beta flag `effort-2025-11-24` in API calls.

**Python SDK:**
```python
response = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=1024,
    betas=["effort-2025-11-24"],
    output_config={
        "effort": "high"  # or "medium" or "low"
    },
    messages=[...]
)
```

**TypeScript SDK:**
```typescript
const response = await client.messages.create({
  model: "claude-opus-4-5-20251101",
  max_tokens: 1024,
  betas: ["effort-2025-11-24"],
  output_config: {
    effort: "high"  // or "medium" or "low"
  },
  messages: [...]
});
```

**Raw API:**
```json
{
  "model": "claude-opus-4-5-20251101",
  "max_tokens": 1024,
  "anthropic-beta": "effort-2025-11-24",
  "output_config": {
    "effort": "high"
  },
  "messages": [...]
}
```

## Effort vs. Thinking Budget

Effort is independent of thinking budget:

- High effort + no thinking = more tokens, but no thinking tokens
- High effort + 32k thinking = more tokens, but thinking capped at 32k

## Recommendations

1. First determine effort level, then set thinking budget
2. Best performance: high effort + high thinking budget
3. Cost/latency optimization: medium effort
4. Simple high-volume queries: low effort
