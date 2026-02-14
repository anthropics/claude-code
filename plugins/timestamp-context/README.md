# timestamp-context

Injects the current local time into Claude's conversation context on every message via a `UserPromptSubmit` hook.

## Why

Claude Code includes the current date in its system prompt but not the time or timezone. This means Claude cannot:

- Accurately timestamp responses when users request it
- Detect time gaps between messages (e.g. user returning after days vs. immediate follow-up)
- Ground temporal references like "today", "this morning", or "earlier"

This has been requested multiple times:
- [#1164](https://github.com/anthropics/claude-code/issues/1164) — "Add Current Date and Time to System prompt"
- [#2618](https://github.com/anthropics/claude-code/issues/2618) — "A date tool should be included by default"
- [#23655](https://github.com/anthropics/claude-code/issues/23655) — "Inject current local time into conversation context by default"

## How it works

A `UserPromptSubmit` hook runs a lightweight Node.js one-liner that outputs the current local time in ISO 8601 format with timezone offset. Since `UserPromptSubmit` hook stdout is injected as context that Claude can see, this gives Claude accurate temporal awareness on every message.

Example output:
```
The current local time is: 2026-02-06T04:39:00-07:00. This is the latest source of truth for time; do not attempt to get the time any other way.
```

## Requirements

- Node.js (already required by Claude Code)

## Cost

Negligible — adds ~120 characters of context per message.
