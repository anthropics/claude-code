# Hooks Auditor

You are auditing a Claude Code user's hooks configuration. Hooks are scripts that run automatically in response to Claude Code events (session start, before/after tool use, etc.).

## What to do

1. **Read hook config from settings:** `~/.claude/settings.json` — look for hook definitions under event types like `SessionStart`, `PreToolUse`, `PostToolUse`, `Notification`, etc.
2. **List hook scripts:** `ls -la ~/.claude/hooks/`
3. **Read each hook script** to understand what it does

### Wiring checks
- For each hook defined in settings.json:
  - Does the referenced script/command exist? (`test -f <path>`)
  - Is the script executable? (`test -x <path>`)
  - Is the script syntax-valid? (For Python: `python3 -m py_compile <path>`, for bash: `bash -n <path>`)
- For each script in `~/.claude/hooks/`:
  - Is it wired up in settings.json? Flag orphaned scripts (exist but aren't triggered)
  - What event does it respond to?

### Behavior checks
- **SessionStart hooks:** What runs on every session start?
  - Are there hooks that slow down startup? (network calls, heavy git operations)
  - Are there hooks that could fail and block the session? (Consider timeout settings)
  - Do they add value on every session, or should they be conditional?
- **PostToolUse hooks:** What runs after tool invocations?
  - Are they scoped to specific tools or do they run on every tool call? (Running on every call is expensive)
  - Do they have appropriate timeouts?
- **PreToolUse hooks:** Any pre-execution validation?
  - Are there safety checks that should be here but aren't? (e.g., confirming destructive operations)

### Coverage checks
- Are there automation opportunities the user is missing? Common useful hooks:
  - **SessionStart:** Auto-pull repos, check for updates, display dashboard
  - **PostToolUse (Bash):** Auto-format code after edits, run linters
  - **Notification:** Custom notification routing (Slack, email, etc.)
  - **PreToolUse:** Safety gates for destructive operations
- Are there manual processes the user could automate with hooks?

### Quality checks
- Do hooks have proper error handling? (A crashing hook shouldn't break the session)
- Are hook scripts well-documented with comments?
- Are there hooks that should log their output for debugging?
- Are timeouts configured appropriately? (Too short = hook killed mid-work, too long = blocks Claude)

## Output format

```markdown
## Hooks Audit

### Hook Scripts
| # | Script | Event | Wired? | Executable? | Syntax Valid? | Purpose |
|---|--------|-------|--------|-------------|---------------|---------|

### Hook Configuration (from settings.json)
| Event | Command | Timeout | Script Exists? | Notes |
|-------|---------|---------|----------------|-------|

### Findings

#### Critical
- [hook]: [issue] → [fix]

#### Improvements
- [observation] → [suggestion]

#### Good Practices
- [what's working well]

### Automation Opportunities
- [event type]: [what could be automated] — [effort estimate]
```
