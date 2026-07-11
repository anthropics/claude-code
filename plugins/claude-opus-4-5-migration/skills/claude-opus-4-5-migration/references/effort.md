# Effort Parameter

Configure effort only when the user explicitly requests an effort level. A model-string migration by itself must not add or change effort. Opus 4.5 already defaults to `high`, so explicitly adding `high` without a request is redundant and changes the request payload unnecessarily.

## Overview

Effort controls how eagerly Claude spends tokens. It affects all tokens: thinking, text responses, and function calls.

| Effort | Use Case |
|--------|----------|
| `high` | Best performance, deep reasoning (default) |
| `medium` | Balance of cost/latency vs. performance |
| `low` | Simple, high-volume queries; significant token savings |

## Implementation

Use `output_config.effort`. Effort is generally available for Opus 4.5 and does not require a beta header.

**Python SDK:**
```python
response = client.messages.create(
    model="claude-opus-4-5-20251101",
    max_tokens=1024,
    output_config={
        "effort": "medium"  # or "high" or "low"
    },
    messages=[{"role": "user", "content": "Hello"}]
)
```

**TypeScript SDK:**
```typescript
const response = await client.messages.create({
  model: "claude-opus-4-5-20251101",
  max_tokens: 1024,
  output_config: {
    effort: "medium"  // or "high" or "low"
  },
  messages: [{ role: "user", content: "Hello" }]
});
```

**Raw API:**
```json
{
  "model": "claude-opus-4-5-20251101",
  "max_tokens": 1024,
  "output_config": {
    "effort": "medium"
  },
  "messages": [{"role": "user", "content": "Hello"}]
}
```

## Effort vs. Thinking Budget

Effort is independent of thinking budget:

- High effort + no thinking = more tokens, but no thinking tokens
- High effort + 32k thinking = more tokens, but thinking capped at 32k

## Recommendations

1. Do not add or change effort unless the user explicitly asks for it
2. When requested, determine the effort level before setting a thinking budget
3. Best performance: high effort + high thinking budget
4. Cost/latency optimization: medium effort
5. Simple high-volume queries: low effort
