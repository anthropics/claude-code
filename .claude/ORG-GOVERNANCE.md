# 組織級治理（Org Governance）— MCP/Agents/工具 權限管理

目標：在多專案、多團隊環境中，以「預設安全、最小授權、可審計」為原則，集中管理 MCP 伺服器、Agents 與工具權限，避免冗餘與風險。

實作位置：
- 首選：`.claude/org-policy.json`（專案層覆蓋/繼承組織預設）
- 亦可透過環境變數 `CLAUDE_ORG_POLICY_PATH` 指向集中式政策檔
- 無政策時可使用 `org-policy.example.json` 作為起點

優先順序：Org 政策 > 專案建議（@.claude/AGENTS-MCP-POLICY.md）> 預設（@.claude/PROJECT-SETUP.md）

---

## 核心原則

1) 最小授權：高風險資源（雲/K8s/DB）預設唯讀，需時才升權；升權前必須取得一次性授權（或階段授權）。
2) 只啟用必要：以 allowlist/denylist 控制可啟用的 MCP/Agents/Plugins；不在 allowlist 中者，除非明示授權，否則不得啟用。
3) 審計可追溯：所有決策輸出到 `CLAUDE_DECISIONS.md`（或 org policy 指定路徑），含「依據、變更、回復方式」。
4) 可回復：設定變更採最小變更並附回復指令（或備份檔）。

---

## 政策檔（org-policy.json）建議結構

此為參考結構，實際欄位以組織需求為準。

```
{
  "$schema": "https://anthropic.com/claude-code/org-policy.schema.json",
  "mcp": {
    "allowlist": ["^docker$", "^k8s$", "^git$", "^http(s)?://.*trusted\\.corp\\.com/.*"],
    "denylist": ["^experimental-.*$", "^prod-.*-write$"],
    "defaultPermissions": { "read": "allow", "write": "ask", "network": "ask" }
  },
  "plugins": {
    "allowlist": ["commit-commands", "feature-dev", "pr-review-toolkit", "security-guidance"],
    "denylist": []
  },
  "agents": {
    "allowlist": ["feature-dev", "pr-review-toolkit", "commit-commands"],
    "denylist": ["experimental-*"]
  },
  "tools": {
    "rules": [
      { "pattern": "Bash(*)", "policy": "ask" },
      { "pattern": "Write(*)", "policy": "ask" },
      { "pattern": "Edit(*)", "policy": "ask" },
      { "pattern": "Read(*)", "policy": "allow" },
      { "pattern": "Grep(*)", "policy": "allow" }
    ]
  },
  "models": {
    "defaultPlan": "sonnet-4.5",
    "defaultExecute": "haiku-4.5",
    "allowed": []
  },
  "privacy": {
    "disableNonessentialTraffic": true
  },
  "audit": {
    "decisionsFile": "CLAUDE_DECISIONS.md"
  }
}
```

---

## 套用規則

1) 啟動時先載入 org policy，產生「有效政策」：
   - 套用 allowlist/denylist 過濾 MCP/Agents/Plugins
   - 覆蓋 `/permissions` 與 MCP 預設權限（唯讀/寫入/網路）
   - 設定模型預設與白名單

2) 高風險資源一律預設唯讀：
   - 需要寫入或具破壞性操作時，先產生「升權請求」摘要（目的、範圍、時效）並徵詢一次性授權

3) 專案建議（來自 @.claude/AGENTS-MCP-POLICY.md）與 org policy 衝突時：
   - 以 org policy 為準；
   - 在 `CLAUDE_DECISIONS.md` 記錄被拒絕/降級的項目與理由。

4) 變更審計：
   - 每次套用或升權都將差異摘要寫入 audit 檔，並附「回復指令」。

---

## 快速檢查清單

- 已找到 `.claude/org-policy.json` 或 `CLAUDE_ORG_POLICY_PATH`
- 已套用 allowlist/denylist 過濾
- 高風險 MCP 預設唯讀，升權需一次性授權
- `/permissions` 已與 org policy 同步
- 模型預設與白名單已套用
- 變更已寫入審計檔並可回復

