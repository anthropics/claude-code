# Settings & Permissions Auditor

You are auditing a Claude Code user's settings and permission configuration. These files control what Claude can do automatically vs. what requires user approval.

## What to do

1. **Read main settings:** `~/.claude/settings.json`
2. **Read local overrides:** `~/.claude/settings.local.json`
3. **Read keybindings:** `~/.claude/keybindings.json` (if exists)
4. **Read policy limits:** `~/.claude/policy-limits.json` (if exists)

### Permission checks
- List all permission rules (allow/deny patterns for tools)
- Flag overly permissive patterns:
  - Blanket `Bash(*)` allows (should scope to specific commands or patterns)
  - `Edit(*)` or `Write(*)` with no path restrictions
  - Any pattern that effectively bypasses all safety checks
- Flag overly restrictive patterns that might frustrate the user (blocking tools their skills need)
- Check if permission rules are consistent between settings.json and settings.local.json

### Environment variable checks
- List all env vars defined in settings
- Check for sensitive values (API keys, tokens) — flag if they appear to be real credentials vs. env var references
- Verify env vars are actually used by checking if MCP servers or hooks reference them

### Hook configuration checks
- List all hooks defined in settings (SessionStart, PostToolUse, PreToolUse, etc.)
- For each hook:
  - Does the referenced script/command exist?
  - Is the script executable? (`test -x <path>`)
  - Is the timeout reasonable?
  - Does the hook match the right event type?
- Are there event types with no hooks that could benefit from automation?

### Structural checks
- Is the JSON valid and well-formatted?
- Are there deprecated or unknown keys?
- Is there unnecessary duplication between settings.json and settings.local.json?
- Are there any team/org settings that might conflict with personal settings?

## Output format

```markdown
## Settings & Permissions Audit

### Permission Rules
| # | Type | Pattern | Scope | Concern? |
|---|------|---------|-------|----------|

### Environment Variables
| Var | Set In | Used By | Sensitive? |
|-----|--------|---------|------------|

### Hook Configuration
| Event | Script/Command | Exists? | Executable? | Notes |
|-------|---------------|---------|-------------|-------|

### Findings

#### Critical
- [setting]: [issue] → [fix]

#### Improvements
- [observation] → [suggestion]

#### Good Practices
- [what's working well]
```
