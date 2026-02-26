# Analysis: Race Condition in ~/.claude.json Concurrent Writes

## Executive Summary

When multiple Claude Code sessions run concurrently on the same machine, the shared configuration file `~/.claude.json` becomes corrupted with the error:

```
JSON Parse error: Unexpected EOF
```

**Scale**: 30+ open GitHub issues report this problem, with the earliest reports dating back to June 2025. The issue has been reported and closed without resolution at least 8 times before the current wave.

**Key Evidence**: All 65+ "corrupted" backup files, when examined, contain **valid JSON**. This is consistent with corruption occurring during **read** — one session reads the file while another has not yet completed writing. By the time the backup is created, the write has finished, so the backup is always valid. (Note: an alternative explanation is that backups are only created on successful read paths inside `_Gq()`, so corrupted states are never captured. Both explanations point to the same root cause: non-atomic writes creating a window where partial content is visible to readers.)

**Prior Fix Attempt**: v2.1.59 CHANGELOG states "Fixed config file corruption that could wipe authentication when multiple Claude Code instances ran simultaneously." However, as shown below, the fix introduced atomic writes and file locking but left **fallback paths** that bypass both protections, re-introducing the vulnerability.

**Affected Platform**: Primarily Windows (NTFS), but also observed on macOS.

**Versions Affected**: v2.1.50 through v2.1.59 (current). Historical reports from v1.0.x era.

---

## Related GitHub Issues

### Core Issues (14)

