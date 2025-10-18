# Claude Code 專案啟動劇本（自動準備版）

目的：在任何新/既有專案啟動時，讓 Claude Code 全自動自我評估、安裝與設定必要要素，建立最佳工作流（安全、可靠、可維護），盡量不需要使用者做手動操作。請完整遵循本劇本逐步執行，必要時請自行提出授權請求（例如套件安裝、權限開啟）。

使用方式：在專案根目錄開啟 Claude Code 後，輸入或貼上：

- 「請完全依照 @.claude/PROJECT-SETUP.md 執行，從環境檢查到外掛安裝、設定、驗證與總結。遇到需要授權的步驟主動提示並繼續完成。」

若組織提供治理政策（org policy）：
- 請先讀取並遵循 @.claude/ORG-GOVERNANCE.md 與 `.claude/org-policy.json`（若不存在則使用 `org-policy.example.json` 範本），所有 MCP/Agents/工具權限的決策需以組織政策優先。

---

## 一、建立計畫與原則（先產生 TODO，允許並行）

請先：
- 產生一份高層計畫（含各階段任務、成功條件與退出條件），標記可並行與需串行執行的步驟。
- 全程以「最低驚擾原則」執行：
  - 僅在必要時修改檔案與設定；
  - 對潛在破壞性動作一律先詢問授權；
  - 任何寫入動作都先備份（如 `*.bak`）。

## 二、環境健檢與自動修復

請自動偵測並在必要時修復或請求授權安裝：

1) 核心工具版本
- Node.js ≥ 18：`node -v`
- npm/yarn/pnpm：`npm -v`、`yarn -v`、`pnpm -v`
- ripgrep（rg）：`rg --version`
- Git 與狀態：`git --version`、`git rev-parse --is-inside-work-tree`
- GitHub CLI（選用，用於 PR 自動化）：`gh --version` 與 `gh auth status`
- Python3（用於安全 Hook）：`python3 --version`

若缺少：
- macOS：優先以 Homebrew 安裝（例如 `brew install gh ripgrep`），並先提示授權。
- Debian/Ubuntu：`sudo apt-get update && sudo apt-get install -y ripgrep`（先請求授權）。
- Windows：提示使用者是否允許以 `winget`/`choco` 安裝。

2) Git 倉庫初始化與安全預設
- 若非 Git 倉庫：請詢問是否執行 `git init` 並建立 `main` 分支。
- 檢查 `.gitignore` 是否存在，如無則建立，最少包含：
  - `node_modules/`
  - `.env`
  - `.DS_Store`
  - `dist/`、`build/`
- 僅在 `.gitignore` 缺漏項目時追加，不覆寫既有內容。

3) repo 衛生檢查
- 檢查是否存在 `.editorconfig`，如無可建立簡易版（2 空格縮排、UTF-8、LF）。
- 檢查是否已有 README、LICENSE（僅提示，不自動新增）。

## 三、Claude Code 設定最小集

1) `.claude/settings.json`
- 若不存在：建立最小、保守且通用的設定檔，包含：
  - `extraKnownMarketplaces`：加入專案內或團隊指定的 marketplace（如存在 `./.claude-plugin/marketplace.json` 則加入該相對路徑）。
  - 任何非必要欄位請避免加入，以降低格式不正確風險。
- 若已存在：
  - 僅在缺少 `extraKnownMarketplaces` 且可用時追加；其他欄位不動。

2) 權限策略（/permissions）
- 啟用「詢問再用」模式於高風險工具（至少：Bash、Write/Edit、多檔寫入、網路相關）。
- 允許「Read」與「Grep（rg）」對專案根目錄下檔案自由讀取。
- 提案後請先顯示規則變更摘要再套用。
 - 若有 org policy，請先合併並以 org 規則優先（allowlist/denylist 與預設策略）。

3) 模型與思考策略（/model）
- 預設採「Plan 用 Sonnet、執行用 Haiku 4.5」（SonnetPlan）策略；若使用者方案無對應型號則採用當前預設並提示。
- 開啟/維持思考模式的切換提示（使用者可在工作階段中調整）。

## 四、外掛（Plugins）建議安裝與啟用

