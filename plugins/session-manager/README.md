# Session Manager

List, delete, and bulk-clean Claude Code sessions without leaving the CLI.

Claude Code sessions accumulate quickly — every `claude` invocation creates a new `.jsonl` file under `~/.claude/projects/`. Over time this grows into hundreds of orphaned sessions with no built-in way to review or remove them. The `/resume` picker shows sessions for the current project, but there is no cross-project overview, no deletion, and no cleanup tooling.

This plugin fills that gap with three commands that cover the full session lifecycle.

## Commands

| Command | Description |
|---------|-------------|
| `/session-manager:delete` | Delete a specific session by name, ID prefix, or interactive selection |
| `/session-manager:list` | List all sessions across projects with timestamps, sizes, and previews |
| `/session-manager:cleanup` | Bulk-remove old or tiny sessions with age/size filters |

### `/session-manager:delete [session-name-or-id]`

Delete a single session. Without arguments, shows a numbered list of sessions in the current project to pick from. With an argument, matches against session names or UUID prefixes.

Always asks for confirmation before deleting.

```
> /session-manager:delete
Sessions in myproject (5 sessions):
  1  [2026-02-15]  "Fix auth bug in login flow..."          abc12345
  2  [2026-02-14]  "Add dark mode support..."               def67890
  3  [2026-02-13]  "Refactor database queries..."           ghi24680

Which session to delete? 2

Delete session "Add dark mode support..." (def67890)?
> y
Deleted session def67890.
```

### `/session-manager:list [project-filter]`

Cross-project session overview. Shows every session grouped by project with modification date, file size, and a preview of the first prompt. Optionally filter by project name.

```
> /session-manager:list

myproject (3 sessions)
  #  Date        Size    First prompt                               ID
  1  2026-02-15  245 KB  Fix the auth bug in login flow...          abc12345
  2  2026-02-14   89 KB  Add dark mode support...                   def67890
  3  2026-02-10   12 KB  Quick question about generics...           ghi24680

api-service (1 session)
  #  Date        Size    First prompt                               ID
  1  2026-02-12  530 KB  Implement payment processing pipeline...   jkl13579

Total: 4 sessions across 2 projects (876 KB)
```

### `/session-manager:cleanup [options]`

Bulk cleanup with filters. Supports `--older-than`, `--smaller-than`, and `--dry-run`.

```
> /session-manager:cleanup --older-than=30d --dry-run

Sessions matching criteria (older than 30 days):
  - [2025-12-01]   3 KB  "Quick test of the API..."       (abc12345)
  - [2025-11-15]   1 KB  "Hello, can you help..."         (def67890)

Dry run complete. 2 sessions (4 KB) would be deleted.

> /session-manager:cleanup --older-than=30d

[same preview]
Delete these 2 sessions (4 KB)? This cannot be undone.
> y
Cleaned up 2 sessions (4 KB freed).
```

## Installation

Install via the plugin marketplace or manually:

```bash
claude plugin install session-manager
```

Or clone into your plugins directory:

```bash
git clone https://github.com/anthropics/claude-code.git
# Plugin is at plugins/session-manager/
```

## How It Works

Sessions are stored as `.jsonl` files in `~/.claude/projects/<encoded-project-path>/`. Each file contains the full conversation history as newline-delimited JSON. Some sessions also have a companion directory (same UUID) containing tool results and subagent data.

The plugin reads these files to extract metadata (timestamps, first prompt, file size) and uses standard filesystem operations to delete them when requested. All operations are local — no data leaves your machine.

## Safety

- **Confirmation required** — every delete operation requires explicit user approval
- **No active session deletion** — cleanup skips the currently running session
- **Dry-run mode** — preview what would be deleted before committing
- **Companion data included** — deleting a session also removes its associated tool-result directory
