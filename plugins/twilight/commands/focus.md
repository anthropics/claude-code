---
description: Show the focus stack, lock status, and each active plan's next item
allowed-tools: Bash
---

Run these and report the results verbatim (stack top-first with push dates), then
list each active plan from `specs/INDEX.md` with its first unchecked item:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" show
bash "${CLAUDE_PLUGIN_ROOT}/hooks/twilight-focus.sh" lock check
```

This is file state, not conversational memory — report what the files say even if
it disagrees with your recollection of the session.
