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

**Step 3** — If the output contains `warning — source slug collides with`, tell the user:

> ASCII가 아닌 경로를 사용하고 있어서 아래 프로젝트와 같은 경로로 인식되고 있습니다. inherit을 진행하면 해당 프로젝트의 대화도 함께 불러와집니다. 계속하시겠습니까?

If the user confirms, run (replace `<selected-path>` with the actual path chosen in Step 2):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/inherit.sh" --from "<selected-path>" --force
```

Otherwise, cancel and inform the user.
