---
description: Show a live dashboard of the current session — tokens, cost, cache efficiency, models used, and tool call counts.
allowed-tools: Bash(node:*), Bash(ls:*), Bash(find:*)
---

Show a real-time overview of this conversation session.

## Steps

1. Find the analyzer script. It is bundled alongside this command inside the plugin directory. Locate it with:
   ```sh
   find ~/.claude -name "this-session.mjs" 2>/dev/null | head -1
   ```

2. Run the script (no arguments — it auto-detects the current session):
   ```sh
   node <path-to-script>
   ```

3. Print the full output verbatim inside a code block so the box-drawing layout renders correctly.

4. After the code block, add a single sentence highlighting the most notable fact (e.g. cache hit rate, dominant cost driver, most-used tool).

## What the dashboard shows

| Section | Details |
|---|---|
| Overview | Session ID, start time, duration, user turns, total API calls |
| Tokens | Input, output, cache-write, cache-read, total, cache hit % |
| Cost | Actual cost, cost without caching, money saved by caching |
| Models | Per-model breakdown: calls, tokens in/out, cost |
| Tools | Top tool calls ranked by frequency |

## Pricing reference (baked into the script)

| Model | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| claude-opus-4-7 / 4-6 | $15/MTok | $75/MTok | $18.75/MTok | $1.50/MTok |
| claude-sonnet-4-6 | $3/MTok | $15/MTok | $3.75/MTok | $0.30/MTok |
| claude-haiku-4-5 | $0.80/MTok | $4/MTok | $1.00/MTok | $0.08/MTok |

## Installation

Copy the plugin directory into your Claude commands folder:

```sh
cp -r plugins/this-session ~/.claude/plugins/this-session
cp plugins/this-session/commands/this-session.md ~/.claude/commands/this-session.md
cp plugins/this-session/this-session.mjs ~/.claude/commands/this-session.mjs
```

Then type `/this-session` in any Claude Code session.
