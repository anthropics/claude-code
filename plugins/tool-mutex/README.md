# tool-mutex

Prevents Windows Wof.sys BSOD and system crashes caused by parallel filesystem enumeration in Claude Code ([issue #32870](https://github.com/anthropics/claude-code/issues/32870)).

Claude Code runs Glob, Grep, Read, and Bash tools concurrently. On Windows, parallel `NtQueryDirectoryFileEx` syscalls from Node.js `fs.readdir`/`fs.stat`/`fs.glob` can overwhelm the Wof.sys driver, triggering a Blue Screen of Death. On any platform, 256+ concurrent Node.js fs workers can exhaust memory (16GB+ RSS).

This plugin serializes filesystem tool calls through a file-based counting semaphore, queuing excess operations until a slot is available.

## Install

Copy the `tool-mutex` folder into your Claude Code plugins directory:

```bash
# Project-level (recommended)
cp -r plugins/tool-mutex .claude/plugins/tool-mutex

# Or user-level (applies to all projects)
cp -r plugins/tool-mutex ~/.claude/plugins/tool-mutex
```

The plugin activates automatically via its `.claude-plugin/plugin.json` manifest.

## Configuration

All configuration is via environment variables. Set them in your shell profile, `.env`, or Claude Code settings.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `CLAUDE_TOOL_MUTEX_DISABLED` | `0` | Set to `1` to disable the plugin entirely (no throttling) |
| `CLAUDE_TOOL_MUTEX_MAX_CONCURRENT` | `1` (Windows) / `4` (Linux/macOS) | Max concurrent filesystem operations |
| `CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS` | `75` | Cooldown delay (ms) between operations. Range: 15–1000 |

### Recommended values

#### Windows (prevents Wof.sys BSOD)

```bash
# Default — full serialization, safest for Windows
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=1
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=75
```

#### macOS / Linux (light throttling)

```bash
# Default — allows moderate parallelism
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=4
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=75
```

#### High-performance machine (8+ cores, 32GB+ RAM)

```bash
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=8
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=30
```

#### Low-memory machine (< 8GB RAM)

```bash
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=2
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=100
```

#### Disable (not recommended on Windows)

```bash
CLAUDE_TOOL_MUTEX_DISABLED=1
```

## How it works

1. **PreToolUse hook** — Before Glob, Grep, Read, or Bash executes, the hook acquires a semaphore slot. If all slots are taken, the tool waits (polls every 150ms, max 20s timeout).
2. **PostToolUse hook** — After the tool completes, the hook releases the slot.
3. **Semaphore** — File-based counting semaphore using slot files in `$TMPDIR/claude-tool-mutex/<session_id>/`. Stale slots (>120s) are auto-cleaned.

## Load tests

### Node.js (reproduces the actual crash pattern)

```bash
# 1024 workers, no mutex — will OOM-kill on most machines
node tests/load_test_node.js --workers 1024

# 256 workers with mutex simulation (75ms delay between batches)
node tests/load_test_node.js --workers 256 --delay 75

# Compare: no mutex vs mutex
node tests/load_test_node.js --compare --workers 256
```

### Python (stress test, won't reproduce Node.js-specific crash)

```bash
# Default: 16 workers, no mutex
python3 tests/load_test.py

# With mutex
python3 tests/load_test.py --mutex

# Compare
python3 tests/load_test.py --compare --workers 32

# Escalating stress test
python3 tests/load_test.py --escalate
```

Both tests report: CPU cores, free memory (start/min/end), peak RSS, ops/second, crash detection.

## Plugin structure

```
tool-mutex/
├── .claude-plugin/plugin.json    # Plugin metadata
├── hooks/
│   ├── hooks.json                # Hook matchers (Glob, Grep, Read, Bash)
│   ├── pretooluse.py             # Acquires semaphore slot
│   └── posttooluse.py            # Releases semaphore slot
├── mutex/
│   └── semaphore.py              # File-based counting semaphore
└── tests/
    ├── load_test.py              # Python stress test
    └── load_test_node.js         # Node.js stress test
```
