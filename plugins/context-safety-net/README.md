# Context Safety Net Plugin

## Problem

Auto-compaction in long-running sessions causes **silent context degradation**. Critical "anchor" files — core authentication logic, API routes, database schemas, configuration — slip out of context without warning. The agent loses awareness of foundational code, leading to hallucinated APIs, broken refactors, and security regressions.

There is no built-in mechanism to:

- Detect when anchor files fall out of context
- Recover specific files into context on demand
- Compare current state against a known-good snapshot

## Solution

**Context Safety Net** provides deterministic state capture and explicit user-controlled recovery.

### Key Features

| Feature                  | Description                                                                |
| ------------------------ | -------------------------------------------------------------------------- |
| **Auto-snapshots**       | Captures git state (diff, tracked files, commit) on every auto-compact     |
| **Manual snapshots**     | User-triggered checkpoints via `/project:snapshot [name]`                  |
| **Anchor tracking**      | Monitors critical files defined in `.claude/context-anchors.json`          |
| **Post-compact warning** | Alerts if anchor files are missing from working directory after compaction |
| **Explicit restore**     | `/project:restore [name]` reads anchor files back into agent context       |
| **Diff comparison**      | `/project:compare [name]` shows structural changes since snapshot          |
| **Status line HUD**      | Live snapshot count and recency in status bar                              |

### Design Philosophy

| Principle           | Implementation                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Read-Only**       | Never uses `git stash`, `git commit`, `git reset`, or any filesystem mutation                                         |
| **Explicit Agency** | No auto-restore, no system message injection, no hidden context stuffing — user invokes `/project:restore`            |
| **Deterministic**   | Captures raw `git diff`, `git ls-files`, `git rev-parse HEAD` — no LLM summaries, no embeddings, no lossy compression |

---

## Installation

```bash
# Clone or copy to your plugins directory
cp -r context-safety-net ~/.claude/plugins/
```

The plugin registers automatically via `plugin.json`.

---

## Configuration: `.claude/context-anchors.json`

Define critical files that should never silently drop from context.

```json
{
  "version": 1,
  "anchors": [
    {
      "path": "src/auth/tokens.py",
      "priority": "critical",
      "reason": "Core JWT issuance/validation logic — security critical"
    },
    {
      "path": "src/auth/permissions.py",
      "priority": "critical",
      "reason": "RBAC enforcement — authorization bypasses are severe"
    },
    {
      "path": "src/api/routes.py",
      "priority": "high",
      "reason": "Main API surface — route changes break clients"
    },
    {
      "path": "src/db/schema.sql",
      "priority": "high",
      "reason": "Database schema — migrations must match"
    },
    {
      "path": "src/config/settings.py",
      "priority": "medium",
      "reason": "Runtime configuration — feature flags, secrets refs"
    },
    {
      "path": "tests/security/test_auth_bypass.py",
      "priority": "medium",
      "reason": "Security regression tests — must stay green"
    }
  ]
}
```

### Anchor Fields

| Field      | Required | Values                       | Description                               |
| ---------- | -------- | ---------------------------- | ----------------------------------------- |
| `path`     | Yes      | Relative path from repo root | File to track                             |
| `priority` | Yes      | `critical`, `high`, `medium` | Severity if missing from context          |
| `reason`   | Yes      | String                       | Human-readable justification for tracking |

### Priority Semantics

| Priority   | Meaning                                                            |
| ---------- | ------------------------------------------------------------------ |
| `critical` | Security/auth/crypto — silent loss = potential vulnerability       |
| `high`     | Core business logic, API contracts — silent loss = broken features |
| `medium`   | Important but recoverable — silent loss = degraded productivity    |

---

## Commands

| Command                    | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `/project:snapshot [name]` | Create a manual snapshot with optional name        |
| `/project:list-snapshots`  | List all snapshots for current session in a table  |
| `/project:restore [name]`  | Read anchor files from snapshot into agent context |
| `/project:compare [name]`  | Show `git diff` between snapshot commit and HEAD   |

### `/project:snapshot [name]`

Creates a **read-only** capture of current git state.

```bash
/project:snapshot before-refactor
# Creates: ~/.claude/context-safety-net/<session>/20250115_143022_before-refactor/
```

**Captures:**

- `working.diff` — `git diff` output
- `tracked-files.txt` — `git ls-files` output
- `commit.txt` — `git rev-parse HEAD` output
- `anchors.json` — copy of `.claude/context-anchors.json` (if exists)
- `metadata.json` — timestamp, commit hash, type="manual", name

### `/project:list-snapshots`

