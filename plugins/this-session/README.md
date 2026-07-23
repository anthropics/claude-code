# this-session

A `/this-session` command that prints a live dashboard of the current Claude Code session — tokens consumed, actual cost, cache savings, models used, and tool call breakdown.

## Overview

Ever wonder how many tokens a long conversation has burned, or how much the cache is actually saving you? `/this-session` reads the live session transcript from `~/.claude/projects/` and renders a formatted monitor right in the chat.

## Example output

```
╔════════════════════════════════════════════════════════════╗
║  SESSION MONITOR                                           ║
╚════════════════════════════════════════════════════════════╝

  SESSION ID   7003719e-9333-448c-b8a5-dae15f4f5823
  STARTED      6/10/2026, 2:41:25 PM
  DURATION     18m 42s
  USER TURNS   12
  API CALLS    31

  ┌────────────────────────────────────────────────────────────┐
  │ TOKENS                                                     │
  ├────────────────────────────────────────────────────────────┤
  │  Input (direct)               34  ░░░░░░░░░░░░░░░░░░░░    │
  │  Output                   10,006  ░░░░░░░░░░░░░░░░░░░░    │
  │  Cache write              37,182  █░░░░░░░░░░░░░░░░░░░    │
  │  Cache read            1,119,335  ███████████████████░    │
  │  TOTAL                 1,166,557                          │
  │  Cache hit rate             96.8%                         │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │ COST                                                       │
  ├────────────────────────────────────────────────────────────┤
  │  Actual cost               $0.6254                        │
  │  Without cache             $3.6197                        │
  │  Cache savings             $2.9943                        │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │ MODELS                                                     │
  ├────────────────────────────────────────────────────────────┤
  │  claude-sonnet-4-6         32 calls    $0.6254            │
  │    in 34                  out  10,006  ████████████       │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │ TOOLS (top 3)                                              │
  ├────────────────────────────────────────────────────────────┤
  │  Bash                          18×  ██████████████████    │
  │  Edit                           2×  ██░░░░░░░░░░░░░░░░    │
  │  Write                          1×  █░░░░░░░░░░░░░░░░░    │
  └────────────────────────────────────────────────────────────┘
```

## Commands

### `/this-session`

Prints the session dashboard immediately. No arguments needed.

## How it works

- Reads `~/.claude/projects/<cwd-slug>/*.jsonl` (the live session transcript)
- De-duplicates repeated assistant entries to avoid inflated counts
- Computes per-model token usage, cost, and cache hit rate
- Works with mixed-model sessions (e.g. Sonnet + Opus subagents)

## Installation

```sh
# Copy command definition
cp plugins/this-session/commands/this-session.md ~/.claude/commands/this-session.md

# Copy the analyzer script
cp plugins/this-session/this-session.mjs ~/.claude/commands/this-session.mjs
```

Then type `/this-session` in any Claude Code chat.

## Requirements

- Node.js (any version ≥ 18) — no npm install needed, zero dependencies
- Claude Code with a live session in `~/.claude/projects/`
