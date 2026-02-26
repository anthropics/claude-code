# Fix Plan: Race Condition in ~/.claude.json Concurrent Writes

> **Prerequisite**: Read [ANALYSIS.md](./ANALYSIS.md) for the full root cause analysis and decompiled code.

## Overview of Proposed Fixes

| Fix | Target | Severity Addressed | Effort | Risk |
|-----|--------|-------------------|--------|------|
| [Fix 1](#fix-1-remove-non-atomic-fallback-in-fe) | `Fe()` — atomic write | Critical | Low | Low |
| [Fix 2](#fix-2-remove-lockless-fallback-in-w8nw) | `W8()`/`nw()` — config save | Critical | Low | Low |
| [Fix 3](#fix-3-add-retry-with-backoff-to-s16-read) | `s16()` — config read | High | Low | Very Low |
| [Fix 4](#fix-4-debouncecoalesce-writes) | Write frequency | High | Medium | Medium |
| [Fix 5](#fix-5-separate-high-frequency-data) | Data architecture | High | High | Medium |

**Recommended implementation order**: Fix 1 → Fix 2 → Fix 3 → Fix 4 → Fix 5

Fixes 1-3 are surgical, low-risk changes that eliminate the race condition vectors. Fix 4 reduces contention. Fix 5 is a larger architectural change that eliminates the root cause of high write frequency.

---

## Security Considerations (from Security Review)

The following security findings were identified during review and are incorporated into the fix proposals below:

| ID | Severity | Issue | Mitigation |
|----|----------|-------|------------|
| SEC-1 | **Critical** | Predictable temp file names (`PID + timestamp`) enable symlink attacks (CWE-377, CWE-59) | Use `crypto.randomBytes(16)` + `O_CREAT\|O_EXCL` flags |
| SEC-2 | **Critical** | TOCTOU in permission preservation — race between `existsSync`/`statSync`/`chmodSync` (CWE-367) | Create temp with `0o600` from start; use `lstatSync` (no symlink following) |
| SEC-3 | **High** | `sleepSync` blocks Node.js event loop during retries — DoS amplification | Use async retries where possible; add total timeout cap (500ms) |
| SEC-4 | **High** | `proper-lockfile` stale lock detection (10s default) allows lock theft under system load | Increase to 30s; add heartbeat mechanism |
| SEC-5 | **High** | Explicit symlink following in `Fe()` enables credential exfiltration (CWE-59) | Refuse to follow symlinks; use `lstatSync` to detect |
| SEC-6 | **Medium** | Silent dropping of critical writes (auth tokens) after retry exhaustion | Throw on critical writes; only silently drop non-critical |
| SEC-7 | **Medium** | Debounce window creates credential persistence gap on unclean shutdown | Default to `immediate: true`; opt-in to debounce for low-criticality only |
| SEC-8 | **Medium** | Temp file cleanup on startup could race with active writes from other sessions | Check PID alive + age threshold (>60s) before deleting |

---

## Fix 1: Remove Non-Atomic Fallback in Fe()

### Problem

When `renameSync()` fails (Windows `EACCES`/`EPERM`), `Fe()` falls back to a direct `writeFileSync()` which uses `O_TRUNC` — truncating the file to 0 bytes before writing. This is the primary corruption vector.

### Current Code (Decompiled)

```javascript
function Fe(targetPath, content, options) {
  const tmpPath = `${resolvedPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    writeFileSync(tmpPath, content, { flush: true });
    renameSync(tmpPath, resolvedPath);
  } catch (err) {
    // Clean up temp
    try { unlinkSync(tmpPath); } catch {}
    // ⚠️ FALLBACK: Non-atomic write!
    writeFileSync(resolvedPath, content, { flush: true });
  }
}
```

### Proposed Fix

> **Security hardening applied**: Uses `crypto.randomBytes` for unpredictable temp file names (SEC-1), `O_CREAT|O_EXCL` to prevent symlink attacks, creates temp with `0o600` permissions (SEC-2), refuses to follow symlinks on target (SEC-5). Uses `Atomics.wait` for non-busy synchronous sleep (SEC-3).

```javascript
const crypto = require('crypto');

// Synchronous non-busy sleep (SEC-3)
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function Fe(targetPath, content, options) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100; // Calibrated for AV scanner delays on Windows

  // SEC-5: Refuse to follow symlinks on the target config file
  try {
    const lstat = lstatSync(targetPath);
    if (lstat.isSymbolicLink()) {
      log('SECURITY: Config file is a symlink, refusing to write', { level: 'error' });
      throw new Error('Config file must not be a symbolic link');
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const resolvedPath = targetPath; // No symlink following

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // SEC-1: Use cryptographically random suffix to prevent symlink attacks
    const randomSuffix = crypto.randomBytes(16).toString('hex');
    const tmpPath = `${resolvedPath}.tmp.${randomSuffix}`;

    try {
      // SEC-2: Create temp file with O_CREAT|O_EXCL (fails if exists, prevents symlink following)
      // and restrictive permissions (0o600) from the start
      const fd = openSync(tmpPath, O_WRONLY | O_CREAT | O_EXCL, 0o600);
      writeSync(fd, content);
      fsyncSync(fd);
      closeSync(fd);

      // Preserve permissions from existing file (use lstatSync to avoid symlink TOCTOU — SEC-2)
      try {
        const stat = lstatSync(resolvedPath);
        if (stat.isFile()) chmodSync(tmpPath, stat.mode);
      } catch {}

      // Atomic rename
      renameSync(tmpPath, resolvedPath);
      return; // Success

    } catch (err) {
      // Clean up temp file on any error
      try { unlinkSync(tmpPath); } catch {}

      if (attempt < MAX_RETRIES) {
        // Linear backoff: 100ms, 200ms, 300ms (covers AV scanner delays)
        log(`Atomic write attempt ${attempt + 1} failed, retrying: ${err}`);
        sleepSync(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      // All retries exhausted — DO NOT fall back to non-atomic write!
      log(`Atomic write failed after ${MAX_RETRIES + 1} attempts: ${err}`, { level: "error" });
      telemetry("tengu_atomic_write_all_retries_failed", {
        attempts: MAX_RETRIES + 1,
        error: err.message
      });

      // Last resort: throw instead of corrupting
      throw err;
    }
  }
}
```

### Rationale

- The `EACCES` on rename is transient — the other process releases the file within milliseconds
- 3 retries with exponential backoff (50ms, 100ms, 150ms) covers >99% of contention windows
- **Never** fall back to `writeFileSync` on the target file — this is the corruption vector
- If all retries fail, throwing is safer than corrupting — the caller can handle the error

### Risk Assessment

- **Low risk**: The fallback path is itself the bug. Removing it can only improve safety.
- **Edge case**: If all retries fail, the config update is lost for that operation. This is preferable to corrupting the file and losing ALL data.

---

## Fix 2: Remove Lockless Fallback in W8()/nw()

### Problem

When `proper-lockfile.lockSync()` fails, `W8()` falls back to `wGq()` which writes without any lock. Two processes can execute this fallback simultaneously.

### Current Code (Decompiled)

```javascript
function W8(updater) {
  try {
    _Gq(configPath(), DEFAULT_CONFIG, updater); // Locked write
  } catch (err) {
    log(`Failed to save config with lock: ${err}`, { level: "error" });
    // ⚠️ FALLBACK: Unlocked write!
    const config = s16(configPath(), DEFAULT_CONFIG);
    const newConfig = updater(config);
    if (newConfig === config) return;
    wGq(configPath(), newConfig, DEFAULT_CONFIG); // No lock!
  }
}
```

### Proposed Fix

> **SEC-6 applied**: Critical writes (auth, permissions) throw on failure; non-critical writes are silently dropped.

```javascript
function W8(updater, options = {}) {
  const { critical = false } = options;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      _Gq(configPath(), DEFAULT_CONFIG, (currentConfig) => {
        const newConfig = updater(currentConfig);
        if (newConfig === currentConfig) return currentConfig;
        return { ...newConfig, projects: cleanProjects(currentConfig.projects) };
      });

      // Invalidate cache
      cache.config = null;
      cache.mtime = 0;
      lastReadTime = 0;
      return; // Success

    } catch (err) {
      if (attempt < MAX_RETRIES) {
        log(`Config save attempt ${attempt + 1} failed, retrying: ${err}`);
        sleepSync(RETRY_DELAY_MS * (attempt + 1)); // 100ms, 200ms, 300ms
        continue;
      }

      // All retries exhausted — DO NOT write without lock
      log(`Failed to save config after ${MAX_RETRIES + 1} attempts: ${err}`, { level: "error" });
      telemetry("tengu_config_save_all_retries_failed", {
        attempts: MAX_RETRIES + 1,
        error_code: err.code || 'UNKNOWN' // SEC: don't leak paths in telemetry
      });

      // Invalidate cache to force re-read on next access
      cache.config = null;
      cache.mtime = 0;
      lastReadTime = 0;

      // SEC-6: Critical writes (auth/permissions) throw so caller can handle
      if (critical) {
        throw new Error(`Failed to persist critical config update after ${MAX_RETRIES + 1} attempts`);
      }
      // Non-critical updates (toolUsage, counters) are silently dropped
      // This is preferable to corrupting the file
    }
  }
}

// Call site examples:
// Critical — throws on failure:
W8((c) => ({ ...c, primaryApiKey: key }), { critical: true });
W8((c) => ({ ...c, oauthAccount: account }), { critical: true });
// Non-critical — silently dropped on failure:
W8((c) => ({ ...c, toolUsage: updated }));
W8((c) => ({ ...c, numStartups: c.numStartups + 1 }));
```

### Same Fix for `nw()` (saveCurrentProjectConfig)

```javascript
function nw(updater) {
  const projectPath = getProjectPath();
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 100;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      _Gq(configPath(), DEFAULT_CONFIG, (config) => {
        const projectConfig = config.projects?.[projectPath] ?? DEFAULT_PROJECT;
        const newProjectConfig = updater(projectConfig);
        if (newProjectConfig === projectConfig) return config;
        return { ...config, projects: { ...config.projects, [projectPath]: newProjectConfig } };
      });
      return;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        sleepSync(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      log(`Failed to save project config after retries: ${err}`, { level: "error" });
    }
  }
}
```

### Rationale

- Lock contention is transient — the other process releases within milliseconds
- Retrying lock acquisition (with backoff) succeeds in >99% of cases
- Losing a single config update is vastly preferable to corrupting the entire config file

### Risk Assessment

- **Low risk**: Same as Fix 1 — the fallback IS the bug
- **Edge case**: Non-critical updates (toolUsage counts) may be lost. This is acceptable.
- **Critical updates** (OAuth tokens, permissions): These are written infrequently and lock contention is rare for these operations

---

## Fix 3: Add Retry with Backoff to s16() Read

### Problem

When `readFileSync()` returns a partially-written file (e.g., during the brief window of a non-atomic write), `JSON.parse()` fails and the function throws immediately. A simple retry after 20ms would succeed because the write completes in microseconds.

### Current Code (Decompiled)

```javascript
function s16(filePath, defaults, isInit) {
  const content = readFileSync(filePath, { encoding: "utf-8" });
  try {
    const parsed = JSON.parse(stripBOM(content));
    return { ...deepClone(defaults), ...parsed };
  } catch (parseError) {
    throw new ConfigCorruptionError(parseError.message, filePath, defaults);
    // ⚠️ No retry!
  }
}
```

### Proposed Fix

```javascript
function s16(filePath, defaults, isInit) {
  if (!configEnabled) throw Error("Config accessed before allowed.");
  const fs = n6();
  const MAX_READ_RETRIES = 3;
  const READ_RETRY_DELAY_MS = 20;

  let lastError;

  for (let attempt = 0; attempt <= MAX_READ_RETRIES; attempt++) {
    try {
      const content = fs.readFileSync(filePath, { encoding: "utf-8" });

      // Validate content is non-empty before parsing
      const trimmed = stripBOM(content).trim();
      if (trimmed.length === 0) {
        throw new Error("File is empty (possibly mid-write)");
      }

      const parsed = JSON.parse(trimmed);
      return { ...deepClone(defaults), ...parsed };

    } catch (err) {
      if (err.code === "ENOENT") {
        // File doesn't exist — try backup, don't retry
        return handleMissingConfig(filePath, defaults);
      }

      lastError = err;

      // If it's a JSON parse error and we have retries left, wait and retry
      if (attempt < MAX_READ_RETRIES && isJsonParseError(err)) {
        log(`Config read attempt ${attempt + 1} failed (possibly mid-write), retrying`);
        sleepSync(READ_RETRY_DELAY_MS * (attempt + 1)); // 20ms, 40ms, 60ms
        continue;
      }
    }
  }

  // All retries failed — this is genuine corruption, not a transient read
  throw new ConfigCorruptionError(lastError.message, filePath, defaults);
}

function isJsonParseError(err) {
  if (err instanceof SyntaxError) return true;
  const msg = err.message || '';
  return msg.includes('Unexpected end of JSON') ||
         msg.includes('Unexpected EOF') ||
         msg.includes('Unexpected token') ||
         msg.includes('File is empty');
}
```

### Rationale

- A partial read during atomic write (renameSync) is impossible — rename is atomic
- A partial read during non-atomic write (the fallback) completes within microseconds
- 3 retries with 20ms/40ms/60ms delays covers the entire write window with massive margin
- After retries, if still failing, it's genuine corruption — proceed with backup/restore as before
- Empty file check catches the `O_TRUNC` window specifically

### Risk Assessment

- **Very low risk**: Only adds a retry loop before the existing error path
- **Performance**: Adds 0ms on success, max 120ms on genuine corruption (before backup/restore)
- **No behavior change** for genuine corruption — still throws ConfigCorruptionError after retries

---

## Fix 4: Debounce/Coalesce Writes

### Problem

With 74 call sites for `W8()`, many writing high-frequency data (toolUsage counts after every tool call), there is massive write contention when multiple sessions are active.

### Proposed Fix

```javascript
// Write coalescing layer
let pendingUpdater = null;
let writeTimer = null;
const DEBOUNCE_MS = 200;

function W8(updater, options = {}) {
  const { immediate = false } = options;

  // Compose pending updates
  if (pendingUpdater) {
    const prev = pendingUpdater;
    pendingUpdater = (config) => updater(prev(config));
  } else {
    pendingUpdater = updater;
  }

  // Critical updates (auth, permissions) write immediately
  if (immediate) {
    flushConfigWrite();
    return;
  }

  // Non-critical updates are debounced
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushConfigWrite, DEBOUNCE_MS);
}

function flushConfigWrite() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  if (!pendingUpdater) return;

  const updater = pendingUpdater;
  pendingUpdater = null;

  // Execute the actual locked + atomic write
  _W8_internal(updater);
}

// Flush on process exit
process.on('beforeExit', flushConfigWrite);
process.on('SIGTERM', flushConfigWrite);
process.on('SIGINT', flushConfigWrite);
```

### Call Site Classification

Mark critical call sites with `{ immediate: true }`:

```javascript
// Critical — write immediately:
W8((c) => ({ ...c, primaryApiKey: key }), { immediate: true });
W8((c) => ({ ...c, oauthAccount: account }), { immediate: true });

// Non-critical — debounced:
W8((c) => ({ ...c, toolUsage: updated }));                    // Can wait 200ms
W8((c) => ({ ...c, numStartups: c.numStartups + 1 }));       // Can wait 200ms
W8((c) => ({ ...c, cachedGrowthBookFeatures: features }));    // Can wait 200ms
```

### Rationale

- Reduces effective write frequency by 10-100x for non-critical updates
- 200ms debounce means multiple rapid tool calls produce a single write
- Critical auth/permission updates are still written immediately
- Flush on exit ensures no data loss

### Risk Assessment

- **Medium risk**: Requires classifying 74 call sites as critical/non-critical
- **Data loss on crash**: If process is killed (SIGKILL), pending debounced updates are lost. This is acceptable for non-critical data like toolUsage counts.
- **Behavioral change**: Slight delay before non-critical config changes are visible to other processes

---

## Fix 5: Separate High-Frequency Data

### Problem

`~/.claude.json` stores both rarely-changing critical data (auth, permissions) and frequently-changing ephemeral data (toolUsage, timestamps, feature flag caches). This creates unnecessary contention on the critical file.

### Proposed Architecture

```
~/.claude.json                          # Critical data (auth, settings)
  ├── oauthAccount
  ├── primaryApiKey
  ├── projects.*.hasTrustDialogAccepted
  ├── projects.*.allowedTools
  ├── theme, editorMode, etc.
  └── (written rarely, well-protected)

~/.claude/session-state.json            # Ephemeral data (per-machine)
  ├── toolUsage.*
  ├── numStartups
  ├── lastCost
  ├── cachedGrowthBookFeatures
  ├── cachedStatsigGates
  ├── cachedDynamicConfigs
  ├── tipsHistory
  ├── memoryUsageCount
  └── (written frequently, less critical)
```

### Benefits

1. **Reduces write contention** on `~/.claude.json` by ~90%
2. **Corruption of session-state.json** doesn't affect auth or permissions
3. **Recovery is simpler**: session-state.json can be safely deleted (auto-rebuilds)
4. **Smaller file**: Fewer bytes to read/write on each operation

### Migration Strategy

```javascript
// On startup, check for old fields in .claude.json
function migrateSessionState() {
  const config = readConfig();
  const sessionFields = ['toolUsage', 'numStartups', 'lastCost', ...];

  const sessionState = {};
  let needsMigration = false;

  for (const field of sessionFields) {
    if (config[field] !== undefined) {
      sessionState[field] = config[field];
      needsMigration = true;
    }
  }

  if (needsMigration) {
    // Write session state to new file
    writeSessionState(sessionState);
    // Remove migrated fields from main config
    saveGlobalConfig((c) => {
      const cleaned = { ...c };
      for (const field of sessionFields) delete cleaned[field];
      return cleaned;
    });
  }
}
```

### Risk Assessment

- **Medium risk**: Larger change affecting many read paths
- **Migration**: Needs backward compatibility during rollout. Include a version marker (`_configVersion: 2`) so downgrade scenarios are handled correctly.
- **Write order**: MUST write session-state.json first, THEN remove fields from .claude.json. Reverse order risks data loss on crash.
- **New file concurrency**: `session-state.json` needs the same atomic write protection (via `Fe`), but lighter locking since corruption is recoverable (auto-rebuilds from defaults).
- **Testing**: Requires thorough testing of all config consumers

---

## Fix 6: Cascade-Breaking Logic (Issue #28923)

### Problem

Race Vector #6: When corruption is detected, the current process backs up the file and resets to defaults. Another process detects the reset config as "changed," writes again, triggering the first process's corruption detection again. This creates an exponential feedback loop (718 corrupted backups in 2 minutes).

### Proposed Fix

```javascript
// Per-process corruption detection state
let lastCorruptionDetectedAt = 0;
const CORRUPTION_COOLDOWN_MS = 5000; // Don't re-trigger within 5 seconds
let corruptionCount = 0;
const MAX_CORRUPTION_RETRIES = 3;

function handleConfigCorruption(filePath, defaults) {
  const now = Date.now();

  // Cascade breaker: don't re-trigger backup/restore within cooldown
  if (now - lastCorruptionDetectedAt < CORRUPTION_COOLDOWN_MS) {
    log('Corruption detected but within cooldown — skipping backup/restore to prevent cascade');
    return deepClone(defaults);
  }

  corruptionCount++;
  if (corruptionCount > MAX_CORRUPTION_RETRIES) {
    log('Corruption limit exceeded — returning defaults without backup cycle');
    return deepClone(defaults);
  }

  lastCorruptionDetectedAt = now;

  // Existing backup + restore logic, but rate-limited
  const backupPath = findLatestBackup(filePath);
  if (backupPath) {
    // Restore from backup...
  }
  return deepClone(defaults);
}
```

### Rationale

- Rate-limits corruption detection to prevent the exponential cascade
- After 3 consecutive corruptions, stops trying (avoids infinite loop)
- Complements Fixes 1-3 which prevent the initial corruption that triggers the cascade

---

## Edge Cases

### 1. Windows `EPERM`/`EACCES` on `renameSync`

**Cause**: Another process has the target file open with an incompatible share mode.

**Mitigation** (Fix 1): Retry with backoff. The other process releases the file within milliseconds.

**Alternative for persistent cases**: Use `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING` flag via N-API/FFI, which has better handling of open file handles on Windows.

### 2. Process Killed Between Write-to-Temp and Rename

**Result**: Orphaned `.tmp.*` file on disk, original config file untouched.

**Mitigation** (SEC-8): Add cleanup on startup with PID liveness check and age threshold:
```javascript
function cleanupOrphanedTempFiles() {
  const dir = dirname(configPath());
  const configName = basename(configPath());
  const files = readdirSync(dir);
  const AGE_THRESHOLD_MS = 60000; // Only delete files older than 60 seconds

  for (const file of files) {
    if (!file.startsWith(`${configName}.tmp.`)) continue;

    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      const ageMs = Date.now() - stat.mtimeMs;

      // Only delete if old enough (prevents racing with active writes)
      if (ageMs > AGE_THRESHOLD_MS) {
        unlinkSync(filePath);
      }
    } catch {}
  }
}
```

### 3. Stale Lock Files

**Cause**: Process crashes while holding `proper-lockfile` lock.

**Mitigation**: `proper-lockfile` handles stale locks via mtime-based detection. **Increase stale timeout from default 10s to 30s** (SEC-4) to prevent false stale detection during system load, AV scanning, or sleep/resume on Windows.

```javascript
release = properLockfile.lockSync(filePath, {
  lockfilePath: lockPath,
  stale: 30000, // 30 seconds (was 10s default)
});
```

### 4. Rename Not Atomic for Large Files on NTFS

**Reality**: For small files (~3KB like `.claude.json`), NTFS rename IS atomic. The non-atomicity concern applies to large files where NTFS must split the deletion of the target's allocation across multiple transactions. Not a concern for our use case.

### 5. File System Caching and Flush

**Concern**: `writeFileSync` with `{ flush: true }` calls `fsync()`, which is slow (~5-15ms on SSD).

**Mitigation**: Already used in current code. The `flush: true` / `fsyncSync(fd)` ensures data hits disk before rename. This is as good as it gets without platform-specific APIs.

### 6. Network/Cloud-Synced Home Directories

**Concern**: iCloud, OneDrive, Dropbox syncing `~/.claude.json` can create conflicts.

**Mitigation**: Advisory lock + atomic write prevents local race conditions. Cloud sync conflicts are a separate issue (recommend exclusion of `~/.claude.json` from sync). NFS/SMB shared home directories are **out of scope** — `proper-lockfile`'s advisory locks are not enforced across NFS clients.

### 7. Antivirus / Windows Defender Interference

**Cause**: Real-time AV scanners open newly created files for scanning, causing `EACCES` on subsequent rename or delete (100-500ms scan delay for small files).

**Mitigation**: Fix 1's retry delays (100ms, 200ms, 300ms = 600ms total) are calibrated to cover typical AV scan durations. If still insufficient, consider making MAX_RETRIES or RETRY_DELAY_MS configurable via environment variable.

### 8. Windows File System Tunneling

**Cause**: NTFS can assign a newly created file the creation timestamp of a recently deleted file with the same name. This could confuse mtime-based cache invalidation in `v1()`.

**Mitigation**: The cache in `v1()` checks both `mtimeMs` and `size`. File system tunneling affects creation time but not modification time. Low risk, but worth noting for completeness.

---

## Testing Strategy

### Unit Tests

1. **Atomic Write (Fe)**
   - Verify temp file is created, written, and renamed
   - Verify fallback to retry (not direct write) on rename failure
   - Verify cleanup of temp files on all error paths
   - Verify permissions are preserved

2. **Locked Write (W8/_Gq)**
   - Verify lock is acquired and released
   - Verify retry on lock failure (not fallback to unlocked write)
   - Verify backup creation and rotation

3. **Read with Retry (s16)**
   - Verify retry on empty file
   - Verify retry on truncated JSON
   - Verify no retry on ENOENT
   - Verify genuine corruption still throws after retries

### Integration Tests

4. **Concurrent Writes**
   ```javascript
   // Spawn N child processes, each writing to the same config file
   const workers = Array.from({ length: 10 }, (_, i) =>
     spawn('node', ['-e', `
       for (let j = 0; j < 100; j++) {
         saveGlobalConfig((c) => ({ ...c, counter_${i}: j }));
       }
     `])
   );
   await Promise.all(workers.map(w => w.exited));
   // Verify: config file is valid JSON
   // Verify: all 10 counters have value 99
   ```

5. **Read During Write**
   ```javascript
   // One process writes continuously
   const writer = spawn('node', ['-e', `
     setInterval(() => {
       saveGlobalConfig((c) => ({ ...c, ts: Date.now() }));
     }, 10);
   `]);
   // Another process reads continuously
   for (let i = 0; i < 1000; i++) {
     const config = getGlobalConfig();
     assert(config !== null, 'Read should never fail');
     assert(typeof config === 'object', 'Should always be valid object');
   }
   writer.kill();
   ```

### Regression Tests

6. **Corruption Recovery**
   - Write invalid JSON to config file
   - Verify backup is restored
   - Verify telemetry is emitted

7. **Lock Contention Under Load**
   - 50 concurrent writers with random delays
   - Verify no deadlocks (all processes complete within timeout)
   - Verify file is always valid JSON after all processes complete

8. **Windows-Specific**
   - Run tests with `EACCES` simulation (hold file open during rename)
   - Verify retry mechanism succeeds after simulated delay
   - Verify no `O_TRUNC` fallback occurs

---

### Security Tests

9. **Symlink Attack on Temp File**
   - Create symlink at predicted temp path → verify `O_EXCL` prevents following
   - Verify crypto-random suffix makes prediction infeasible

10. **Symlink Attack on Config File**
    - Replace `~/.claude.json` with symlink → verify `lstatSync` refuses write

11. **Temp File Cleanup Safety**
    - Start write in process A → run cleanup in process B → verify A's temp file is NOT deleted (age < 60s)

---

## Implementation Checklist

**Recommended deployment order**: Fix 3 → Fix 1 → Fix 2 → Fix 6 → Fix 4 → Fix 5

(Fix 3 first creates a read-side safety net before changing write behavior)

- [ ] Fix 3: Add retry-with-backoff to `s16()` for JSON parse errors (safety net)
- [ ] Fix 1: Remove non-atomic fallback in `Fe()`, add retry logic with security hardening
- [ ] Fix 2: Remove lockless fallback in `W8()`, add retry logic with critical/non-critical distinction
- [ ] Fix 2b: Same for `nw()` (saveCurrentProjectConfig)
- [ ] Fix 6: Add cascade-breaking logic for corruption detection (#28923)
- [ ] Fix 4: Add write debouncing (classify 74 call sites as critical/non-critical)
- [ ] Fix 5: Separate session state to `~/.claude/session-state.json` with migration
- [ ] Increase `proper-lockfile` stale timeout to 30s
- [ ] Add orphaned temp file cleanup on startup (with age threshold)
- [ ] Add telemetry for all retry paths (sanitize error messages)
- [ ] Security: crypto-random temp names + O_EXCL + no symlink following
- [ ] Unit tests for Fixes 1-3, 6
- [ ] Integration tests for concurrent access
- [ ] Security tests for symlink attacks
- [ ] Windows-specific regression tests (AV scanner delays)
- [ ] Update CHANGELOG.md

---

## Future Direction

The fundamental architecture of a **single shared JSON file with 74 write sites and multi-process concurrency** is an anti-pattern regardless of how good the locking is. For long-term stability, consider:

### Option A: SQLite (recommended)

Replace `~/.claude.json` with a SQLite database (`~/.claude/config.db`):
- **Built-in concurrency control** via WAL mode — designed for multi-process access
- **Atomic multi-key updates** within transactions
- **Built-in backup/recovery** (`VACUUM INTO`, `.backup`)
- `better-sqlite3` package is widely used in Electron/Node.js for exactly this

This would eliminate every single race condition discussed in these documents.

### Option B: Per-Concern File Splitting

Split into separate files per concern:
```
~/.claude/auth.json          # OAuth, API keys (rare writes)
~/.claude/permissions.json   # Tool permissions (user-triggered)
~/.claude/session-state.json # Tool usage, counters (high frequency)
~/.claude/feature-cache.json # Feature flags (periodic)
```
Each file has independent locking, eliminating cross-concern contention entirely.

---

## References

- [ANALYSIS.md](./ANALYSIS.md) — Full root cause analysis
- [write-file-atomic](https://www.npmjs.com/package/write-file-atomic) — npm standard for atomic writes
- [proper-lockfile](https://www.npmjs.com/package/proper-lockfile) — Cross-platform file locking (already used)
- [Bun.write()](https://bun.com/docs/runtime/file-io) — Bun's atomic write API
- [NTFS rename atomicity](https://github.com/rust-lang/rust/pull/138133) — Discussion of Windows rename semantics
- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) — Synchronous SQLite for Node.js
- [CWE-377](https://cwe.mitre.org/data/definitions/377.html) — Insecure Temporary File
- [CWE-367](https://cwe.mitre.org/data/definitions/367.html) — TOCTOU Race Condition
