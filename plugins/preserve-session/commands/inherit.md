---
description: Copy session history from another registered project into the current one
allowed-tools: Bash(bash:*)
---

**Step 1** — List available projects:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/inherit.sh" --list
```

Show the output to the user, then ask them which project to inherit from.

**Step 2** — Once the user selects a project path, run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/inherit.sh" --from "<selected-path>"
```

Show the result to the user.
