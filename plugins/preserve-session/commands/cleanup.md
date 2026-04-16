---
description: List all registered projects and remove selected entries (optionally with session folders)
allowed-tools: Bash(bash:*)
---

**Step 1** — List:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/cleanup.sh"
```

**Step 2** — If the output says "nothing to clean up" or "registry is empty", inform the user and stop.

Otherwise, ask which entries to remove:

> 삭제할 항목 번호를 입력하세요 (예: `1 3`). `stale`을 입력하면 `✗ ← path not found`로 표시된 항목 전체를, `all`을 입력하면 모든 항목을 삭제합니다.

**Step 3** — Translate the user's selection into paths (do NOT run the command yet):

- **Numbers** (e.g. `1 3`): paths at those positions
- **`stale`**: all paths with `✗` / `← path not found`
- **`all`**: all paths from the list

**Step 4** — For each selected path, determine the mode:

- If the path was shown with `✓` (not stale) → registry-only removal (always mode **(a)**)
- If the path was shown with `✗` **and** the session count was `0 sessions — auto-cleaned` → mode **(a)** automatically (nothing to delete on disk)
- If the path was shown with `✗` **and** the session count was `N sessions still in slug` (N > 0) → ask the user:

> 이 항목은 프로젝트 폴더가 삭제됐지만, `~/.claude/projects/` 아래에 세션 파일(`.jsonl`) `N`개가 남아 있습니다. 어떻게 할까요?
>
> (a) registry entry만 제거 — 세션 파일은 디스크에 남김 (Claude Code가 `cleanupPeriodDays`(기본 30일) 이후 자동 삭제)
> (b) registry entry + 세션 파일도 즉시 삭제 — 디스크 공간 바로 회수
>
> 선택해주세요: **a** / **b**

If the user selects `a` → mode **(a)**. If `b` → mode **(b)**. On ambiguous reply, re-ask.

**Step 5** — Show the consolidated plan:

> 다음과 같이 정리합니다:
>
> (a) registry만 제거:
> - `/path/one`
> - `/path/two`
>
> (b) registry + 세션 폴더 모두 제거:
> - `/path/three` (17 files)
>
> 계속하시겠습니까?

If the user replies affirmatively ("예", "네", "yes", "ok", "응", "ㅇㅇ", "진행" 등), proceed to Step 6.
If the user replies negatively ("아니", "no", "취소", "중단" 등), say "취소되었습니다. registry와 파일이 변경되지 않았습니다." and stop.
The `/preserve-session:cleanup` invocation itself is NOT confirmation.

**Step 6** — Run the commands (in order):

If there are (a) paths:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/cleanup.sh" --remove "<a-path-1>" "<a-path-2>" ...
```

If there are (b) paths:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/cleanup.sh" --remove-with-sessions "<b-path-1>" ...
```

Show each command's output to the user.

**Notes**

- `--remove` never touches `~/.claude/projects/` (session data) or `.claude/hash.txt` (project-local).
- `--remove-with-sessions` only deletes `~/.claude/projects/<slug>/` when the registry path is stale (project folder is gone). Symlink slug folders are always skipped.
- Neither mode affects `cleanupPeriodDays` auto-cleanup — it continues to run independently.
