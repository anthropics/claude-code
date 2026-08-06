<!-- # /project:list-snapshots

List all context snapshots for the current session.

## Instructions for the Agent

When the user runs `/project:list-snapshots`, execute the following steps:

1. **Read the current session ID** from stdin JSON (provided by the hook system).

2. **Read the snapshot directory**:
   ```
   ~/.claude/context-safety-net/<current_session_id>/
   ```

3. **Find all snapshot subdirectories** (both `_auto` and `_manual` / `_<name>`).

4. **For each snapshot directory**, extract:
   - **Timestamp**: Parse from directory name (format: `YYYYMMDD_HHMMSS_<type>` or `YYYYMMDD_HHMMSS_<name>`)
   - **Name**: The suffix after the timestamp (e.g., "auto", "manual", or user-provided name)
   - **Git Commit**: Read from `commit.txt` in the snapshot directory

5. **Output a clean Markdown table** with columns:
   | Timestamp | Name | Git Commit |
   |-----------|------|------------|
   | 2025-01-15 14:30:22 | auto | a1b2c3d |
   | 2025-01-15 14:45:10 | manual | e4f5g6h |

6. **Sort by timestamp descending** (newest first).

7. **If no snapshots exist**, output: `No snapshots found for this session.`

## Formatting Requirements

- Use exact column headers: `Timestamp`, `Name`, `Git Commit`
- Timestamps in readable format: `YYYY-MM-DD HH:MM:SS`
- Git commit: first 7 characters of SHA
- No extra commentary, just the table -->

# /project:list-snapshots

List all context snapshots for the current session.

## Instructions for the Agent

When the user runs `/project:list-snapshots`, execute the following steps:

1. Determine the current Claude Code session ID. You can find this in your current session environment. Use it to locate the snapshot directory at `~/.claude/context-safety-net/<session_id>/`.

2. **Read the snapshot directory**:

   ```
   ~/.claude/context-safety-net/<current_session_id>/
   ```

3. **Find all snapshot subdirectories** (both `_auto` and `_manual` / `_<name>`).

4. **For each snapshot directory**, extract:
   - **Timestamp**: Parse from directory name (format: `YYYYMMDD_HHMMSS_<type>` or `YYYYMMDD_HHMMSS_<name>`)
   - **Name**: The suffix after the timestamp (e.g., "auto", "manual", or user-provided name)
   - **Git Commit**: Read from `commit.txt` in the snapshot directory

5. **Output a clean Markdown table** with columns:
   | Timestamp | Name | Git Commit |
   |-----------|------|------------|
   | 2025-01-15 14:30:22 | auto | a1b2c3d |
   | 2025-01-15 14:45:10 | manual | e4f5g6h |

6. **Sort by timestamp descending** (newest first).

7. **If no snapshots exist**, output: `No snapshots found for this session.`

## Formatting Requirements

- Use exact column headers: `Timestamp`, `Name`, `Git Commit`
- Timestamps in readable format: `YYYY-MM-DD HH:MM:SS`
- Git commit: first 7 characters of SHA
- No extra commentary, just the table

```

```
