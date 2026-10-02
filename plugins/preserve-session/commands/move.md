---
description: Migrate session history from another registered project into the current one (destructive — source is emptied)
allowed-tools: Bash(bash:*)
---

**Step 1** — List available projects:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/move.sh" --list
```

Show the output to the user, then ask them which project to migrate sessions from.

**Important — before Step 2**: remind the user that `move` is **destructive**:

> move를 실행하면 원본 프로젝트의 세션 파일이 모두 현재 프로젝트로 이동됩니다. 원본 프로젝트에는 세션 히스토리가 남지 않습니다. `copy` (비파괴)를 대신 원하신다면 `/preserve-session:copy`를 사용해주세요.
>
> 진행하시겠습니까?

Only run Step 2 if the user explicitly confirms (e.g. "네", "yes", "진행").

**Step 2** — Once confirmed, run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/move.sh" "<selected-path>"
```

Session files are `os.rename`d to the current project's slug folder. `sessionId`
and filenames are preserved (no dedupe conflict since the source slug folder is
emptied). The `cwd` field is rewritten to the current project's realpath so the
Ctrl+A `/resume` picker filter works correctly.

**Step 3** — If the output contains `warning — source slug collides with`, tell the user:

> ASCII가 아닌 경로로 아래 프로젝트들이 같은 경로로 인식되고 있습니다. move를 진행하면 해당 프로젝트들의 세션도 함께 이동됩니다. 계속하시겠습니까?

If the user confirms, run (replace `<selected-path>`):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/move.sh" "<selected-path>" --force
```

Otherwise, cancel and inform the user.
