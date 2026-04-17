---
description: Recover session history after a project directory rename or move
allowed-tools: Bash(bash:*)
---

Run the following and show the output to the user:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/fix.sh"
```

If the output contains `warning — slug collision detected`, tell the user:

> 이 경로가 위에 나온 다른 프로젝트와 같은 slug로 변환되어 세션 폴더를 공유합니다. (원인: 경로 내 비 ASCII 문자나 특수문자가 모두 `-`로 치환되며 발생) 진행하면 양쪽 프로젝트의 세션이 한 폴더에 섞이고, 이후 `/cleanup`/`/move`가 서로에게 영향을 줄 수 있습니다. 계속하시겠습니까?

If the user confirms, run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/fix.sh" --force
```

Otherwise, cancel and inform the user.
