# Stash Plugin

Git-stash-like message storage for Claude Code. Push, pop, apply, and list messages persisted to disk so they survive crashes and session changes.

Addresses [#26615](https://github.com/anthropics/claude-code/issues/26615) — the built-in Ctrl+S stash is single-slot and not persisted to disk.

## Commands

### `/stash <message>`

Save a message to the stash stack.

```bash
/stash Refactor the auth module to use JWT tokens instead of session cookies. Start with the middleware in src/auth/...
```

Output:
```
Message stashed.
#0  Refactor the auth module to use JWT tokens instead of session cookies. Start with the middleware in src/auth/...
```

### `/stash-pop`

Apply and remove the **last** stashed message.

```bash
/stash-pop
```

Output:
```
#2  2026-02-27T14:30:00Z

Refactor the auth module to use JWT tokens...
```

### `/stash-apply <id>`

Apply and remove a **specific** stashed message by ID.

```bash
/stash-apply 0
```

Output:
```
#0  2026-02-27T12:00:00Z

Add error handling to the payment service...
```

### `/stash-list`

List all stashed messages (truncated to 80 characters).

```bash
/stash-list
```

Output:
```
#0  2026-02-27T12:00:00Z  Add error handling to the payment service when Stripe returns a 429...
#1  2026-02-27T13:15:00Z  Write integration tests for the new search endpoint covering edge ca...
#2  2026-02-27T14:30:00Z  Refactor the auth module to use JWT tokens instead of session cookie...

3 stashed message(s)
```

## Storage

Messages are stored in `~/.claude/stash.jsonl` — one JSON object per line:

```json
{"id": 0, "message": "Add error handling to the payment service...", "timestamp": "2026-02-27T12:00:00Z"}
{"id": 1, "message": "Write integration tests for the new search endpoint...", "timestamp": "2026-02-27T13:15:00Z"}
```

The file is human-readable and can be edited manually if needed.

## Why This Exists

The built-in Ctrl+S stash has several limitations:
- **Single slot** — stashing again overwrites the previous stash
- **Not persisted to disk** — lost on crashes, errors, or session changes
- **No history** — no way to browse or select from multiple stashes

This plugin provides a proper stack with push/pop/apply semantics, persisted to a JSONL file that survives any disruption.

## Requirements

- Python 3 (pre-installed on macOS and most Linux distributions)

## Installation

Install via the Claude Code plugin command:

```bash
claude plugin add --path ./stash
```

Or add to your project/user settings:

```json
{
  "plugins": ["./path/to/stash"]
}
```

## Version

1.0.0

## Author

Leonardo Cardoso — [github.com/LeonardoCardoso](https://github.com/LeonardoCardoso)
