---
description: 將當前任務交給 Gemini CLI（安全封裝與最小落地）
allowed-tools: Bash(gemini:*), Bash(rg:*), Bash(git diff:*), Bash(ls:*), Bash(cat:*), Bash(echo:*)
---

步驟：

1) 上下文封裝（唯讀）
- 以 `rg` 擷取必要片段與 `git diff`（若適用），存到 `.claude/interop/context/gemini-ctx-<ts>.md`。

2) 命令草案（先顯示，需一次性授權才執行）
```bash
gemini -m <MODEL> -o json -- "請根據以下上下文完成任務，輸出結構化 JSON。\n\n$(cat .claude/interop/context/gemini-ctx-<ts>.md)" \
  > .claude/interop/artifacts/gemini-<ts>.json
```
偏好 `--approval-mode=default`（不要 `-y/--yolo`）。如需互動改用 `-i`。

3) 正規化與審查
- 解析 `.json`；若非 JSON，採啟發式解析。
- 使用 `pr-review-toolkit` 與 `security-guidance` 檢查。

4) 最小落地
- 產生 `apply_patch` 或 PR；附回復指令；記錄於 `CLAUDE_DECISIONS.md`。

