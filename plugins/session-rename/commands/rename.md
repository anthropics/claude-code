---
description: Rename the current session for easier identification in /resume
argument-hint: <new session name>
allowed-tools: Bash(ls:*), Bash(cat:*), Bash(echo:*), Bash(mkdir:*), Bash(python3:*), Bash(date:*), Read, Write
---

# Rename Current Session

Rename the current Claude Code session by writing a metadata file alongside the session JSONL.

## Your Task

The user wants to rename this session to: `$ARGUMENTS`

**If $ARGUMENTS is empty**, ask the user what they'd like to name this session using AskUserQuestion. Do not proceed until you have a name.

**If $ARGUMENTS is provided**, rename the session:

1. Determine the current session's storage path. The session JSONL file is located at:
   ```
   ~/.claude/projects/{encodedProjectPath}/{sessionId}.jsonl
   ```
   where `{encodedProjectPath}` is the current working directory with `/` replaced by `-` and `{sessionId}` is a UUID.

   To find the correct file, run:
   ```bash
   ls -t ~/.claude/projects/*/  2>/dev/null | grep "\.jsonl$" | head -20
   ```
   Then identify the session file that corresponds to the current project path by checking which project directory matches the current working directory.

   A more reliable approach: use `python3` to find the session file for the current project:
   ```python
   import os, glob, json
   cwd = os.getcwd()
   encoded = cwd.replace("/", "-")
   project_dir = os.path.expanduser(f"~/.claude/projects/{encoded}")
   # List .jsonl files sorted by modification time (newest first)
   jsonl_files = sorted(
       glob.glob(os.path.join(project_dir, "*.jsonl")),
       key=os.path.getmtime, reverse=True
   )
   # The most recently modified session is likely the current one
   if jsonl_files:
       print(jsonl_files[0])
   ```

2. Write a `{sessionId}.meta.json` file in the same directory as the `.jsonl` file:
   ```json
   {
     "title": "<user-provided name>",
     "renamed_at": "<ISO 8601 timestamp>",
     "auto_title": null
   }
   ```

   If a `.meta.json` already exists, read it first and update only the `title` and `renamed_at` fields, preserving any other fields.

3. Confirm the rename to the user with a brief message like:
   ```
   Session renamed to "<new name>".
   Metadata saved to: ~/.claude/projects/.../{sessionId}.meta.json
   ```

**Important**: Do not modify the `.jsonl` file itself. The metadata file is a sidecar that can be read by future versions of Claude Code or by other plugins.

You MUST complete this in a single message with tool calls. Do not send any other text besides the confirmation.
