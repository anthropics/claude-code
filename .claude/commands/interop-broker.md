---
description: 與外部 AI CLI 協作（Router/Broker/Cascade）
allowed-tools: Bash(codex:*), Bash(gemini:*), Bash(ls:*), Bash(cat:*), Bash(rg:*), Bash(jq:*), Bash(git status:*), Bash(git diff:*), Bash(uname:*), Bash(echo:*)
---

請依 @.claude/INTEROP-CODEX-GEMINI.md 執行跨 CLI 協作：

1) 任務理解與策略
- 總結當前任務與限制（唯讀/不可安裝/不可網路等）
- 建議 Router / Broker / Cascade 其中之一，並說明理由

2) 上下文打包（唯讀）
- 萃取必要片段與 `git diff`（若適用），存到 `.claude/interop/context/ctx-<ts>.md`

3) 可執行指令草案
- 若系統存在 `codex`：產生 `codex ...` 命令與輸出路徑 `.claude/interop/artifacts/codex-<ts>.out`
- 若系統存在 `gemini`：產生 `gemini ...` 命令與輸出路徑 `.claude/interop/artifacts/gemini-<ts>.out`
- 不直接執行，先顯示合併的最小授權請求（一次確認）

4) 執行與收斂（選用）
- 經同意後執行外部 CLI，收集輸出，嘗試正規化為結構化資料
- 使用 PR Review Toolkit + security-guidance 審查
- 產出最小變更提案（apply_patch 或 PR ）

5) 審計輸出
- 將命令、輸入摘要、輸出摘要與決策寫入 `CLAUDE_DECISIONS.md`，並提供回復指令

提示：若偵測不到外部 CLI，則僅提供可複製的命令與整合方案，不會嘗試執行。

