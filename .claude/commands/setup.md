---
description: 一鍵設定（最友善）：以安全預設全自動完成環境與選配
allowed-tools: Bash(node:*), Bash(python3:*), Bash(git status:*), Bash(git rev-parse:*), Bash(rg:*), Bash(ls:*), Bash(cat:*), Bash(gh --version*), Bash(gh auth status*), Bash(uname:*), Bash(echo:*)
---

請以「零干擾、單次授權」的原則，自動完成以下事項：

1) 讀取並遵循：@.claude/ORG-GOVERNANCE.md（若有 org policy 則優先）、@.claude/PROJECT-SETUP.md、@.claude/AGENTS-MCP-POLICY.md。
2) 產出高層計畫與 TODO，標示可並行/需串行項目。
3) 環境健檢（唯讀）並輸出結果與必要修復方案。
4) 設定與權限：若無 `.claude/settings.json` 則建立最小檔；合併 org policy；高風險工具採詢問；Read/Grep 允許。
5) 外掛：檢查 marketplace，安裝/啟用 commit-commands、feature-dev、pr-review-toolkit、security-guidance，並 `/plugin validate`。
6) MCP/Agents：依政策偵測→評分→建議→套用；allowlist/denylist 優先；高風險預設唯讀，必要時提出一次性升權請求。
7) Skills（依專案自動生成）：執行 `/skills-generate`，依技術棧在 `.claude/skills/` 生成對應技能（唯讀預設），避免冗餘，並列出新增清單。
8) 安全 Hook：確認 security-guidance 的 PreToolUse 正常；顯示攔截規則與替代實作摘要。
9) 專案探索：輸出「關鍵檔案一覽」、「入口/模組/測試/組態摘要」，並以 `/add-dir` 與 @ 檔案方式準備上下文。
10) 驗證與審計：執行 `/doctor`；輸出總結（環境、外掛、權限、MCP/Skills 決策、下一步）；將差異與回復指令寫入 `CLAUDE_DECISIONS.md`。

注意：
- 僅在需要時一次性徵詢授權（安裝、升權、寫入設定）；
- 任何寫入採最小變更可回復；
- 若政策衝突，以 org policy 為準並記錄理由。
