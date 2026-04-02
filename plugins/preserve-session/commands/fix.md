---
description: Recover session history after a project directory rename or move
allowed-tools: Bash(bash:*)
---

Run the following and show the output to the user:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/fix.sh"
```

If the output contains `warning — slug collision detected`, tell the user:

> ASCII가 아닌 경로를 사용하고 있어서 아래 프로젝트와 같은 경로로 인식되고 있습니다. rename/move를 진행하면 해당 프로젝트의 세션과 섞일 수 있습니다. 계속하시겠습니까?

If the user confirms, run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/fix.sh" --force
```

Otherwise, cancel and inform the user.