| Issue | Title | Platform | State |
|-------|-------|----------|-------|
| [#28809](https://github.com/anthropics/claude-code/issues/28809) | `.claude.json becomes corrupted (Unexpected EOF) during tool use` | Windows | Open |
| [#28813](https://github.com/anthropics/claude-code/issues/28813) | `.claude.json corrupted by race condition when multiple CLI sessions run concurrently` | Windows | Open |
| [#28824](https://github.com/anthropics/claude-code/issues/28824) | `.claude.json corrupted by concurrent CLI sessions (non-atomic writes)` | Windows | Open |
| [#28837](https://github.com/anthropics/claude-code/issues/28837) | `Windows: ~/.claude.json cascading corruption when multiple CLI + Chrome MCP processes run` | Windows | Open |
| [#28861](https://github.com/anthropics/claude-code/issues/28861) | `Corrupted .claude.json causes PowerShell input duplication/echo` | Windows | Open |
| [#28888](https://github.com/anthropics/claude-code/issues/28888) | `Repeated .claude.json corruption on Windows with multiple terminals` | Windows | Open |
| [#28922](https://github.com/anthropics/claude-code/issues/28922) | `.claude.json race condition — reported 8 times since June 2025, all closed without resolution` | Windows | Open |
| [#28923](https://github.com/anthropics/claude-code/issues/28923) | `2.1.59 regression: corruption detection cascade amplifies corruption from Task tool subagents` | Windows | Open |
| [#28965](https://github.com/anthropics/claude-code/issues/28965) | `Remote Control causes repeated .claude.json corruption (MSYS/Git Bash)` | Windows | Open |
| [#28988](https://github.com/anthropics/claude-code/issues/28988) | `Race condition: concurrent sessions corrupt ~/.claude.json` | Windows | Open |
| [#29003](https://github.com/anthropics/claude-code/issues/29003) | `.claude.json corruption from concurrent instances on same machine` | Windows | Open |
| [#29032](https://github.com/anthropics/claude-code/issues/29032) | `.claude.json repeatedly corrupted when running multiple instances on Windows` | Windows | Open |
| [#29036](https://github.com/anthropics/claude-code/issues/29036) | `Race condition: .claude.json corruption on Windows with concurrent sessions loses all settings` | Windows | Open |
| [#27983](https://github.com/anthropics/claude-code/issues/27983) | `Race condition when editing ~/.claude.json during session` | macOS | Open |

### Additional Related Issues (16+)

| Issue | Title |
|-------|-------|
| [#28992](https://github.com/anthropics/claude-code/issues/28992) | Concurrent Windows corruption |
| [#28966](https://github.com/anthropics/claude-code/issues/28966) | Concurrent Windows corruption |
| [#28842](https://github.com/anthropics/claude-code/issues/28842) | Concurrent Windows corruption |
| [#29010](https://github.com/anthropics/claude-code/issues/29010) | Concurrent Windows corruption |
| [#28898](https://github.com/anthropics/claude-code/issues/28898) | Concurrent Windows corruption |
| [#29004](https://github.com/anthropics/claude-code/issues/29004) | Concurrent Windows corruption |
| [#29008](https://github.com/anthropics/claude-code/issues/29008) | Concurrent Windows corruption |
| [#28829](https://github.com/anthropics/claude-code/issues/28829) | Concurrent Windows corruption |
| [#28847](https://github.com/anthropics/claude-code/issues/28847) | Concurrent Windows corruption |
| [#15079](https://github.com/anthropics/claude-code/issues/15079) | File locking on Windows |
| [#13287](https://github.com/anthropics/claude-code/issues/13287) | macOS file locking conflict |
| [#24130](https://github.com/anthropics/claude-code/issues/24130) | Auto memory file concurrent access |
| [#27941](https://github.com/anthropics/claude-code/issues/27941) | Stale write detection logs but doesn't prevent overwrite |
| [#27902](https://github.com/anthropics/claude-code/issues/27902) | "Don't Ask Again" overwrites permissions array |

### Historical Pattern (from #28922)

This issue has been reported and closed without resolution at least 8 times:

| Date | Issue | Resolution |
|------|-------|------------|
| Jun 2025 | #2593 | Closed as "not planned" |
| Jul 2025 | #2810 | Closed |
| Jul 2025 | #3117 | Closed (5 concurrent sessions) |
| Sep 2025 | #7243 | Closed as "not planned" |
| Sep 2025 | #7273 | Closed as "not planned" |
| Dec 2025 | #15608 | Closed |
| Jan 2026 | #18998 | Open (no response) |
| Feb 2026 | #26717 | Closed |

---

## Current Implementation (Decompiled from cli.js v2.1.59)

The following analysis is based on decompiling the npm package `@anthropic-ai/claude-code@2.1.59` (cli.js, 11.8MB bundled). Function names are minified; original names are inferred from exports and usage patterns.

### Architecture Overview

```
saveGlobalConfig (W8)
  └─► _Gq (locked write)
       ├─ proper-lockfile.lockSync()
       ├─ s16() — read current config
       ├─ Apply updater function
       ├─ Create backup (5 max, rotated)
       └─ Fe() — atomic write (temp + rename)
            └─ FALLBACK: direct writeFileSync (non-atomic!)
  └─► FALLBACK: wGq (unlocked write)
       └─ Fe() — atomic write
            └─ FALLBACK: direct writeFileSync

getGlobalConfig (v1)
  ├─ Cache check (mtime-based, TTL 1000ms)
  └─ s16() — read from disk
       └─ readFileSync → JSON.parse
            └─ On parse error: throw SZ (NO RETRY)
```

### Function: `Fe()` — Atomic Write (writeFileAtomically)

**Location**: cli.js ~line 6334
**Exported as**: Internal utility, used by all config writes

```javascript
function Fe(targetPath, content, options = { encoding: "utf-8" }) {
  const fs = n6();
  let resolvedPath = targetPath;

  // Follow symlinks
  if (fs.existsSync(targetPath)) {
    try {
      const link = fs.readlinkSync(targetPath);
      resolvedPath = isAbsolute(link) ? link : resolve(dirname(targetPath), link);
    } catch { resolvedPath = targetPath; }
  }

  const tmpPath = `${resolvedPath}.tmp.${process.pid}.${Date.now()}`;

  try {
    // 1. Write to temp file
    fs.writeFileSync(tmpPath, content, { encoding: options.encoding, flush: true });

    // 2. Preserve permissions
    if (fs.existsSync(resolvedPath)) {
      const mode = fs.statSync(resolvedPath).mode;
      fs.chmodSync(tmpPath, mode);
    }

    // 3. Atomic rename
    fs.renameSync(tmpPath, resolvedPath);

  } catch (err) {
    // ⚠️ CRITICAL BUG: Falls back to NON-ATOMIC write!
    telemetry("tengu_atomic_write_error", {});

    // Clean up temp file
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}

    // FALLBACK: Direct writeFileSync (truncate + write = race window!)
    fs.writeFileSync(resolvedPath, content, { encoding: options.encoding, flush: true });
  }
}
```

**Issue**: When `renameSync` fails (common on Windows with `EACCES`/`EPERM` when another process holds the target file), the function falls back to a direct `writeFileSync`. This uses `O_TRUNC` flag which **truncates the file to 0 bytes before writing**. Any concurrent reader during this window sees an empty or partial file.

### Function: `W8()` — saveGlobalConfig

**Location**: Part of config module exports
**74 call sites** throughout the codebase

```javascript
function W8(updater) {
  try {
    _Gq(configPath(), DEFAULT_CONFIG, (currentConfig) => {
      const newConfig = updater(currentConfig);
      if (newConfig === currentConfig) return currentConfig;
      return { ...newConfig, projects: cleanProjects(currentConfig.projects) };
    });
    cache.config = null;
    cache.mtime = 0;
    lastReadTime = 0;
  } catch (err) {
    // ⚠️ CRITICAL BUG: Falls back to UNLOCKED write!
    log(`Failed to save config with lock: ${err}`, { level: "error" });

    const currentConfig = s16(configPath(), DEFAULT_CONFIG);
    const newConfig = updater(currentConfig);
    if (newConfig === currentConfig) return;

    // Direct write WITHOUT lock
    wGq(configPath(), { ...newConfig, projects: cleanProjects(currentConfig.projects) }, DEFAULT_CONFIG);
    cache.config = null;
    cache.mtime = 0;
    lastReadTime = 0;
  }
}
```

**Issue**: When lock acquisition fails (another process holds the lock, or `EACCES` on Windows), `W8` falls back to `wGq()` which writes **without any locking**. This means two processes can write simultaneously.

### Function: `_Gq()` — Config Write with Lock

```javascript
function _Gq(filePath, defaults, updater) {
  const dir = dirname(filePath);
  const fs = n6();
  fs.mkdirSync(dir);

  let release;
  try {
    const lockPath = `${filePath}.lock`;
    const start = Date.now();

    // Acquire lock via proper-lockfile
    release = properLockfile.lockSync(filePath, { lockfilePath: lockPath });

    const lockTime = Date.now() - start;
    if (lockTime > 100) {
      log("Lock acquisition took longer than expected");
      telemetry("tengu_config_lock_contention", { lock_time_ms: lockTime });
    }

    // Stale write detection (logs only, doesn't prevent!)
    if (lastStat && filePath === configPath()) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs !== lastStat.mtime || stat.size !== lastStat.size) {
          telemetry("tengu_config_stale_write", {
            read_mtime: lastStat.mtime, write_mtime: stat.mtimeMs,
            read_size: lastStat.size, write_size: stat.size
          });
        }
      } catch (e) { if (e.code !== "ENOENT") throw e; }
    }

    // Read → Update → Write
    const currentConfig = s16(filePath, defaults);
    const newConfig = updater(currentConfig);
    if (newConfig === currentConfig) return;

    const filteredConfig = filterDefaults(newConfig, defaults);

    // Create backup (5 max, rotated, 60s minimum interval)
    createBackup(filePath, fs);

    // Atomic write
    Fe(filePath, JSON.stringify(filteredConfig, null, 2), { encoding: "utf-8", mode: 0o600 });

  } finally {
    if (release) release(); // Release lock
  }
}
```

### Function: `v1()` — getGlobalConfig (Read)

```javascript
function v1() {
  try {
    const now = performance.now();

    // Cache hit: config exists and within TTL
    if (cache.config && now - lastReadTime < 1000 /* ms */) {
      cacheHits++;
      return cache.config;
    }

    // Stat check: if mtime unchanged, return cached
    let stat = null;
    try { stat = fs.statSync(configPath()); } catch {}

    lastReadTime = now;
    if (cache.config && stat) {
      if (stat.mtimeMs <= cache.mtime) { cacheHits++; return cache.config; }
    }

    // Cache miss: read from disk
    cacheMisses++;
    const config = migrate(s16(configPath(), DEFAULT_CONFIG));

    if (stat) {
      cache = { config, mtime: stat.mtimeMs };
      lastStat = { mtime: stat.mtimeMs, size: stat.size };
    } else {
      cache = { config, mtime: Date.now() };
      lastStat = null;
    }

    return config;
  } catch {
    // ⚠️ No retry — if s16 throws on parse error, returns default
    return migrate(s16(configPath(), DEFAULT_CONFIG));
  }
}
```

**Issue**: No retry mechanism. If `s16()` throws a JSON parse error due to partial read, it falls through to a second `s16()` call — but there's no delay, so it may hit the same partial state again.

### Function: `s16()` — Read Config from Disk

```javascript
function s16(filePath, defaults, isInit) {
  if (!configEnabled) throw Error("Config accessed before allowed.");
  const fs = n6();

  try {
    const content = fs.readFileSync(filePath, { encoding: "utf-8" });
    try {
      const parsed = JSON.parse(stripBOM(content));
      return { ...deepClone(defaults), ...parsed };
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      throw new ConfigCorruptionError(message, filePath, defaults);
      // ⚠️ No retry! Throws immediately on parse error.
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      // Try to find and restore from backup
      const backupPath = findLatestBackup(filePath);
      if (backupPath) {
        process.stderr.write(`Config file corrupted, restoring from backup...`);
        // ... restore logic
      }
      return deepClone(defaults);
    }
    // Re-throw ConfigCorruptionError
    if (err instanceof ConfigCorruptionError) {
      // ... corruption handling (backup + restore)
    }
    throw err;
  }
}
```

**Issue**: When `readFileSync` reads a partially-written file, `JSON.parse` fails. The function throws immediately without retrying — a simple 20ms delay and retry would likely succeed since the write completes in microseconds.

---

## Race Condition Vectors

| # | Vector | Severity | Description | Current Mitigation | Gap |
|---|--------|----------|-------------|-------------------|-----|
| 1 | `Fe()` non-atomic fallback | **Critical** | When `renameSync` fails on Windows (`EACCES`), falls back to `writeFileSync` which truncates file to 0 bytes before writing | None — fallback is intentional | Remove fallback, retry atomic instead |
| 2 | `W8()` lockless fallback | **Critical** | When `proper-lockfile.lockSync` fails, falls back to `wGq()` without any locking | None — fallback is intentional | Remove fallback, retry lock instead |
| 3 | `s16()` no read retry | **High** | `readFileSync` + `JSON.parse` with no retry on parse error | None | Add retry with 20ms backoff |
| 4 | 74 `W8()` call sites | **High** | Every tool call, permission change, session metric triggers a full config write | 1000ms cache TTL on reads | Debounce/coalesce writes |
| 5 | `nw()` same fallback | **Medium** | `saveCurrentProjectConfig` has identical fallback pattern to `W8` | Same as W8 | Same fix as W8 |
| 6 | v2.1.59 cascade (#28923) | **High** | Corruption detection creates exponential feedback loop between processes | Backup + restore | Fix detection to avoid cascade |
| 7 | `v1()` TOCTOU gap | **Medium** | Between `statSync` (cache check) and `readFileSync` in `s16()`, another process can complete a write cycle. Stat sees old mtime → cache miss → read hits mid-write state | 1000ms cache TTL masks most cases | Fix 3 (read retry) covers this |

---

## Race Condition Timeline

### Scenario: Two concurrent sessions write to ~/.claude.json

```
Time    Session A                        Session B                       File State
─────   ─────────────────────────────    ─────────────────────────────   ──────────────────
t0      W8(updater) called                                               {valid JSON, 3KB}
t1      _Gq: lockSync() → acquired                                      {valid JSON, 3KB}
t2      _Gq: s16() reads config                                         {valid JSON, 3KB}
t3      _Gq: applies updater                                            {valid JSON, 3KB}
t4      Fe: writeFileSync(tmpA, data)                                    {valid JSON, 3KB}
t5      Fe: renameSync(tmpA, config)     W8(updater) called              {valid JSON, 3.1KB}
t6      Lock released                    _Gq: lockSync() → FAILS (stale lock on Windows?)
t7                                       FALLBACK: wGq() — NO LOCK
t8                                       Fe: writeFileSync(tmpB, data)   {valid JSON, 3.1KB}
t9                                       Fe: renameSync(tmpB, config) → EACCES!
t10                                      FALLBACK: writeFileSync(config, ...)
t11     v1(): readFileSync()             writeFileSync: O_TRUNC (file = 0 bytes)
t12     JSON.parse("") → ERROR!          writeFileSync: writing data...  {partial, 0-3KB}
t13     ⚠️ CORRUPTION DETECTED          writeFileSync: complete          {valid JSON, 3.2KB}
t14     Backup created (file now valid)                                  {valid JSON, 3.2KB}
```

**Key insight at t11-t12**: `writeFileSync` with `O_TRUNC` first truncates the file to 0 bytes, then writes the new content. During this window (microseconds to milliseconds), any reader sees an empty or partially-written file. This is the root cause of all reported corruptions.

---

## Impact Assessment

### Data Lost Per Corruption Event

| Field | Impact | Recovery |
|-------|--------|----------|
| `oauthAccount` | User logged out, must re-authenticate | Manual re-login |
| `primaryApiKey` | API access lost | Manual re-entry |
| `projects.*.hasTrustDialogAccepted` | Trust dialogs re-appear for all projects | Click through again |
| `projects.*.allowedTools` | Tool permissions reset | Re-approve each tool |
| `numStartups` | Startup counter reset | Cosmetic only |
| `toolUsage.*` | Tool usage history lost | Auto-rebuilds |
| `cachedGrowthBookFeatures` | Feature flags reset | Auto-refreshes |
| `chromeExtension.pairedDeviceId` | Chrome extension pairing lost | Re-pair |
| `mcpServers` (project-level) | MCP server configs lost | Manual re-configuration |
| `remoteControlAtStartup` | Remote Control feature disabled | Manual re-enable |

### Scale of Impact (from user reports)

- **#28813**: 315 corrupted backups in 7 days
- **#28837**: 718 corrupted backups in ~2 minutes (cascade)
- **#28923**: 369 corrupted files, complete data loss (userID, OAuth, projects)
- **#28988**: 291 corrupted backups in few hours
- **#29036**: 304 backups over 6 days, all settings reset each time

### User Workarounds

1. Only run one Claude Code instance at a time
2. Launch terminals 3-5 seconds apart
3. Periodic cleanup script for corrupted backups
4. Disable Remote Control (`enableRemoteConnections: false`)
5. Watchdog script to auto-restore from backup
6. Manual atomic edit via `jq` to temp file + `mv`

---

## Write Frequency Analysis

Config writes are triggered by:

| Trigger | Frequency | Fields Updated |
|---------|-----------|----------------|
| Tool call completion | Every few seconds | `toolUsage.{tool}.usageCount`, `toolUsage.{tool}.lastUsedAt` |
| Permission prompt response | User-triggered | `projects.*.allowedTools` |
| Session start | Once per session | `numStartups`, `firstStartTime` |
| Feature flag cache | Periodic | `cachedGrowthBookFeatures`, `cachedStatsigGates` |
| OAuth token refresh | Periodic | `oauthAccount` |
| Chrome extension pairing | Once | `chromeExtension.*` |
| Config changes (`/config`) | User-triggered | Various |
| Remote Control toggle | User-triggered | `remoteControlAtStartup` |

With **74 call sites** for `W8()` and high-frequency triggers like tool calls, the write contention is significant when multiple sessions are active.

---

## Environment Details

### Primarily Affected
- **OS**: Windows 11 Pro (Build 10.0.26200, 10.0.19045, 10.0.26100)
- **Shell**: Git Bash / MINGW64 / MSYS2, PowerShell
- **Terminals**: VS Code, IntelliJ IDEA, Windows Terminal
- **Concurrent actors**: Multiple CLI sessions, Chrome MCP (4 processes per tab group), Desktop app (4 child processes)

### Why Windows is More Affected
1. `renameSync()` fails with `EACCES` when target file is held by another process (unlike POSIX where rename is always atomic)
2. This triggers the non-atomic fallback in `Fe()`, which is the primary corruption vector
3. On POSIX, `rename()` succeeds even if the target is open by another process — readers get the old inode

---

## Conclusion

The v2.1.59 implementation already has the right architecture (atomic writes + file locking), but the **fallback paths re-introduce the vulnerability**. The fix requires:

1. **Removing** the non-atomic write fallback in `Fe()`
2. **Removing** the lockless write fallback in `W8()`/`nw()`
3. **Adding** retry-with-backoff to the read path (`s16()`)
4. **Reducing** write frequency through debouncing/coalescing
5. **Separating** high-frequency runtime data from critical auth/config data

See [FIX_PLAN.md](./FIX_PLAN.md) for detailed fix proposals with pseudocode.
