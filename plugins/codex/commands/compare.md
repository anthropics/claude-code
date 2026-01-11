---
description: Compare Claude and Codex responses
argument-hint: <question>
allowed-tools: [
  "mcp__codex__codex_query",
  "mcp__codex__codex_status"
]
---

## Your task

Get responses from both Claude (yourself) and OpenAI Codex for the same question, then present a comparison.

### Process

1. Check Codex authentication with `codex_status`
2. Note the user's question
3. Generate YOUR (Claude's) response to the question first
4. Call `codex_query` with the same question
5. Present both responses side by side with analysis

### Output Format

```
## Question
{user's question}

---

## Claude's Response
{your response}

---

## Codex's Response
{codex response}

---

## Comparison

### Similarities
- [Points where both agree]

### Differences
- [Key differences in approach or answer]

### Recommendation
[Which response might be more suitable for the user's specific case, or how to combine insights from both]
```

### Use Cases

- Getting second opinions on code decisions
- Comparing different approaches to a problem
- Understanding different AI perspectives
- Validating complex technical answers

### Example

```
/codex:compare "What's the best way to implement rate limiting in Node.js?"
```

### Notes

- Both responses are generated independently
- Useful for critical decisions where multiple perspectives help
- The comparison analysis is provided by Claude (you)
