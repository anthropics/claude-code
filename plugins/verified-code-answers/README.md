# Verified Code Answers Plugin

This plugin ensures Claude reads actual source files before answering factual questions about code behavior, and explicitly caveats any unverified assertions.

## Problem Solved

Addresses [issue #29753](https://github.com/anthropics/claude-code/issues/29753): Claude Code was presenting unverified assertions about code behavior with the same confidence as verified ones. Users had no way to distinguish between answers grounded in actual source code vs. answers pattern-matched from training data.

## What This Plugin Does

This plugin injects a `SessionStart` hook that adds the following behavioral rules to every Claude Code session:

### Rule 1: Read Before You Assert
When a user asks a factual question about how code behaves, Claude **must** use its file reading tools (`Read`, `Glob`, `Grep`) to inspect the actual source code **before** giving an answer.

### Rule 2: Caveat Unverified Answers
If Claude cannot read the relevant source file, it **must** explicitly caveat its answer using phrases like:
- "I haven't read the source file, but based on common patterns..."
- "Without checking the actual code, I believe..."
- "This is an unverified assumption - please check [filename] to confirm."

### Rule 3: Never Present Unverified Information as Verified
Claude must never answer a code-behavior question with the same confidence as a verified answer unless it has actually read the relevant code.

## Installation

Copy this plugin directory to your Claude Code plugins folder and enable it:

```bash
cp -r plugins/verified-code-answers ~/.claude/plugins/
```

## Files

- `.claude-plugin/plugin.json` - Plugin metadata
- `hooks/hooks.json` - Hook configuration (SessionStart)
- `hooks-handlers/session-start.sh` - The hook script that injects behavioral instructions
