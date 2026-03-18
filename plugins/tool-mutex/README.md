# tool-mutex

**Critical security fix** for Windows Wof.sys BSOD caused by parallel filesystem enumeration in Claude Code ([issue #32870](https://github.com/anthropics/claude-code/issues/32870)).

## The problem

Claude Code executes Glob, Grep, Read, and Bash tools in parallel with **no concurrency limit**. Each tool call triggers Node.js `fs.readdir`/`fs.stat`/`fs.glob`, issuing concurrent `NtQueryDirectoryFileEx` syscalls. On Windows, this overwhelms the **Wof.sys** (Windows Overlay Filter) kernel driver, causing a **Blue Screen of Death**.

This was discovered on a **192GB RAM / 32-core CPU / 15GB NVIDIA Ada 5000 GPU** workstation that experienced **26+ BSODs** during normal Claude Code usage. Windows memory dump analysis confirmed the crash originates in `Wof.sys` from parallel directory enumeration by Node.js.

This is effectively a **denial-of-service vulnerability against the host OS** — a single Claude Code session can crash the entire machine.

### Why Node.js specifically

The crash is **Node.js `fs` specific**. Each Node.js worker thread holds its own V8 heap and libuv threadpool entries. With 256+ concurrent `fs.readdir({ recursive: true })` calls, memory balloons to 16GB+ and the kernel either OOM-kills the process (Linux) or the Wof.sys driver crashes first (Windows BSOD). Python `os` APIs handle 1024+ workers without issue — the bug is in how Node.js manages concurrent filesystem I/O.

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
| `CLAUDE_TOOL_MUTEX_DISABLED` | `0` | Set to `1` to disable entirely (**not recommended on Windows**) |
| `CLAUDE_TOOL_MUTEX_MAX_CONCURRENT` | `1` (Windows) / `4` (Linux/macOS) | Max concurrent filesystem operations |
| `CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS` | `75` | Cooldown delay (ms) between operations. Range: 15–1000 |

### Recommended values

#### Windows (prevents Wof.sys BSOD) — CRITICAL

```bash
# Default — full serialization, safest for Windows
# DO NOT increase above 1 if you have experienced BSODs
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=1
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=75
```

#### macOS / Linux (light throttling)

```bash
# Default — allows moderate parallelism, prevents OOM
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=4
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=75
```

#### High-performance machine (8+ cores, 32GB+ RAM, non-Windows)

```bash
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=8
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=30
```

#### Low-memory machine (< 8GB RAM)

```bash
CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=2
CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS=100
```

#### Disable (NOT recommended on Windows)

```bash
CLAUDE_TOOL_MUTEX_DISABLED=1
```

## How it works

1. **PreToolUse hook** — Before Glob, Grep, Read, or Bash executes, the hook acquires a semaphore slot. If all slots are taken, the tool waits (polls every 150ms, max 20s timeout to avoid blocking the user).
2. **PostToolUse hook** — After the tool completes, the hook releases the slot.
3. **Semaphore** — File-based counting semaphore using slot files in `$TMPDIR/claude-tool-mutex/<session_id>/`. Stale slots (>120s) are auto-cleaned to prevent deadlocks.

## Verified results

Tested with Node.js `worker_threads` + `fs.readdir/stat/glob` on a 4-core / 16GB Linux container:

| Metric | No Mutex (256 workers) | With Mutex (256 workers) |
|---|---|---|
| Completed | 7/256 (2.7%) | **256/256 (100%)** |
| Peak RSS | 16,272 MB | **290 MB** |
| Min free memory | 35 MB (near OOM) | **15,857 MB** |
| Crashes | YES (249 timeouts) | **None** |

At 1024 workers without mutex, the Node.js process is **OOM-killed** (exit code 137).

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
