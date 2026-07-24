<!-- # /project:compare [name]

Compare current git state against a snapshot to show what has changed since the snapshot was taken.

## Instructions for the Agent

When the user runs `/project:compare [name]`, execute the following steps:

1. **Read the current session ID** from stdin JSON (provided by the hook system).

2. **Determine the snapshot directory**:
   - If `name` is provided: Find snapshot matching that name
   - If `name` is not provided: Use the most recent snapshot

3. **Read `commit.txt`** from the snapshot directory to get the snapshot's git commit hash.

4. **Run `git diff <snapshot_commit> HEAD`** to show changes between snapshot and current HEAD.

5. **Provide a concise summary**:
   - Number of files changed
   - Number of lines added/removed
   - Key files modified (especially anchor files)
   - Group by directory if many changes

## Output Format

```
### Diff: Current HEAD vs Snapshot 20250115_143022_auto (a1b2c3d)

**Summary:** 12 files changed, 342 insertions(+), 87 deletions(-)

**Anchor files modified:**
- src/auth/tokens.ts (high) — +15/-3 lines
- src/core/config.ts (critical) — +8/-2 lines

**Other changes:**
- src/api/handlers.ts — +45/-12 lines
- tests/unit/auth.test.ts — +67/-0 lines
- docs/api.md — +23/-5 lines
```

If no snapshot name provided and none exist: `No snapshots found for this session.` -->

# /project:compare [name]

Compare current git state against a snapshot to show what has changed since the snapshot was taken.

## Instructions for the Agent

When the user runs `/project:compare [name]`, execute the following steps:

1. Determine the current Claude Code session ID. You can find this in your current session environment. Use it to locate the snapshot directory at `~/.claude/context-safety-net/<session_id>/`.

2. **Determine the snapshot directory**:
   - If `name` is provided: Find snapshot matching that name
   - If `name` is not provided: Use the most recent snapshot

3. **Read `commit.txt`** from the snapshot directory to get the snapshot's git commit hash.

4. **Run `git diff <snapshot_commit> HEAD`** to show changes between snapshot and current HEAD.

5. **Provide a concise summary**:
   - Number of files changed
   - Number of lines added/removed
   - Key files modified (especially anchor files)
   - Group by directory if many changes

## Output Format

```text
### Diff: Current HEAD vs Snapshot 20250115_143022_auto (a1b2c3d)

**Summary:** 12 files changed, 342 insertions(+), 87 deletions(-)

**Anchor files modified:**
- src/auth/tokens.ts (high) — +15/-3 lines
- src/core/config.ts (critical) — +8/-2 lines

**Other changes:**
- src/api/handlers.ts — +45/-12 lines
- tests/unit/auth.test.ts — +67/-0 lines
- docs/api.md — +23/-5 lines
```

If no snapshot name provided and none exist: `No snapshots found for this session.`

```

```