```
### Context Snapshots (Session: abc123def)

| Timestamp           | Name            | Git Commit | Type  |
|---------------------|-----------------|------------|-------|
| 2025-01-15 14:45:00 | (auto)          | e4f5g6h    | auto  |
| 2025-01-15 14:30:22 | before-refactor | a1b2c3d    | manual |
| 2025-01-15 14:15:10 | (auto)          | 9i8j7k6    | auto  |
```

### `/project:restore [name]`

**Loads anchor files into agent context** — does NOT modify filesystem.

```bash
/project:restore before-refactor
```

Output:

```
Restored 6 anchor files into context:
- src/auth/tokens.py (critical)
- src/auth/permissions.py (critical)
- src/api/routes.py (high)
- src/db/schema.sql (high)
- src/config/settings.py (medium)
- tests/security/test_auth_bypass.py (medium)

Missing from filesystem (0):
```

### `/project:compare [name]`

```bash
/project:compare before-refactor
```

Output:

```
### Comparison: Current HEAD vs Snapshot "before-refactor" (a1b2c3d)

**Summary:**
- 12 files changed, 342 insertions(+), 87 deletions(-)
- 3 anchor files modified

**Modified Anchor Files:**
- src/auth/tokens.py (critical) — +45/-12 lines
- src/api/routes.py (high) — +23/-8 lines
- src/config/settings.py (medium) — +5/-2 lines

**Other Changes:**
- tests/test_auth.py — +89/-0 lines
- src/utils/helpers.py — +12/-5 lines
```

---

## Hooks

### Pre-Compact Hook (`pre-compact-snapshot.sh`)

Triggers automatically before Claude compacts context.

1. Reads `session_id` from stdin JSON
2. Creates snapshot at `~/.claude/context-safety-net/<session_id>/<timestamp>_auto/`
3. Captures git state (diff, tracked files, commit hash)
4. Copies `context-anchors.json` if present
5. Writes `metadata.json` with `type: "auto"`

**No mutation** — read-only git operations only.

### Post-Compact Hook (`post-compact-check.sh`)

Triggers automatically after compaction completes.

1. Finds latest `_auto` snapshot for the session
2. Reads `anchors.json` from that snapshot
3. Runs `git ls-files` to get current tracked files
4. Compares each anchor path against current tracked files
5. If any anchor is missing, prints warning to stdout:

```
⚠️ Context Safety Net Warning
Anchor files missing from working directory:
src/auth/tokens.py
src/api/routes.py
Run /project:restore <snapshot_name> to reload context.
```

---

## Status Line HUD

Add to your status line configuration:

```json
{
  "statusline": {
    "command": "~/.claude/plugins/context-safety-net/statusline/safety-net-hud.sh"
  }
}
```

Output:

```
🛡️ SafetyNet: 3 snapshots (last: 12m ago)
```

Shows:

- Total snapshot count for session
- Minutes since last snapshot (auto or manual)

---

## Snapshot Storage

```
~/.claude/context-safety-net/
└── <session_id>/
    ├── 20250115_141510_auto/
    │   ├── working.diff
    │   ├── tracked-files.txt
    │   ├── commit.txt
    │   ├── anchors.json
    │   └── metadata.json
    ├── 20250115_143022_before-refactor/
    │   ├── working.diff
    │   ├── tracked-files.txt
    │   ├── commit.txt
    │   ├── anchors.json
    │   └── metadata.json
    └── 20250115_144500_auto/
        ├── working.diff
        ├── tracked-files.txt
        ├── commit.txt
        ├── anchors.json
        └── metadata.json
```

- Per-session isolation (no cross-session leakage)
- Automatic cleanup not implemented — manual directory deletion if needed
- Typical snapshot size: 10-500 KB depending on `git diff` size

---

## Security Considerations

| Concern               | Mitigation                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Secrets in `git diff` | Snapshots capture `git diff` — ensure `.gitignore` excludes `.env`, `*.key`, `secrets/*` |
| Disk usage            | Monitor `~/.claude/context-safety-net/`; prune old sessions manually                     |
| No auto-restore       | By design — user must explicitly invoke `/project:restore`                               |
| No network calls      | Entirely local filesystem + git operations                                               |

---

## Troubleshooting

| Issue                          | Resolution                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Hooks not firing               | Verify `plugin.json` hooks paths are correct; check Claude Code hook logs        |
| `jq` not found                 | Install `jq` (required for JSON parsing in hooks)                                |
| Snapshots not appearing        | Ensure `~/.claude/context-safety-net/` is writable; check session ID propagation |
| `git` commands fail            | Verify you're in a git repository (`git rev-parse --git-dir`)                    |
| Anchor warning false positives | Check `.claude/context-anchors.json` paths match actual repo structure           |

---

## License

MIT — Use freely in any project.