請自動安裝並啟用下列外掛（若已安裝則跳過）：
- `commit-commands`：加速 Git 提交/PR 流程。
- `feature-dev`：七階段功能開發工作流。
- `pr-review-toolkit`：PR 全面審查（測試、註解、錯誤處理、型別、一般審查、簡化）。
- `security-guidance`：安全提醒 Hook（偵測 `exec`、`eval`、XSS 等危險模式）。

安裝/啟用流程：
- 先以 `/plugin marketplace` 檢查來源可用性；
- 逐一執行 `/plugin install <name>` 與 `/plugin enable <name>`；
- 執行 `/plugin validate` 確認配置正確，若失敗請自動診斷與修正。

## 五、MCP 伺服器（/mcp）

- 列出可用 MCP 伺服器並顯示工具摘要；
- 建議開啟與專案最相關的伺服器（例如：檔案系統、搜尋、特定雲端/內部 API）；
- 以 @ 提及快速開關，並保存選擇（若支援）。
 - 必須先套用 org policy 的 allowlist/denylist 與「預設唯讀→動態升權」規則；高風險伺服器（雲/K8s/DB）一律預設唯讀並於需要時再徵詢升權。

## 六、安全與 Hook

- 確認 `security-guidance` 外掛已啟用，`PreToolUse` Hook 正常生效；
- 若專案無法使用外掛，改以本地 Hook 策略（於 `.claude/hooks/` 下建立具同等功能的 Hook 設定與腳本）—採最小侵入、可回復策略；
- 於第一輪寫入前，展示「將攔截的風險規則與替代實作」摘要（例如以 `execFile` 取代 `exec`）。
 - 若 org policy 定義了額外禁止（deny）規則，請在此同步顯示並強制執行。

## 七、專案理解與自動上下文布建

- 啟動探索：先以「快速探索/索引」掃描專案，找出語言、框架、建置/測試腳本、關鍵目錄；
- 針對中大型專案，先讀取 `package.json`/`pyproject.toml`/`go.mod`/`requirements.txt` 等定址檔；
- 彙整成「關鍵檔案一覽」並標示：入口點、主要模組、測試位置、組態檔；
- 將重要目錄加入 Claude 的建議上下文（使用 `/add-dir` 與 @ 檔案提及），避免一次性讀取過量檔案；
- 輸出「首輪探索摘要」，供後續工作流（如 `/feature-dev`）直接使用。

## 八、Git 工作流預設

- 確認 `commit-commands` 可運作：
  - 在無改動時不建立空白 commit；
  - 在有改動時自動生成符合倉庫風格的訊息草案；
- 推薦標準使用：開發中用 `/commit`，準備送審用 `/commit-push-pr`；
- 安裝並驗證 GitHub CLI 時，PR 的建立流程應自動包含摘要與測試計畫。

## 九、驗證與收斂

- 執行 `/doctor` 檢查設定正確性、權限規則語法、MCP 工具上下文；
- 回報：
  - 環境健檢結果（有哪些已修復/仍需人工安裝）
  - 已安裝/啟用外掛清單
  - 權限策略摘要（哪些工具需詢問）
  - MCP 啟用清單
  - Org policy 套用摘要（allowlist/denylist 命中項、唯讀/升權策略）
  - 專案理解摘要與建議下一步（例如「若要開新功能，直接執行 /feature-dev 並描述需求」）

## 十、故障處理策略

- 若安裝或驗證失敗：
  - 先提供具體錯誤與原因；
  - 自動提出替代路徑（例如改用另一套件管理器、或以本地 Hook 代替外掛）；
  - 對需要人工介入的部分，最小化步驟並一次性詢問授權。

## 十一、完成條件

當下列條件皆達成，回報「啟動完成」並附上操作指南：
- 環境檢查通過或已提供可執行的修復計畫；
- `.claude/settings.json`（如有需要）已建立或修正完畢；
- 推薦外掛已安裝並啟用，且 `/plugin validate` 成功；
- 權限策略已套用；
- MCP 依需求啟用；
- 首輪專案探索摘要與後續建議已產出。

---

附註：若專案中已存在 `.claude-plugin/marketplace.json`（如本倉庫），請自動將它加入 `extraKnownMarketplaces`。如無，改以 `/plugin marketplace` 尋找對等來源。任何設定寫入皆應保守、可回復、最小變更。
