---
description: Compare Claude and Codex responses
argument-hint: <question>
allowed-tools: Bash
---

## Your task

Get responses from both Claude (yourself) and OpenAI Codex for the same question, then present a comparison.

### Codex CLI Path
```
/Users/jiusi/Documents/codex/codex-cli/bin/codex.js
```

### Process

1. Check Codex API key:
```bash
[ -n "$OPENAI_API_KEY" ] && echo "OK" || echo "Please set OPENAI_API_KEY"
```

2. Note the user's question

3. Generate YOUR (Claude's) response to the question first

4. Get Codex's response:
```bash
node /Users/jiusi/Documents/codex/codex-cli/bin/codex.js --quiet "<user's question>"
```

5. Present both responses with comparison analysis

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
[Which response might be more suitable for the user's specific case]
```

### Use Cases

- Getting second opinions on code decisions
- Comparing different approaches to a problem
- Understanding different AI perspectives
- Validating complex technical answers
