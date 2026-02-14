---
name: Tool Cache Adapter
description: Caching adapter for Claude Code agent tools. Automatically caches Read, Glob, Grep, WebFetch, and WebSearch results. Mutating tools (Write, Edit) invalidate relevant cache entries.
version: 0.1.0
---

# Tool Cache Adapter

A hook-based caching layer for Claude Code agent tools. Intercepts tool
invocations via PreToolUse/PostToolUse hooks and serves cached results
when the same tool is called with identical parameters.

## How It Works

```
Tool call                        Cache flow
─────────                        ──────────
Read("/src/app.ts")
  └─ PreToolUse hook
       ├─ Cache HIT  → deny tool, return cached result via systemMessage
       └─ Cache MISS → allow tool, normal execution
                           └─ PostToolUse hook → store result in cache

Edit("/src/app.ts", ...)
  └─ PostToolUse hook → invalidate Read cache for /src/app.ts
                       → invalidate all Glob/Grep caches
```

## Tool Cache Policies

| Tool          | Cacheable | TTL    | Invalidated By                    |
|---------------|-----------|--------|-----------------------------------|
| Read          | Yes       | 5 min  | Write, Edit, MultiEdit            |
| Glob          | Yes       | 5 min  | Write, Edit, MultiEdit            |
| Grep          | Yes       | 5 min  | Write, Edit, MultiEdit            |
| WebFetch      | Yes       | 15 min | (none)                            |
| WebSearch     | Yes       | 30 min | (none)                            |
| Bash          | No        | -      | -                                 |
| Write         | No        | -      | Invalidates: Read, Glob, Grep     |
| Edit          | No        | -      | Invalidates: Read, Glob, Grep     |
| MultiEdit     | No        | -      | Invalidates: Read, Glob, Grep     |
| NotebookEdit  | No        | -      | Invalidates: Read, Glob, Grep     |
| Task          | No        | -      | -                                 |
| TodoWrite     | No        | -      | -                                 |

## Cache Key Generation

Keys are SHA-256 hashes of `tool_name + sorted(tool_input)`, excluding
transient fields like `description` and `run_in_background`.

## Cache Storage

Results are stored as individual JSON files in `$TMPDIR/claude-tool-cache/`
(defaults to `/tmp/claude-tool-cache/`). Expired entries are evicted
probabilistically during PostToolUse hook execution.

## Commands

- `/cache-stats` — Show cache statistics (entry counts, sizes, per-tool breakdown)
- `/cache-clear` — Clear all cached entries
