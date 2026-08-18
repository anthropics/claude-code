# Feature Proposal: CLI-Desktop Conversation Sync

## Summary

Sync Claude Code CLI conversation history with the Claude desktop app so users can browse, search, and review past sessions from either interface. The two products currently use independent storage backends with no sync path.

## Motivation

- Desktop app offers superior browsing UI (search, sidebar, timestamps)
- CLI offers superior power-user workflow (automation, scripting, pipelines)
- Users must choose between them — unnecessary tradeoff
- Competitor precedent: OpenAI Codex CLI syncs with ChatGPT desktop app

## Existing Infrastructure

Claude Code already stores session data in `~/.claude/projects/**/*.jsonl` with a shared schema. The session system has:

- Session ID (UUID per session)
- Feedback ID (for error reporting)
- Resume mechanism (`claude --resume`)
- Stats cache (`~/.claude/stats-cache.json`)

The desktop app stores conversations in its own database (platform-specific).

## Proposed Architecture

### Option A: Account-Based Sync (Recommended)

Both products push/pull conversation metadata via the Claude API, keyed to the user's account.

**CLI side**:
- After each session turn, push a lightweight metadata record (session_id, model, message_count, timestamp, last_summary) to the API
- On startup, pull the session index for account-based history browsing

**Desktop side**:
- Subscribe to the same API endpoint
- Display CLI sessions alongside desktop sessions in the conversation list
- Use the existing session ID for deep-link resume (`claude://session/<id>`)

**Advantages**: Works across devices, no local coordination needed, mirrors Codex/ChatGPT pattern.

### Option B: Local Storage Bridge

The CLI writes session metadata to the desktop app's storage directory.

- **macOS**: `~/Library/Application Support/Claude/`
- **Windows**: `%APPDATA%\Claude\`
- **Linux**: `~/.config/Claude/`

A shared `.jsonl` index file in the desktop app's directory that both products read/write. The CLI appends new session records; the desktop app reads the index for its conversation list.

**Advantages**: No API changes needed, works offline.
**Disadvantages**: Single-machine only, race conditions on concurrent writes.

### Option C: Shared Session Format

Both products adopt the same `.jsonl` schema and storage location. The desktop app reads directly from `~/.claude/projects/` and displays CLI sessions natively.

**Advantages**: Minimal changes, leverages existing CLI storage.
**Disadvantages**: Desktop app would need to parse CLI-specific session files, schema coupling risk.

## Implementation Notes

### Metadata Record Schema

```json
{
  "session_id": "uuid",
  "model": "claude-opus-4-7",
  "created_at": "2026-05-24T00:00:00Z",
  "last_activity": "2026-05-24T06:00:00Z",
  "message_count": 42,
  "project_dir": "/home/user/project",
  "summary": "Fixed API rate limiting, added retry logic",
  "platform": "cli"
}
```

### Sync Trigger

- After each assistant turn (real-time, lightweight)
- On session exit (batch, for history)
- On explicit `/sync` command (on-demand)

## Working Implementation

A reference implementation is available as a Claude Code plugin at [`plugins/desktop-session-sync/`](/plugins/desktop-session-sync/).

This plugin implements **Option B (Local Storage Bridge)** as a practical, immediately-usable solution:

| Component | File | Purpose |
|-----------|------|---------|
| Python sync script | `hooks/sync_sessions.py` | Walks `~/.claude/projects/`, creates `local_<uuid>.json` metadata files in the desktop app's session directory |
| PostToolUse hook | `hooks/hooks.json` | Auto-syncs after transcript writes during active sessions |
| Slash command | `commands/sync-desktop-sessions.md` | On-demand full sync via `/sync-desktop-sessions` |
| Standalone usage | — | Run `python3 sync_sessions.py` independently of the plugin system |

The script derives a deterministic session ID from each transcript's relative path, extracts metadata (title, model, timestamps, message count) from the JSONL content, and writes a `local_<uuid>.json` payload that the desktop app's session list rendering code consumes natively. No modifications to the desktop app are required.

## Related Issues

- #61967 (this feature request)
- #61742 (Agent View cwd selection — session metadata tracking precedent)
- #61546 (Agent View cwd — session context features)
- #56172 (Community bridge script by BasedGPT — inspiration for the plugin approach)
