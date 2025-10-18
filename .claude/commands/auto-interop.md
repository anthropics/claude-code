---
description: 自動交接外部 CLI 開關（on|off|status）
allowed-tools: Read(*), Write(*), Edit(*), Bash(ls:*), Bash(cat:*), Bash(test:*), Bash(echo:*)
---

用法：
- `/auto-interop on`  在本專案啟用「自動判斷並交給 Codex/Gemini」
- `/auto-interop off` 關閉（僅提出建議，不自動執行）
- `/auto-interop status` 顯示目前狀態（預設）

行為說明：
- 專案層旗標：`.claude/flags/auto-interop.json`（優先）
- 使用者層旗標（可選）：`~/.claude/flags/auto-interop.json`（做為預設）
- Interop Router Skill 會先讀專案層，再讀使用者層，最後預設為關閉。

請執行以下步驟：
1) 解析參數（on/off/status），預設 status。
2) 專案層寫入：將 `{ "enabled": true|false, "timestamp": "ISO-8601" }` 寫到 `.claude/flags/auto-interop.json`（若為 status 則僅讀取，不寫入）。
3) 顯示結果：
   - 專案層：是否存在與內容
   - 使用者層：如可讀取則顯示；若無則略過
4) 提醒：可手動在 `~/.claude/flags/auto-interop.json` 建立相同格式以設為全域預設；不會自動寫入使用者層（避免誤驚擾）。

