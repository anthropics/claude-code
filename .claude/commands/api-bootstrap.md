---
description: AI API 一鍵整合（OpenRouter/OpenAI/xAI/Gemini/Anthropic）
allowed-tools: Write(*), Edit(*), Read(*), Grep(*), Bash(ls:*), Bash(cat:*), Bash(rg:*), Bash(node:*), Bash(python3:*), Bash(git status:*), Bash(uname:*), Bash(echo:*)
---

請依 @.claude/AI-APIS-BEST-PRACTICES.md 進行跨供應商的一鍵整合：

1) 偵測語言棧與結構
- 若有 `package.json` → 偏向 TypeScript/Node；若有 `pyproject.toml`/`requirements.txt` → 偏向 Python。
- 產生最小計畫（TS 或 Python 版本）。

2) 生成設定與樣板（最小變更，可回復）
- 在專案根：
  - 若無 `.env.example`：以 `.claude/templates/ai/env.example` 建立（不覆蓋既有檔）。
  - 建立 `ai/providers.json`（若無），來源 `.claude/templates/ai/providers.example.json`，如需可精簡為僅保留你打算使用的供應商。
- 提示將 `.env` 加入 `.gitignore`（若未加入）。

3) 路由器與用法（建議生成）
- TypeScript：`ai/router.ts` + `ai/client.ts` 的介面骨架（Provider/Router）；
- Python：`ai/router.py` + `ai/client.py` 的介面骨架；
- 內容僅 scaffold（不耦合特定 SDK），由 Claude 依你的需求再補全。

4) 驗證與下一步
- 列出偵測到的供應商、已建立的檔案與路徑；
- 提出「測試呼叫」範例（curl/Node/Python），不直接呼叫外部網路；
- 提醒將真實金鑰寫入本機 `.env`，勿提交。

5) 審計與回復
- 將新增或變更的檔案列入 `CLAUDE_DECISIONS.md`，附回復方式（刪除檔案或還原備份）。

安全：不自動安裝任何 SDK 或傳送金鑰；所有寫入均採最小變更並可回復。

