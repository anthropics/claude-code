---
description: 自動啟動與準備（環境→設定→外掛→MCP/Agents→驗證）
allowed-tools: Bash(node:*), Bash(python3:*), Bash(git status:*), Bash(git rev-parse:*), Bash(rg:*), Bash(ls:*), Bash(cat:*), Bash(gh --version*), Bash(gh auth status*), Bash(uname:*), Bash(echo:*)
---

目標：讓 Claude Code 依 @.claude/PROJECT-SETUP.md 與 @.claude/AGENTS-MCP-POLICY.md 全自動地完成專案啟動與最佳化設定，盡量不需使用者手動介入。

執行步驟（請嚴格依序）：

1) 規劃與治理載入
- 讀取並解析 @.claude/PROJECT-SETUP.md、@.claude/AGENTS-MCP-POLICY.md、@.claude/ORG-GOVERNANCE.md
- 嘗試載入 `.claude/org-policy.json` 或 `CLAUDE_ORG_POLICY_PATH` 指定的檔案；若不存在，參考 `org-policy.example.json`
- 產出高層計畫（可並行/需串行的任務、成功條件與退出條件），並明確標註「Org 政策優先」

2) 環境檢查（唯讀）
- 檢查 node、python3、rg、git、gh（若存在）版本與狀態
- 檢查是否在 git 倉庫、當前分支、是否乾淨
- 輸出報告

3) 設定與權限
- 若缺少 `.claude/settings.json`：建立最小且安全的設定檔；若已有，僅追加必要欄位（例如 `extraKnownMarketplaces`）
- 設定 `/permissions`：高風險工具採詢問模式；讀取與搜尋工具允許自由讀取
- 設定 `/model`：採 Plan=Sonnet / Execute=Haiku 4.5；若型號不可用則採預設並回報

4) 外掛（plugins）
- 透過 `/plugin marketplace` 檢查來源
- 安裝並啟用：commit-commands、feature-dev、pr-review-toolkit、security-guidance
- 執行 `/plugin validate`，若失敗則自動診斷與修正

5) MCP / Agents 適配（Org 政策優先）
- 依 @.claude/AGENTS-MCP-POLICY.md 的偵測→評分→建議→套用流程：
  - 偵測專案特徵並建立建議清單（含理由與風險）
  - 先套用 org policy 的 allowlist/denylist，過濾不可用項目
  - 對 `score ≥ 0.6` 且符合 allowlist 才建議啟用；`0.5~0.6` 需一次性授權；`<0.5` 或命中 denylist 則停用
  - 在 `/mcp` 內啟用/停用伺服器，或更新設定檔；高風險資源預設唯讀，必要時再升權
  - 一律保留：feature-dev、pr-review-toolkit、commit-commands、security-guidance

6) Skills（專案自動生成）
- 執行 `/skills-generate` 產生與專案相符的唯讀技能；
- 列出新增/覆蓋清單並徵詢一次性確認；
- 成功後列示可用技能與路徑。

7) 安全與 Hook
- 確認 `security-guidance` 的 PreToolUse Hook 正常生效
- 顯示將攔截的風險規則與替代作法摘要

8) 專案探索與上下文
- 以 rg 與檔案讀取快速建立「關鍵檔案一覽」與「入口點/模組/測試/組態」摘要
- 利用 `/add-dir` 與 @ 檔案提及，將必要目錄與檔案加入上下文建議清單

9) 驗證與輸出（含審計）
- 執行 `/doctor`，顯示錯誤與修正結果
- 產出最終摘要：
  - 環境檢查結果與修復建議
  - 已安裝/啟用外掛
  - 權限策略概要
  - MCP 啟用/停用清單與理由（明示命中 allowlist/denylist 與分數）
  - Skills 新增/覆蓋清單與說明
  - 專案理解摘要與建議下一步
 - 將「差異摘要 + 回復指令」與本次決策依據寫入 `CLAUDE_DECISIONS.md`（若 org policy 指定其他檔案，則依指定路徑）

注意：任何寫入動作務必採最小變更與可回復策略（生成 .bak 或提供回復指令），並於單一授權視窗中請求許可後再套用。
