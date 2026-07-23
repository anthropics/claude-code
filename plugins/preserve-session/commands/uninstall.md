---
description: Permanently remove all preserve-session data (registry and hash files)
allowed-tools: Bash(bash:*)
---

**Step 1** — Run the following and show the output to the user:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/uninstall.sh"
```

**Step 2** — After showing the output, display this warning:

> 🔴 **이 작업은 되돌릴 수 없습니다.**
> 위에 나열된 파일들이 영구적으로 삭제됩니다. 계속하시겠습니까?

**절대 주의**: 삭제를 명시적으로 동의하는 내용("예", "yes", "네", "ok", "응", "ㅇㅇ", "확인", "진행", "계속", "삭제해" 등)을 **별도 메시지**로 받기 전까지 Step 3를 절대 실행하지 마세요. 반대로 부정 응답("아니", "no", "취소", "중단", "안 해")이 오면 Step 3를 실행하지 말고 "취소되었습니다." 안내를 하세요. `/preserve-session:uninstall` 커맨드 실행 자체는 확인으로 간주하지 않습니다.

**Step 3** — 확인 시 실행:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/hooks/uninstall.sh" --confirm
```

결과를 사용자에게 보여주세요.

거절 시: "취소되었습니다. 파일이 삭제되지 않았습니다." 라고 안내하세요.
