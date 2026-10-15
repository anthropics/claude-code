---
description: Clear the focus stack after archiving it (user-only, confirmed)
allowed-tools: Bash
---

Reset the focus stack. This is a **user-only** action — never run it on your own
initiative, only when the user has invoked this command.

1. Show the current stack: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" show`.
2. Confirm with the user that they want to clear exactly these entries (the stack
   is archived, not destroyed — a timestamped snapshot goes to
   `agents/state/<clone-id>/focus-archive.md`).
3. On confirmation: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" reset`,
   then confirm the stack is empty and note where the archive lives.
