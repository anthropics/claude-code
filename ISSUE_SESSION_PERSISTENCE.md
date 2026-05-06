# [BUG] [Critical Data Loss] VS Code Extension Does Not Persist Main Conversation Transcripts

## Executive Summary

The Claude Code VS Code extension (and compatible IDEs: Cursor, Antigravity) **does not reliably persist main conversation transcripts to disk**. When the IDE restarts or the extension updates, conversation history disappears permanently. This affects every version tested from v2.0.44 through v2.1.92. The CLI correctly persists conversations; the extension does not.

**Root cause**: The extension's `SessionManager` class has no method to incrementally write user/assistant messages during normal conversation. The CLI subprocess writes to a JSONL file via a buffered writer, but the extension kills the CLI process before the buffer can flush — creating a race condition that silently drops the last messages or, in some configurations, the entire session.

**Impact**: 12+ duplicate issues filed since December 2025 (see [Related Issues](#related-issues)), affecting hundreds of users across macOS, Windows, and Linux.

---

## Related Issues

| Issue | Title | Status | Filed |
|-------|-------|--------|-------|
| [#12908](https://github.com/anthropics/claude-code/issues/12908) | Conversation History disappeared after update | **Open** | Dec 2025 |
| [#22900](https://github.com/anthropics/claude-code/issues/22900) | [Critical Data Loss] VSCode extension does not persist main conversation transcripts to disk | Closed (dup) | Feb 2026 |
| [#12114](https://github.com/anthropics/claude-code/issues/12114) | Session history lost after auto-update from 2.0.44 to 2.0.49 | Closed (dup) | Dec 2025 |
| [#12872](https://github.com/anthropics/claude-code/issues/12872) | VS Code Extension: Past Conversations not loaded after restart | Closed (dup) | Dec 2025 |
| [#9258](https://github.com/anthropics/claude-code/issues/9258) | History Sessions lost in Vscode plugin | Open | Nov 2025 |
| [#18619](https://github.com/anthropics/claude-code/issues/18619) | Past conversations not showing in dropdown - sessions-index.json not being updated | Open | Jan 2026 |
| [#24877](https://github.com/anthropics/claude-code/issues/24877) | Extension update silently deletes conversation history without warning or migration | Open | Feb 2026 |
| [#25524](https://github.com/anthropics/claude-code/issues/25524) | Previous sessions not showing in desktop app sidebar | Open | Feb 2026 |
| [#27349](https://github.com/anthropics/claude-code/issues/27349) | Claude Desktop upgrade erases Claude Code local chat history every time | Open | Feb 2026 |
| [#13872](https://github.com/anthropics/claude-code/issues/13872) | Chat history lost on VSCode restart - session files not saved (macOS) | Closed (dup) | Dec 2025 |
| [#34536](https://github.com/anthropics/claude-code/issues/34536) | Conversation lost and unresumable after Cursor IDE refresh | Open | Mar 2026 |
| [#40877](https://github.com/anthropics/claude-code/issues/40877) | Active sessions missing from sidebar + memory/session persistence unreliable | Open | Mar 2026 |
| [#43237](https://github.com/anthropics/claude-code/issues/43237) | Chat history disappears | Open | Apr 2026 |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                VS Code Extension (extension.js)          │
│                                                          │
│  ┌─────────────────────────────┐                         │
│  │  SessionManager (Y1 class)  │                         │
│  │  - fetchSessions()          │  Reads JSONL at display │
│  │  - ensureSessionLoaded()    │  Reads JSONL for resume │
│  │  - saveSession()            │  Writes ONLY on teleport│
│  │  - renameSession()          │                         │
│  │  - forkSession()            │                         │
│  │  ❌ NO appendMessage()      │  ← MISSING              │
│  └──────────┬──────────────────┘                         │
│             │                                            │
│  ┌──────────▼──────────────────┐                         │
│  │  LaunchClaude (async IIFE)  │                         │
│  │  for await (let L of Z) {   │  Message stream loop    │
│  │    this.send(io_message, L) │  → Sends to webview     │
│  │  }                          │                         │
│  │  this.closeChannel(K, true) │  → Kills CLI subprocess │
│  └──────────┬──────────────────┘                         │
│             │ spawns via SDK ED()                         │
└─────────────┼───────────────────────────────────────────-┘
              │
┌─────────────▼───────────────────────────────────────────-┐
│             CLI Subprocess (@anthropic-ai/claude-code)     │
│                                                            │
│  ┌──────────────────────────────┐                          │
│  │  Buffered Writer (Sg class)  │                          │
│  │  - 1-second flush interval   │  Batches writes          │
│  │  - setImmediate() drain      │  Async flush             │
│  │  - appendFile() to JSONL     │  Incremental write       │
│  └──────────┬───────────────────┘                          │
│             │                                              │
│  Writes to: ~/.claude/projects/<hash>/<sessionId>.jsonl    │
└─────────────┼──────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────-┐
│  Filesystem                                                │
│                                                            │
│  ~/.claude/projects/<project-hash>/                        │
│  ├── <sessionId>.jsonl          ← Main transcript          │
│  ├── <sessionId>/                                          │
│  │   ├── subagents/             ← Subagent transcripts     │
│  │   │   ├── agent-<id>.jsonl   (isSidechain: true)        │
│  │   │   └── agent-<id>.meta.json                          │
│  │   └── tool-results/          ← Tool output files        │
│  └── ...                                                   │
│                                                            │
│  %APPDATA%/Claude/claude-code-sessions/                    │
│  └── <workspace-uuid>/                                     │
│      └── <session-group-uuid>/                             │
│          └── local_<id>.json    ← IDE session metadata     │
│              { cliSessionId, title, model, ... }           │
│                                                            │
│  ~/.claude/sessions/                                       │
│  └── <pid>.json                 ← PID-to-session mapping   │
└────────────────────────────────────────────────────────────┘
```

---

## Root Cause Analysis — 4 Layers

### Layer 1: Buffer Flush Race in `closeChannel()`

When a conversation ends (user closes tab, IDE restarts, etc.), the extension calls `closeChannel()` which immediately terminates the CLI subprocess:

```javascript
// Minified extension.js — closeChannel method
async closeChannel(K, V, B) {
  if (this.logger.log(`Closing Claude on channel: ${K}`), V)
    this.send({ type: "close_channel", channelId: K, error: B });
  let j = this.channels.get(K);
  if (j) {
    j.in.done();
    try { await j.query.return() } catch (H) { /* warn */ }
    this.channels.delete(K);
  }
}
```

The CLI's buffered writer (`Sg` class) operates on a **1-second flush interval** with `setImmediate()` drain. When `closeChannel()` kills the CLI, any messages still in the write buffer are lost.

**Evidence**: Users report that the last few messages of a conversation are missing even when the JSONL file exists. This is consistent with a buffer flush race: most messages are written, but the final batch (within the last ~1 second) is dropped.

### Layer 2: No Incremental Write from Extension Side

The `SessionManager` class (`Y1` in minified code) has these write methods:

| Method | When it writes | What it writes |
|--------|---------------|----------------|
| `saveSession()` | Only on **teleport/fork** operations | Full session overwrite via `writeFile()` |
| `renameSession()` | User renames a session | Metadata update |
| `appendSkippedBranch()` | Branch switching | Branch marker |

**Missing**: There is **no `appendMessage()`** method that writes each user/assistant message incrementally during normal conversation. The extension relies entirely on the CLI subprocess to handle persistence.

This creates a single point of failure: if the CLI fails to write (buffer race, crash, EPERM error), the message is lost with no fallback.

**Evidence**: User @Curious07Cress (issue #22900) documented that session folders contain `subagents/` and `tool-results/` directories but **no main JSONL file** — meaning the CLI never created the file or never flushed a single write.

### Layer 3: `fetchSessions()` Filters Out Sessions Without Title

The `fetchSessions()` method, which populates the session history dropdown, silently drops sessions that have no title or summary:

```javascript
// Minified extension.js — fetchSessions filter
if (!W) return null;  // W = title/summary extracted from JSONL
return {
  lastModified: U,
  fileSize: Z,
  id: H,
  isSidechain: !1,
  summary: W,
  gitBranch: e8(x, "gitBranch")
};
```

If a session's JSONL exists but contains no summary entry (common when the CLI was killed before writing one), `fetchSessions()` returns `null` for that session — hiding it from the UI entirely.

**Evidence**: User @ShirazC (comment on #12908): _"history shows up when using terminal version, but not the vscode extension UI"_ — the JSONL files exist, but `fetchSessions()` doesn't list them.

### Layer 4: No Graceful Shutdown Protocol

When the IDE closes or refreshes, there is no shutdown handshake between the extension and CLI:

1. Extension receives `deactivate()` event
2. Extension calls `closeChannel()` for each active channel
3. `closeChannel()` immediately terminates the CLI
4. CLI's write buffers are abandoned

A proper shutdown would:
1. Send a "flush and exit" signal to the CLI
2. Wait for the CLI to confirm writes are flushed (or timeout after ~2 seconds)
3. Only then terminate the process

**Evidence**: User @scotch83 (comment on #12908): _"Yesterday I even exited the REPL with /exit command and restarted, used the /resume command and the conversation was available! Today I restarted my computer and 'pouf!' disappeared!"_ — `/exit` triggers a clean CLI shutdown (buffers flush), but IDE restart does not.

---

## JSONL File Format Reference

Each line in a session JSONL file is a self-contained JSON object. Message types:

```jsonc
// User message
{"type":"user","message":{"role":"user","content":"Hello"},"uuid":"<uuid>","parentUuid":"<prev-uuid>","sessionId":"<session-uuid>","timestamp":"2026-04-06T23:45:15.777Z","cwd":"/path","version":"2.1.92","isSidechain":false}

// Assistant message
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],"model":"claude-opus-4-6","id":"msg_xxx","stop_reason":"end_turn"},"uuid":"<uuid>","parentUuid":"<user-uuid>","sessionId":"<session-uuid>","timestamp":"...","isSidechain":false}

// Queue operation (session lifecycle)
{"type":"queue-operation","operation":"enqueue","timestamp":"...","sessionId":"..."}

// Summary (used for session title display)
{"type":"summary","leafUuid":"<uuid>","summary":"User asked about..."}
```

Messages are chained via `uuid` → `parentUuid`, forming a linked list that can be traversed to reconstruct the full conversation transcript.

---

## Proposed Fixes

### Fix 1: Graceful Shutdown Delay in `closeChannel()`

Add a 1.2-second delay before killing the CLI subprocess, allowing the buffered writer to flush:

```javascript
async closeChannel(K, V, B) {
  // ... existing logic ...
  if (j) {
    j.in.done();
    try {
      await new Promise(r => setTimeout(r, 1200)); // Wait for CLI buffer flush
      await j.query.return();
    } catch (H) { /* warn */ }
    this.channels.delete(K);
  }
}
```

**Why 1.2s**: The buffered writer has a 1-second flush interval. Adding 200ms margin ensures at least one flush cycle completes.

### Fix 2: Add `appendMessage()` to SessionManager

Add an incremental write method that the extension calls for every message received from the CLI stream:

```javascript
async appendMessage(sessionId, message) {
  if (!message || !message.uuid) return;
  if (message.isSidechain) return;
  const dir = getProjectSessionDir(this.projectRoot);
  const file = path.join(dir, `${sessionId}.jsonl`);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.appendFile(file, JSON.stringify(message) + '\n');
}
```

This creates a **redundant write path**: even if the CLI's buffered writer fails, the extension has its own copy. Deduplication at read time (by UUID) handles the double-write case.

### Fix 3: Fallback Title in `fetchSessions()`

Don't hide sessions that lack a title/summary — show them with a fallback:

```javascript
// Instead of: if (!W) return null;
if (!W) W = "Session " + H.slice(0, 8);
```

### Fix 4: Secondary Persistence Hook in Message Stream

Hook into the `for await` loop that processes CLI messages to persist each one:

```javascript
for await (let L of Z) {
  this.send({ type: "io_message", channelId: K, message: L, done: false });
  br(L);
  // Persist message
  if (L && L.sessionId && L.uuid && (L.type === "user" || L.type === "assistant") && !L.isSidechain) {
    SessionManager.load(this.cwd, this.logger)
      .then(mgr => mgr.appendMessage(L.sessionId, L))
      .catch(() => {});
  }
}
```

---

## Diagnostic Tool

A diagnostic script is provided in this repository to help affected users verify the state of their session persistence:

```bash
# Scan all sessions
bun run scripts/diagnose-session-persistence.ts

# Machine-readable output
bun run scripts/diagnose-session-persistence.ts --json

# Detailed analysis
bun run scripts/diagnose-session-persistence.ts --verbose

# Analyze a specific session
bun run scripts/diagnose-session-persistence.ts --session <uuid>
```

The script detects:
- `MISSING_JSONL` — IDE knows the session but no JSONL file exists (data loss)
- `TRUNCATED_WRITE` — Last line invalid (buffer flush race)
- `BROKEN_CHAIN` — parentUuid references non-existent messages (partial loss)
- `DUPLICATE_UUIDS` — Messages written twice (redundancy indicator)
- `ORPHANED_IDE_SESSION` — IDE metadata with no matching project session
- `DEAD_PID_SESSION` — PID file for a dead process (unclean shutdown)
- `EMPTY_SESSION` — JSONL exists but has no user/assistant messages

---

## Affected Versions

| Version Range | Persistence Behavior |
|---------------|---------------------|
| v2.0.44 – v2.0.56 | Partially works (unclear mechanism) |
| v2.0.57+ | Broken — conversations lost on IDE restart |
| v2.1.x (all tested) | Broken — CLI writes are the only persistence path; buffer race causes data loss |

**Platforms**: Windows, macOS, Linux
**IDEs**: VS Code, VS Code Insiders, Cursor, Antigravity

---

## How to Reproduce

1. Install Claude Code extension in VS Code (any version v2.0.57+)
2. Start a conversation with 5+ exchanges
3. Close the VS Code window (not `/exit`, just close the window)
4. Reopen VS Code
5. Check the session history dropdown — the conversation may be missing or truncated
6. Check `~/.claude/projects/<hash>/` — the JSONL file may be missing or have a truncated last line

**Reliable reproduction**: Force-kill the VS Code process (`taskkill /f` on Windows, `kill -9` on Unix) during an active conversation. The session will almost certainly be lost or truncated.

---

## Workaround

Use the CLI version instead of the IDE extension for critical conversations:

```bash
npm install -g @anthropic-ai/claude-code
claude
```

The CLI persists conversations correctly because it controls its own shutdown lifecycle and can flush buffers before exiting.

For the IDE extension, users can try:
- Always end conversations with `/exit` (triggers clean CLI shutdown)
- Avoid force-closing or restarting the IDE during active conversations
- Use the diagnostic script to verify session integrity after important conversations
