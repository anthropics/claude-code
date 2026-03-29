---
description: List all configured hookify rules
allowed-tools: ["Glob", "Read", "Skill"]
---

# List Hookify Rules

**Load hookify:writing-rules skill first** to understand rule format.

Show all configured hookify rules from both the global (`~/.claude/`) and project (`.claude/`) directories.

## Steps

1. Search for rules in both locations:

   **Global rules** (apply to all projects):
   ```
   pattern: "~/.claude/hookify.*.md"
   ```

   **Project rules** (apply to this project only):
   ```
   pattern: ".claude/hookify.*.local.md"
   ```

2. For each file found:
   - Use Read tool to read the file
   - Extract frontmatter fields: name, enabled, event, pattern
   - Extract message preview (first 100 chars)
   - Note whether it came from `~/.claude/` (global) or `.claude/` (project)

3. Determine overrides: if a global rule and a project rule share the same `name`, the project rule wins. Mark the global rule as `(overridden)` in the output.

4. Present results in a table with a Scope column:

```
## Configured Hookify Rules

| Name | Scope | Enabled | Event | Pattern | File |
|------|-------|---------|-------|---------|------|
| warn-dangerous-rm | [global] | ✅ Yes | bash | rm\s+-rf | hookify.dangerous-rm.local.md |
| warn-console-log | [project] | ✅ Yes | file | console\.log\( | hookify.console-log.local.md |
| check-tests | [project] | ❌ No | stop | .* | hookify.require-tests.local.md |

**Total**: 3 rules (1 global, 2 project; 2 active, 1 disabled)
```

   If a global rule is overridden by a project rule of the same name, show it as:
   ```
   | warn-dangerous-rm | [global] (overridden) | — | bash | rm\s+-rf | hookify.dangerous-rm.local.md |
   ```

5. For each active (non-overridden) rule, show a brief preview:
```
### warn-dangerous-rm [global]
**Event**: bash
**Pattern**: `rm\s+-rf`
**Message**: "⚠️ **Dangerous rm command detected!** This command could delete..."

**Status**: ✅ Active
**File**: ~/.claude/hookify.dangerous-rm.md
```

6. Add helpful footer:
```
---

**Global rules** (~/.claude/hookify.*.md) apply across all projects.
**Project rules** (.claude/hookify.*.local.md) apply to this project only.
A project rule with the same name as a global rule overrides it (project wins).

To modify a rule: Edit the .local.md file directly
To disable a rule: Set `enabled: false` in frontmatter
To enable a rule: Set `enabled: true` in frontmatter
To delete a rule: Remove the .local.md file
To create a rule: Use `/hookify` command

**Remember**: Changes take effect immediately - no restart needed
```

## If No Rules Found

If no hookify rules exist in either `~/.claude/` or `.claude/`:

```
## No Hookify Rules Configured

You haven't created any hookify rules yet.

Rules can be placed in:
- `~/.claude/hookify.*.md` — global rules (all projects)
- `.claude/hookify.*.local.md` — project rules (this project only)

To get started:
1. Use `/hookify` to analyze conversation and create rules
2. Or manually create rule files in either location
3. See `/hookify:help` for documentation

Example:
```
/hookify Warn me when I use console.log
```

Check `${CLAUDE_PLUGIN_ROOT}/examples/` for example rule files.
```
