---
description: 自動生成專案技能（Skills）—依技術棧與工件量身打造
allowed-tools: Write(*), Edit(*), Read(*), Grep(*), Bash(rg:*), Bash(ls:*), Bash(cat:*), Bash(node:*), Bash(python3:*), Bash(jq:*), Bash(git status:*), Bash(git rev-parse:*)
---

請依 @.claude/SKILLS-GENERATOR.md 進行以下步驟，單次授權後全自動完成：

1) 偵測
- 以 rg/ls 檢測專案特徵：`package.json`、`tsconfig.json`、`pyproject.toml`、`requirements.txt`、`Dockerfile`、`docker-compose*`、`k8s/`、`helm/`、`manifests/`、`openapi.*.(yml|yaml|json)`、`swagger.*`、測試目錄/檔案規則。
- 產生偵測報告（特徵 → 憑據檔案與行數）。

2) 建議技能清單
- 依偵測結果與政策對照，彙整將要建立的技能：
  - 通用：repo-architecture、test-coverage
  - JS/TS：js-ts-npm-tasks
  - Python：python-env-tasks
  - Docker：docker-review
  - K8s：k8s-review
  - OpenAPI：openapi-review
- 顯示清單與簡述，請使用者一次性確認（預設全選）。

3) 生成技能（唯讀預設）
- 在 `.claude/skills/` 建立對應資料夾與 `SKILL.md`；若已存在，提供「略過/覆蓋/合併」選項，預設略過。
- `allowed-tools` 預設：`Read(*), Grep(*), Glob(*)`。
- 範本來源優先序：
  1) `.claude/templates/skills/<skill>/SKILL.md`
  2) 依偵測結果即時生成（若無範本）
- 內容需包含：name、description（做什麼＋何時用）、使用情境、輸出格式與限制。

4) 驗證與列示
- 驗證每個 `SKILL.md` 前言 YAML 合法性。
- 列出成功建立的技能與路徑。

5) 審計與回復
- 將新增/覆蓋清單與依據寫入 `CLAUDE_DECISIONS.md`，附回復步驟（刪除檔案/還原備份）。

注意：
- 盡量不寫入非技能檔案；
- 不安裝任何外部套件，必要時僅於 skill 文內列出安裝指令供人手動處理；
- 保持最小變更與可回復策略。

