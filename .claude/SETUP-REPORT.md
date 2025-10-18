# Claude Code 啟動與協作整備報告（本分支新增內容總覽）

本報告彙整此次在倉庫中新增的啟動流程、外掛/MCP/Agents 自動選配、安全治理、Skills 自動生成、外部 CLI（Codex/Gemini）互操作，以及多家 AI API 導入最佳實踐，並提供快速使用指引與後續建議。

---

## 一、你現在擁有的能力（重點）

- 一鍵啟動與驗證：/setup、/project-bootstrap 自動完成環境檢查、外掛安裝、權限與模型設定、MCP/Agents 選配、安全 Hook 啟用、專案探索、/doctor 驗證與審計輸出。
- 自動選配 MCP/Agents：依專案內容評分挑選需要的 MCP 與 Agents，遵守 allowlist/denylist 與「預設唯讀→動態升權」。
- 安全治理與審計：支援 org policy（allowlist/denylist、預設唯讀、模型白名單）、差異摘要與回復指令、所有關鍵決策寫入 CLAUDE_DECISIONS.md。
- Skills 自動生成：/skills-generate 依技術棧在 .claude/skills/ 生成對應且預設唯讀的 Skills（repo-architecture、js/ts、python、docker、k8s、openapi、test-coverage 等）。
- 外部 CLI 協作（Codex/Gemini）：/interop-broker 讓 Claude 能安全封裝上下文並交由外部 CLI 執行；/handoff-codex、/handoff-gemini 快速單點移交；/auto-interop on 支援條件式自動交接。
- 多家 AI API 導入：/api-bootstrap 生成 providers.json 與 .env.example，提供路由/退避/串流/工具呼叫/隱私/監控等跨供應商最佳實踐。

---

## 二、主要新增檔案

- 啟動與政策
  - `.claude/PROJECT-SETUP.md`（啟動劇本，完整自動化步驟）
  - `.claude/AGENTS-MCP-POLICY.md`（依專案自動選配 MCP/Agents）
  - `.claude/ORG-GOVERNANCE.md`、`.claude/org-policy.example.json`（org 級治理）
- Skills 自動生成
  - `.claude/SKILLS-GENERATOR.md`（偵測→建議→生成策略）
  - `.claude/templates/skills/*/SKILL.md`（七類唯讀技能範本）
- 外部 CLI 互操作
  - `.claude/INTEROP-CODEX-GEMINI.md`（封裝/正規化/審查/最小落地）
  - `.claude/skills/interop-router/SKILL.md`（自動判斷是否交接）
- 多家 AI API 最佳實踐
  - `.claude/AI-APIS-BEST-PRACTICES.md`（OpenRouter/OpenAI/xAI/Gemini/Anthropic）
  - `.claude/templates/ai/providers.example.json`、`.claude/templates/ai/env.example`
- 指令（Slash Commands）
  - 啟動：`.claude/commands/setup.md`、`project-bootstrap.md`
  - Skills：`.claude/commands/skills-generate.md`
  - Interop：`.claude/commands/interop-broker.md`、`handoff-codex.md`、`handoff-gemini.md`、`auto-interop.md`
  - API 導入：`.claude/commands/api-bootstrap.md`

---

## 三、快速開始（10 秒）

1) 在專案內輸入 `/setup`：
- 會自動進行：環境檢查、外掛安裝、權限/模型設定、MCP/Agents 選配、安全 Hook、專案探索、/doctor 驗證、審計輸出。

2) 生成技能 `/skills-generate`：
- 依技術棧產生 `.claude/skills/` 中對應技能（預設唯讀）。

3) API 導入 `/api-bootstrap`：
- 生成 `.env.example` 與 `ai/providers.json`；依 TS/Python 生成路由骨架提案。

4) 外部 CLI 協作（可選）
- 半自動：`/interop-broker`（建議策略、封裝執行、審查落地）
- 單點移交：`/handoff-codex`、`/handoff-gemini`
- 自動交接：`/auto-interop on`（專案層旗標 `.claude/flags/auto-interop.json`）

---

## 四、安全與治理（建議默認）

- /permissions：高風險工具採詢問；Read/Grep 允許；外部 CLI 白名單必要子命令（`Bash(codex:*)`、`Bash(gemini:*)`）。
- Org policy：若存在 `.claude/org-policy.json`，將優先遵循 allowlist/denylist 與預設唯讀。
- 審計與回復：所有落地前後差異與決策記錄於 CLAUDE_DECISIONS.md，並附回復指令。

---

## 五、Interop 自動判斷（Skill）

- `interop-router`：當偵測到大型重構、需要結構化輸出、超時/低信心、希望多模型候選等情境時，會主動建議交由外部 CLI。
- 一次性授權：使用 `/auto-interop on` 後，符合條件且評分足夠時可直接透過 `/interop-broker` 執行（首次仍會提示）。
- 永遠唯讀封裝：封裝上下文前必移除機密；落地前必跑 `pr-review-toolkit` 與 `security-guidance`。

---

## 六、多家 AI API 導入（跨供應商一致策略）

- `/api-bootstrap` 生成 providers.json 與 .env.example，並提供 TS/Python 路由骨架提案。
- 最佳實踐重點：統一抽象、fallback/退避重試、串流與工具呼叫、安全脫敏與 Evals、成本監控。

---

## 七、常見問題（FAQ）

- 需要 org policy 嗎？
  - 非必須；若提供（`.claude/org-policy.json`），會優先套用治理規則。
- 外部 CLI 不在 PATH？
  - /interop-broker 會僅產生命令草案與整合建議，不會強制執行。
- 為何有時 Skills 沒被觸發？
  - 請檢查技能的 description 是否清楚描述「做什麼＋何時用」，以及與你的請求是否語意匹配。

---

## 八、建議的後續

- 若要示範完整流程：
  - `/setup` → `/skills-generate` → `/api-bootstrap` → `/auto-interop on` →（描述一個大型重構/模板生成需求）
- 若要團隊共用：
  - 把本分支合併進主要分支；未來專案也可直接複用 `.claude/` 內容。

---

本報告檔案：`.claude/SETUP-REPORT.md`

