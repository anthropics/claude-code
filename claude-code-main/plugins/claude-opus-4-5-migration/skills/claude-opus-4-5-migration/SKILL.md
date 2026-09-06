---
name: claude-opus-4-5-migration
description: Migrate prompts and code from Claude Sonnet 4.0, Sonnet 4.5, or Opus 4.1 to Opus 4.5. Use when the user wants to update their codebase, prompts, or API calls to use Opus 4.5. Handles model string updates and prompt adjustments for known Opus 4.5 behavioral differences. Does NOT migrate Haiku 4.5.
---

# Opus 4.5 Migration Guide

One-shot migration from Sonnet 4.0, Sonnet 4.5, or Opus 4.1 to Opus 4.5.

## Migration Workflow

1. Search codebase for model strings and API calls
2. Update model strings to Opus 4.5 (see platform-specific strings below)
3. Remove unsupported beta headers
4. Add effort parameter set to `"high"` (see `references/effort.md`)
5. Summarize all changes made
6. Tell the user: "If you encounter any issues with Opus 4.5, let me know and I can help adjust your prompts."

## Model String Updates

Identify which platform the codebase uses, then replace model strings accordingly.

### Unsupported Beta Headers

Remove the `context-1m-2025-08-07` beta header if present—it is not yet supported with Opus 4.5. Leave a comment noting this:

```python
# Note: 1M context beta (context-1m-2025-08-07) not yet supported with Opus 4.5
```

### Target Model Strings (Opus 4.5)

| Platform | Opus 4.5 Model String |
|----------|----------------------|
| Anthropic API (1P) | `claude-opus-4-5-20251101` |
| AWS Bedrock | `anthropic.claude-opus-4-5-20251101-v1:0` |
| Google Vertex AI | `claude-opus-4-5@20251101` |
| Azure AI Foundry | `claude-opus-4-5-20251101` |

### Source Model Strings to Replace

| Source Model | Anthropic API (1P) | AWS Bedrock | Google Vertex AI |
|--------------|-------------------|-------------|------------------|
| Sonnet 4.0 | `claude-sonnet-4-20250514` | `anthropic.claude-sonnet-4-20250514-v1:0` | `claude-sonnet-4@20250514` |
| Sonnet 4.5 | `claude-sonnet-4-5-20250929` | `anthropic.claude-sonnet-4-5-20250929-v1:0` | `claude-sonnet-4-5@20250929` |
| Opus 4.1 | `claude-opus-4-1-20250422` | `anthropic.claude-opus-4-1-20250422-v1:0` | `claude-opus-4-1@20250422` |

**Do NOT migrate**: Any Haiku models (e.g., `claude-haiku-4-5-20251001`).

## Prompt Adjustments

Opus 4.5 has known behavioral differences from previous models. **Only apply these fixes if the user explicitly requests them or reports a specific issue.** By default, just update model strings.

**Integration guidelines**: When adding snippets, don't just append them to prompts. Integrate them thoughtfully:
- Use XML tags (e.g., `<code_guidelines>`, `<tool_usage>`) to organize additions
- Match the style and structure of the existing prompt
- Place snippets in logical locations (e.g., coding guidelines near other coding instructions)
- If the prompt already uses XML tags, add new content within appropriate existing tags or create consistent new ones

### 1. Tool Overtriggering

Opus 4.5 is more responsive to system prompts. Aggressive language that prevented undertriggering on previous models may now cause overtriggering.

**Apply if**: User reports tools being called too frequently or unnecessarily.

**Find and soften**:
- `CRITICAL:` → remove or soften
- `You MUST...` → `You should...`
- `ALWAYS do X` → `Do X`
- `NEVER skip...` → `Don't skip...`
- `REQUIRED` → remove or soften

Only apply to tool-triggering instructions. Leave other uses of emphasis alone.

### 2. Over-Engineering Prevention

Opus 4.5 tends to create extra files, add unnecessary abstractions, or build unrequested flexibility.

**Apply if**: User reports unwanted files, excessive abstraction, or unrequested features. Add the snippet from `references/prompt-snippets.md`.

### 3. Code Exploration

Opus 4.5 can be overly conservative about exploring code, proposing solutions without reading files.

**Apply if**: User reports the model proposing fixes without inspecting relevant code. Add the snippet from `references/prompt-snippets.md`.

### 4. Frontend Design

**Apply if**: User requests improved frontend design quality or reports generic-looking outputs.

Add the frontend aesthetics snippet from `references/prompt-snippets.md`.

### 5. Thinking Sensitivity

When extended thinking is not enabled (the default), Opus 4.5 is particularly sensitive to the word "think" and its variants. Extended thinking is enabled only if the API request contains a `thinking` parameter.

**Apply if**: User reports issues related to "thinking" while extended thinking is not enabled (no `thinking` parameter in request).

Replace "think" with alternatives like "consider," "believe," or "evaluate."

## Reference

See `references/prompt-snippets.md` for the full text of each snippet to add.

See `references/effort.md` for configuring the effort parameter (only if user requests it).
