---
description: 將當前任務交給 Codex CLI（安全封裝與最小落地）
allowed-tools: Bash(codex:*), Bash(rg:*), Bash(git diff:*), Bash(ls:*), Bash(cat:*), Bash(echo:*)
---

步驟：

1) 上下文封裝（唯讀）
- 以 `rg` 擷取必要片段與 `git diff`（若適用），存到 `.claude/interop/context/codex-ctx-<ts>.md`。

2) 命令草案（先顯示，需一次性授權才執行）
```bash
# 建議預設：--full-auto（允許改檔，仍禁網）
codex \
  --full-auto \
  -C "$PWD" \
  -m <MODEL> \
  exec -- "$(cat .claude/interop/context/codex-ctx-<ts>.md)" \
  > .claude/interop/artifacts/codex-<ts>.out
```
注意：
- `-p/--profile` 是「設定檔名稱」，不是「prompt」；請勿用 `-p` 傳提示詞。
- 使用 `--` 讓後續內容被視為提示詞字串，避免被解析成旗標。
- `--full-auto` 等效 workspace-write 且禁網；若必須開網，請在可信容器/CI 中使用 `--sandbox danger-full-access`，務必審核輸出。

3) 正規化與審查
- 嘗試將輸出轉為結構化資料（若非 JSON，則以啟發式解析）。
- 使用 `pr-review-toolkit` 與 `security-guidance` 檢查。

4) 最小落地
- 產生 `apply_patch` 或 PR；附回復指令；記錄於 `CLAUDE_DECISIONS.md`。
