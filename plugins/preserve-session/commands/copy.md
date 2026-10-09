---
description: Create an independent copy of another registered project's session history into the current project
allowed-tools: Bash(bash:*)
---

**Step 1** — List available projects:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/copy.sh" --list
```

Show the output to the user, then ask them which project to copy sessions from.

**Step 2** — Once the user selects a project path, run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/copy.sh" "<selected-path>"
```

This creates a truly independent copy in the current project (each copied `.jsonl`
gets a fresh `sessionId`, a matching new filename, and its `cwd` rewritten to the
current project). The source project is not modified.

**Step 3** — If the output contains `warning — source slug collides with`, tell the user:

> ASCII가 아닌 경로를 사용하고 있어서 아래 프로젝트와 같은 경로로 인식되고 있습니다. copy를 진행하면 해당 프로젝트의 대화도 함께 복사됩니다. 계속하시겠습니까?

If the user confirms, run (replace `<selected-path>` with the actual path chosen):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/copy.sh" "<selected-path>" --force
```

Otherwise, cancel and inform the user.
