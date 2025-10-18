# Skills 自動生成政策（依專案內容）

目的：依據專案實際技術棧與工件，生成對應且有用的專案技能（Project Skills），並僅授予必要的工具權限。

生成位置：`.claude/skills/<skill-name>/SKILL.md`

通用原則：
- 單一職責：每個 Skill 解決明確的一類任務。
- 可預期、安全：盡量採用唯讀工具（Read/Grep/Glob），非必要不寫入。
- 易於被觸發：description 必須清楚描述「做什麼＋何時用」。

---

## 偵測規則 → 對應技能

- Node.js/TypeScript（偵測 `package.json`、`tsconfig.json`）
  - `repo-architecture`（通用）
  - `js-ts-npm-tasks`：解讀 npm/yarn/pnpm scripts、建置與測試流程
  - `test-coverage`：測試檔與覆蓋率結果解讀
- Python（偵測 `pyproject.toml`、`requirements.txt`）
  - `repo-architecture`（通用）
  - `python-env-tasks`：venv/pip/pytest 任務與常見問題排查
  - `test-coverage`（通用）
- Docker（偵測 `Dockerfile`、`docker-compose.*`）
  - `docker-review`：映像大小、分層、cache、multi-stage、CVE 風險提示（唯讀）
- Kubernetes（偵測 `k8s/`、`manifests/`、`helm/`）
  - `k8s-review`：資源請求/限制、安全與存活探針（唯讀）
- OpenAPI/Swagger（偵測 `openapi.*.(yml|yaml|json)`、`swagger.*`）
  - `openapi-review`：契約一致性、型別/錯誤代碼、範例檢查（唯讀）

可自由擴充其他領域（DB、IaC、gRPC 等）。

---

## 寫入策略

- 生成前列出即將建立的技能清單與簡述，採單次確認。
- 若技能已存在，預設跳過或提出「覆蓋/合併」選項。
- 所有技能一律以 Read/Grep/Glob 為 `allowed-tools` 預設；如需進階權限，另行徵詢。

---

## 品質檢查

- 檢查 SKILL.md YAML 前言是否合法。
- description 是否包含「做什麼＋何時用」。
- 若依賴外部套件（例如 Python 套件），於文件中明列安裝步驟，但不自動安裝。

---

## 審計

- 生成或更新技能後，於 `CLAUDE_DECISIONS.md` 記錄：新增/覆蓋哪些技能、依據與回復方式。

