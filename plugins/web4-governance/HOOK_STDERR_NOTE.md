# Hook Errors in Claude Code - Diagnosis and Resolution

**Date**: 2026-01-30
**Affected Version**: Claude Code 2.1.25
**Status**: RESOLVED

## Issue

Claude Code displayed "hook error" messages for every tool use:
```
● Read 2 files (ctrl+o to expand)
  ⎿  PreToolUse:Read hook error
  ⎿  PostToolUse:Read hook error
```

The hooks were exiting with code 0 and appeared to function correctly when tested manually.

## Root Causes (Multiple)

### 1. CRLF Line Endings (Primary Cause)

Hook files on Windows-mounted drives (`/mnt/c/...`) had Windows-style CRLF line endings. This caused the shebang to be parsed incorrectly:

```
/usr/bin/env: 'python3\r': No such file or directory
```

The `\r` (carriage return) was included in the interpreter name, making `python3\r` instead of `python3`.

**Fix**: Convert all hook files to Unix LF line endings:
```bash
cd hooks/
for f in *.py; do sed -i 's/\r$//' "$f"; done
```

### 2. Unresolved Environment Variable in Local Settings

A local settings file (`ai-agents/.claude/settings.local.json`) used `$CLAUDE_PROJECT_DIR` in hook paths:
```json
"command": "$CLAUDE_PROJECT_DIR/web4/claude-code-plugin/hooks/pre_tool_use.py"
```

This variable wasn't set, causing path resolution to fail.

**Fix**: Removed hooks section from local settings, letting global settings (`~/.claude/settings.json`) with absolute paths take effect.

### 3. Stderr Output (Initial Suspicion - Partial)

The hooks originally output informational messages to stderr:
```python
print(f"[Web4] Session recovered: {token_short}", file=sys.stderr)
print(f"[R6] {category}:{target} {coherence}", file=sys.stderr)
```

Claude Code displays any stderr output as "hook error" regardless of exit code.

**Fix**: Removed informational stderr prints. Only actual errors/blocks now write to stderr.

## Resolution Summary

| Issue | Fix | File(s) |
|-------|-----|---------|
| CRLF line endings | `sed -i 's/\r$//'` | All `hooks/*.py` |
| Unresolved `$CLAUDE_PROJECT_DIR` | Removed hooks from local settings | `ai-agents/.claude/settings.local.json` |
| Informational stderr | Removed non-error prints | `hooks/pre_tool_use.py`, `hooks/session_start.py` |

## Verification

After fixes, hooks run silently and log correctly:

```bash
# Test hook directly - should produce no output
echo '{"session_id":"test","tool_name":"Bash","tool_input":{}}' | \
  ./pre_tool_use.py 2>&1; echo "Exit: $?"
# Expected: Exit: 0

# Verify R6 logging
tail -1 ~/.web4/r6/$(date +%Y-%m-%d).jsonl | python3 -m json.tool

# Verify audit logging
tail -1 ~/.web4/audit/<session-id>.jsonl | python3 -m json.tool
```

## Recommendations for WSL/Windows Development

1. **Configure Git for LF line endings**:
   ```bash
   git config --global core.autocrlf input
   ```

2. **Use `.gitattributes`** in the repo:
   ```
   *.py text eol=lf
   *.sh text eol=lf
   ```

3. **Use absolute paths** in global hook settings, avoid environment variables

4. **Test hooks from different directories** - working directory affects import resolution

5. **Only use stderr for actual errors** that should alert the user

## Affected Files

- `hooks/pre_tool_use.py` - CRLF fix, removed informational prints
- `hooks/post_tool_use.py` - CRLF fix
- `hooks/session_start.py` - CRLF fix, removed informational prints
- `hooks/heartbeat.py` - CRLF fix
- `ai-agents/.claude/settings.local.json` - Removed duplicate hooks section

## Notes

The hooks continue to:
- Log R6 audit data to `~/.web4/r6/`
- Track audit trails in `~/.web4/audit/`
- Maintain session state in `~/.web4/sessions/`
- Enforce policy decisions (actual blocks still output to stderr as intended)
