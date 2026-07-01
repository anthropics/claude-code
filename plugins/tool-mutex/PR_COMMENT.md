## Testing Results — BSOD Prevention Confirmed

I've been running the tool-mutex plugin continuously on my Windows workstation for **several days** with no BSODs. Prior to this fix, the same machine experienced **27 BSODs** (9 distinct bugcheck types) during normal Claude Code usage.

---

### Test Environment

| Component | Spec |
|---|---|
| OS | Windows 11 |
| CPU | 32-core |
| RAM | 192 GB |
| GPU | NVIDIA Ada 5000 (15 GB VRAM) |
| Wof.sys | Present (default on all Windows 10/11) |

### Before Fix (26+ BSODs)

- **27 confirmed BSODs** across 9 distinct bugcheck types: `0x139`, `0x3B`, `0x1E`, `0x50`, `0x14F`, `0x10E`, `0x20001`, `0xC2`
- All crashes traced to `Wof.sys` (Windows Overlay Filter) triggered by parallel `NtQueryDirectoryFileEx` syscalls from Node.js
- BSODs occurred during normal Claude Code sessions with parallel Glob/Grep/Read/Bash tool calls
- Minidump evidence (20 unique kernel dumps, 87 MB): https://drive.google.com/file/d/1Iqo8Ey4CjHfGbPMMRxlZVxaVf-N3i5Ab/view?usp=sharing

### After Fix (0 BSODs)

- **0 BSODs** over several days of continuous daily use
- Same workstation, same workloads, same Claude Code usage patterns
- Plugin running with default configuration (`cpu_count // 2` = 16 concurrent slots, 75ms cooldown)

---

### Load Test Results (Linux, 4-core / 16 GB)

#### Node.js load test (16 workers)

```
Workers:          16
Ops completed:    16/16 (100%)
Peak RSS:         1,298 MB (main)
Free memory:      16,127 MB start → 14,858 MB min → 15,857 MB end
Crashes:          None
Total time:       25.2s
```

#### Python load test (16 workers, 160 total ops)

```
Workers:          16
Iterations:       10
Ops completed:    160/160 (100%)
Peak RSS:         17.6 MB
Free memory:      15,196 MB start → 14,671 MB min → 14,675 MB end
Crashes:          None
Total time:       25.0s
```

#### Previous 256-worker stress test (with vs without mutex)

| Metric | No Mutex (256 workers) | With Mutex (256 workers) |
|---|---|---|
| Completed | 7/256 (2.7%) | **256/256 (100%)** |
| Peak RSS | 16,272 MB | **290 MB** |
| Min free memory | 35 MB (near OOM) | **15,857 MB** |
| Crashes | YES (249 timeouts) | **None** |

At 1024 workers without mutex, Node.js is **OOM-killed** (exit code 137).

---

### What the fix does

- File-based counting semaphore that queues concurrent filesystem tool calls (Glob, Grep, Read, Bash)
- Default concurrency: `os.cpu_count() // 2` — auto-scales to hardware (16 on 32-core, 2 on 4-core)
- 75ms cooldown between operations (empirically tested — 50ms unstable under sustained load, 100ms+ adds latency with no benefit)
- PID-based stale slot cleanup — dead-process slots freed immediately, no lockout delay
- File-based because Claude Code hooks spawn separate Python processes — in-memory locks don't survive across invocations

### Why this matters

- `Wof.sys` is loaded on **all modern Windows 10/11 installations** (handles NTFS compression and Compact OS)
- Any Windows user running Claude Code with parallel tool calls is potentially affected
- This is effectively a **denial-of-service against the host OS** — a single session can BSOD the machine
- The crash is **Node.js `fs` specific** — Python `os` APIs handle 1024+ workers without issue

### Related issues

- #32870 — Original BSOD report
- #30137 — Related parallel execution issue
- Microsoft Q&A: https://learn.microsoft.com/en-us/answers/questions/5814272
- Feedback Hub: https://aka.ms/AA106t77

---

**Recommendation:** This fix is stable and ready to merge. The plugin has been validated both through automated load tests and real-world daily usage on the affected hardware. Zero BSODs since deployment.
