---
description: Enable, disable, or check the status of voice mode
allowed-tools: Read, Bash(cat:*), Bash(jq:*)
model: haiku
---

The user wants to manage voice mode. Voice mode is controlled by the `voiceEnabled` setting in `~/.claude/settings.json` or `~/.claude/settings.local.json`.

## Steps

1. Read `~/.claude/settings.json` (or `~/.claude/settings.local.json`) to check the current value of `voiceEnabled`.

2. Based on the user's argument (`$ARGUMENTS`) and the current state:

   - **No argument or "on" or "enable"**: If voice mode is already enabled, tell the user. Otherwise, set `voiceEnabled` to `true` in `~/.claude/settings.local.json` (create the file if it doesn't exist, merge with existing settings if it does).
   - **"off" or "disable"**: Set `voiceEnabled` to `false` in `~/.claude/settings.local.json`.
   - **"status"**: Report whether voice mode is currently enabled or disabled.

3. After making changes, tell the user:
   - What changed
   - That they need to restart Claude Code for the change to take effect
   - That voice mode uses push-to-talk (default: hold spacebar) once enabled

## Important

- Use `~/.claude/settings.local.json` for writes (user-local, not committed to version control)
- Preserve any existing settings in the file when writing — do not overwrite the entire file
- If `jq` is not available, fall back to reading the file and providing manual instructions
