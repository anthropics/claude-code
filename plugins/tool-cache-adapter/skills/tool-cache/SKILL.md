---
name: tool-cache-adapter
description: >-
  Transparent caching adapter for Claude Code agent tools. Intercepts
  tool calls via PreToolUse/PostToolUse hooks, caches idempotent results
  with tool-specific TTLs, and auto-invalidates when mutating tools
  modify files. Covers both Claude Code CLI tools and Claude API tools.
license: MIT
compatibility: Python 3.8+. No external dependencies.
metadata:
  author: jadecli-experimental
  version: 0.1.0
  category: performance
  tags: cache, tools, hooks, performance, adapter
allowed-tools: Bash(python3:*) Read
---

# Tool Cache Adapter

Transparent result caching for every Claude Code agent tool. Eliminates
redundant tool execution without changing tool behavior.

## How It Works

```
PreToolUse Hook                     PostToolUse Hook
┌─────────────────────┐             ┌─────────────────────┐
│ 1. Compute cache key│             │ 1. Check cacheability│
│ 2. Check session    │             │ 2. Skip errors/empty │
│    cache (fast)     │             │ 3. Store result with │
│ 3. Check persistent │             │    tool-specific TTL │
│    cache            │             │ 4. Write to session  │
│ 4. If hit: inject   │             │    + persistent cache│
│    via systemMessage│             └─────────────────────┘
│ 5. If miss: pass    │
└─────────────────────┘
```

### Cache Hit Flow

```
Claude calls Read("/src/index.ts")
  │
  ▼
PreToolUse hook fires
  │
  ├─ Cache key: sha256("Read:{\"file_path\":\"/src/index.ts\",\"__mtime__\":1707900000}")
  ├─ Session cache: HIT (file unchanged)
  │
  ▼
Claude receives systemMessage:
  "[CACHE HIT] Tool Read called with identical parameters 12s ago."
  + cached file contents
```

### Cache Invalidation Flow

```
Claude calls Edit("/src/index.ts", ...)
  │
  ▼
PostToolUse hook fires (Edit matcher)
  │
  ├─ Edit is not cacheable itself
  ├─ But Edit.invalidates = [Read, Grep, Glob]
  ├─ Invalidate Read cache for /src/index.ts
  │
  ▼
Next Read("/src/index.ts") → cache MISS → fresh read
```

## Tool Cache Policies

| Tool | Cacheable | TTL | Strategy |
|------|-----------|-----|----------|
| **Read** | Yes | mtime | Invalidates when file mtime changes |
| **Glob** | Yes | 30 min | Pattern + path based key |
| **Grep** | Yes | 30 min | Pattern + path + all options |
| **WebFetch** | Yes | 15 min | URL + prompt key |
| **WebSearch** | Yes | 5 min | Query + domain filters |
| **Bash** | Conditional | 5 min | Only idempotent commands cached |
| **Edit** | No | — | Invalidates Read/Grep/Glob for file |
| **Write** | No | — | Invalidates Read/Grep/Glob for file |

### Claude API Tools

| Tool | Cacheable | TTL | Notes |
|------|-----------|-----|-------|
| `web_search` | Yes | 5 min | Server-side (API-level adapter) |
| `web_fetch` | Yes | 15 min | Server-side (API-level adapter) |
| `code_execution` | No | — | Stateful sandbox |
| `memory` | No | — | Always current |
| `bash` | Conditional | 5 min | Same rules as CLI Bash |
| `computer_use` | No | — | Side effects |
| `text_editor` | View only | mtime | Only 'view' command cached |

### Bash Cacheability

Not all Bash commands are cached. The adapter classifies commands:

**Cached** (idempotent):
`git status`, `git log`, `git diff`, `ls`, `pwd`, `which`, `node --version`,
`npm list`, `gh pr view`, `gh api`, `neonctl branches list`, `date`, `jq`

**Never cached** (mutating):
`git add`, `git commit`, `git push`, `rm`, `mv`, `npm install`, `npm run`,
`docker`, `curl -X POST`, `gh pr create`, `neonctl branches create`, `kill`

## Storage Architecture

```
~/.claude/cache/                  # Persistent (cross-session)
  └── entries/
      └── {sha256}.json           # {key, tool_name, tool_input, result, created_at, ttl}

/tmp/claude-cache-{session_id}/   # Session-scoped (fast)
  └── entries/
      └── {sha256}.json           # Same format, promoted from persistent on hit
```

- **Session cache**: Checked first. Fast. Cleared when session ends.
- **Persistent cache**: Cross-session. Results promoted to session cache on hit.
- **Max entry size**: 100KB (larger results are not cached)

## Cache Key Generation

Keys are SHA-256 hashes of `tool_name + canonical_json(relevant_fields)`:

```python
# Read: key includes file_path + mtime (auto-invalidates on edit)
sha256("Read:{\"__mtime__\":1707900000,\"file_path\":\"/src/index.ts\"}")

# Grep: key includes pattern + path + all filter options
sha256("Grep:{\"glob\":\"*.ts\",\"output_mode\":\"content\",\"pattern\":\"TODO\"}")

# Bash: key includes the full command string
sha256("Bash:{\"command\":\"git status\"}")

# WebFetch: key includes URL + prompt
sha256("WebFetch:{\"prompt\":\"summarize\",\"url\":\"https://example.com\"}")
```

File paths are normalized (resolved to absolute paths) before hashing.

## Configuration

No configuration needed — the adapter activates via hooks.json when the
plugin is installed. To customize:

### Change TTLs

Edit `core/cache_policy.py` → `TOOL_POLICIES` dict:

```python
"Read": CachePolicy(
    tool_name="Read",
    ttl_seconds=3600,  # Change from mtime-based to 1 hour TTL
    use_mtime=False,
),
```

### Add Bash Commands to Cache

Edit `core/cache_policy.py` → `_IDEMPOTENT_PREFIXES` tuple:

```python
_IDEMPOTENT_PREFIXES = (
    "git status", "git log", ...,
    "my-custom-tool --info",  # Add your safe commands
)
```

### Disable Caching for a Tool

```python
"Grep": CachePolicy(tool_name="Grep", cacheable=False),
```
