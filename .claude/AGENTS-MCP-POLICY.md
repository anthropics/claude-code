# 自動化 MCP / Agents 選配政策（適用所有專案）

目標：依專案實際內容自動「只啟用必要的 MCP/Agents」，避免冗餘與風險，同時給出可追溯的理由與最小授權提示。

用法：在啟動劇本（@.claude/PROJECT-SETUP.md）中，請依本政策進行偵測、評分、建議、確認與套用；若存在組織治理政策（@.claude/ORG-GOVERNANCE.md 與 `.claude/org-policy.json`），請以組織政策優先，並將本政策作為補充規則。

---

## A. 偵測（Detection）

請以只讀方式掃描專案根目錄並建立偵測報告：

- 語言/框架：
  - JS/TS：`package.json`、`tsconfig.json`、`yarn.lock`、`pnpm-lock.yaml`
  - Python：`pyproject.toml`、`requirements.txt`、`Pipfile`
  - Go：`go.mod`、`go.sum`
  - JVM：`pom.xml`、`build.gradle`、`gradle.properties`
  - Rust：`Cargo.toml`
- Infra/容器/部署：
  - Docker：`Dockerfile`、`docker-compose.*`
  - K8s：`k8s/`、`manifests/`、`helm/`
  - IaC：`terraform/`、`*.tf`、`pulumi.*`
- 資料庫/快取/佇列：
  - Postgres/MySQL/Mongo/Redis/RabbitMQ：連線字串於 `.env*`、`config/`、`docker-compose.*` 服務名稱
- API/協定：
  - OpenAPI/Swagger：`openapi.*.(ya?ml|json)`、`swagger.*`
  - gRPC/Proto：`*.proto`
- 雲提供商：
  - AWS：`serverless.*`、`aws-exports.*`、`~/.aws/credentials`
  - GCP/Azure 相關設定檔
- 測試/品質：
  - 單元/端對端測試、Linter/Formatter 設定

結果以「特徵 → 憑據（檔案/路徑/內容片段）」形式彙整。

## B. 評分（Scoring）

對每個 MCP 伺服器與代理（Agent）計算一個 0~1 分數：

- 相依度（0.0~0.4）：與專案目標/堆疊的相關性
- 易用收益（0.0~0.3）：能明顯提升日常效率的程度
- 風險與成本（-0.3~0.0）：安裝/維護/權限/安全面向的折扣分

啟用門檻：`score ≥ 0.6`；`0.5~0.6` 時提示理由並徵詢一次性授權；`< 0.5` 預設不啟用。

## C. 建議（Recommendation）

從下列候選清單中評估：

### MCP 伺服器（範例）
- 檔案/搜尋：通常以內建工具（Read/Grep）足夠，無需額外 MCP。
- HTTP / OpenAPI：偵測到 `openapi.*` 或需要外部 API 模擬/調試 → 建議啟用 HTTP/OpenAPI MCP。
- Git：如需跨倉庫操作或複雜分析 → 建議啟用 Git MCP。
- Docker：偵測到 `Dockerfile`/`docker-compose.*` → 建議 Docker MCP。
- Kubernetes：偵測到 `k8s/`、`manifests/`、`helm/` → 建議 K8s MCP。
- DB：偵測到連線字串或 docker compose 服務 → 對應建議 Postgres/MySQL/Mongo/Redis MCP。
- 雲（AWS/GCP/Azure）：偵測到 IaC 或雲特定設定＋已存在憑證 → 建議對應雲 MCP。

高風險 MCP（雲、K8s、DB）採「預設唯讀 + 詢問再用（升權）」模式，並提供即將執行的能力/範圍（唯讀/寫入、命名空間、區域）供一次性或階段性授權。

### Agents（代理）
- 一律啟用：
  - `feature-dev`（七階段開發流程）
  - `pr-review-toolkit`（PR 審查六代理）
  - `commit-commands`（提交/PR 自動化）
  - `security-guidance`（安全提醒 Hook）
- 依需求增設（若存在強需求特徵才啟用）：
  - Infra 導向代理（Docker/K8s/IaC）
  - API 設計/測試代理（OpenAPI/gRPC）
  - 資料庫巡檢/資料規格代理

## D. 套用（Apply）與停用（Disable）

1) 彙整「啟用/停用清單 + 理由 + 風險」給使用者一次確認（單一授權視窗）。
2) 透過 `/plugin`、`/mcp` 與設定檔更新：
   - 啟用：`/plugin install|enable`、在 `/mcp` 內啟用伺服器（或寫入設定檔）
   - 停用：在 `/mcp` 中以 @ 關閉，或從設定檔移除
3) 高風險伺服器預設唯讀能力，後續再升級權限。

## E. 追蹤與回復（Traceability & Revert）

每次變更：
- 生成「配置差異摘要」與回復指令（如移除項目/還原檔案）；
- 將決策與依據寫入專案根的 `CLAUDE_DECISIONS.md`（若不存在則建立），保留審計線索。

## F. 範例決策對照（Heuristics → MCP/Agents）

- 侦测：`docker-compose.yml` 中含 `postgres` 服務 + `.env` 有 `DATABASE_URL`
  - 建議：Postgres MCP（唯讀），理由：資料表結構檢視、產生遷移建議
  - 分數：相依度 0.4 + 收益 0.3 - 風險 0.1 = 0.6（啟用）

- 侦测：專案僅前端 React，無後端/容器/DB 特徵
  - 建議：不啟用雲/DB/K8s/Docker MCP，僅保留預設 Agents
  - 分數：相依度低 → 不達門檻（停用）

- 侦测：存在 `openapi.yaml` 且 `scripts/test:api`
  - 建議：HTTP/OpenAPI MCP（唯讀），搭配 PR review 中的 API 介面檢查
  - 分數：相依度 0.4 + 收益 0.3 - 風險 0.05 = 0.65（啟用）

---

附註：若組織已採企業管理（allowlist/denylist），請優先遵循組織策略（見 CHANGELOG 對企業級 MCP 管理支援）；當政策與專案建議衝突時，請以組織政策為準並在審計檔中記錄取捨理由。
