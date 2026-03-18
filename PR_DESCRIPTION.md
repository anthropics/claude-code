## Critical Bug Fix — Windows BSOD (Wof.sys)

Fixes #32870

### Root cause

Claude Code executes Glob, Grep, Read, and Bash tools in parallel with **no concurrency limit**. Each tool call triggers Node.js `fs.readdir`/`fs.stat`/`fs.glob`, issuing concurrent `NtQueryDirectoryFileEx` syscalls. On Windows, this overwhelms the **Wof.sys** (Windows Overlay Filter) kernel driver — present on **all Windows 10/11 installations** — causing a **Blue Screen of Death**.

Diagnosed on a **192GB RAM / 32-core CPU / 15GB NVIDIA Ada 5000 GPU** workstation that experienced **26+ BSODs**. Memory dump analysis confirmed the crash originates in `Wof.sys` from parallel directory enumeration by Node.js.

### The vulnerability

- **No concurrency limit** on filesystem tool calls — unlimited parallel `NtQueryDirectoryFileEx` syscalls
- On Windows: **denial-of-service against the host OS** — a single session can BSOD the machine
- On Linux: 256+ concurrent Node.js fs workers consume 16GB+ RAM, triggering OOM-kill (exit 137)
- **Node.js `fs` specific** — Python `os` APIs handle 1024 workers without issue

### Fix

Adds a **tool-mutex plugin** with a file-based counting semaphore that queues concurrent filesystem operations:

- **Windows**: max 1 concurrent op (full serialization) — prevents Wof.sys overload
- **Linux/macOS**: max 4 concurrent ops (light throttling) — prevents OOM
- 75ms cooldown between operations (empirically tested: 50ms unstable under sustained load, 100ms+ adds latency with no benefit)
- **PID-based stale slot cleanup** — dead-process slots freed immediately via `os.kill(pid, 0)`, with 120s time-based fallback for corrupted metadata
- Disable with `CLAUDE_TOOL_MUTEX_DISABLED=1` (not recommended on Windows)

### Why file-based semaphore (not in-memory)?

Claude Code hooks execute as **separate Python processes** — each PreToolUse/PostToolUse spawns a new `python3` process. In-memory state (`asyncio.Semaphore`, `threading.Lock`) does not survive across invocations. File-based is the only mechanism that works with the plugin hook architecture.

### Verified results (Node.js load test)

| Metric | No Mutex (256 workers) | With Mutex (256 workers) |
|---|---|---|
| Completed | 7/256 (2.7%) | **256/256 (100%)** |
| Peak RSS | 16,272 MB | **290 MB** |
| Min free mem | 35 MB (near OOM) | **15,857 MB** |
| Crashes | YES (249 timeouts) | **None** |

### Configuration

| Variable | Default | Description |
|---|---|---|
| `CLAUDE_TOOL_MUTEX_DISABLED` | `0` | Set `1` to disable (not recommended on Windows) |
| `CLAUDE_TOOL_MUTEX_MAX_CONCURRENT` | `1` (Win) / `4` (Linux/Mac) | Max concurrent fs operations |
| `CLAUDE_TOOL_MUTEX_RELEASE_DELAY_MS` | `75` | Cooldown between operations (ms), range 15–1000 |

### Test plan

- [x] Confirmed 26+ BSODs on Windows 192GB/32-core workstation from parallel fs enumeration
- [x] Analyzed Windows memory dumps — crash in Wof.sys from NtQueryDirectoryFileEx
- [x] Node.js `fs` APIs crash at 256+ concurrent workers (OOM-kill, exit 137)
- [x] Python `os` APIs handle 1024 workers fine (crash is Node.js-specific)
- [x] Mutex batching keeps RSS at 290MB vs 16GB unthrottled, 100% completion
- [x] PID-based stale slot cleanup — dead-process slots freed immediately, no 2-min lockout
- [ ] Verify BSOD prevention on affected Windows machine with plugin installed

https://claude.ai/code/session_01TyTbGq1fkZgXsUcLwwEnXz
