# 與 Codex CLI、Gemini CLI 的最佳實踐（Interoperability）

目標：讓 Claude Code 在需要時「主動、可控、可回復」地協同 Codex CLI 與 Gemini CLI 工作，最大化產能並保持安全、可審計與一致體驗。

---

## 1) 何時交給外部 CLI？（決策模式）

- Router（路由）：根據任務性質動態挑選最擅長的 CLI（Claude / Codex / Gemini）
- Broker（並行仲裁）：同時交付 2–3 家，收攏為單一提案（合取/折衷/票選）
- Cascade（級聯備援）：主模型失敗或信心不足 → 依序換手
- Canary（金絲雀）：小任務先試外部 CLI，若品質佳再擴大使用

建議：在 `/setup` 或 `/project-bootstrap` 的總結中由 Claude 產生「任務→路由策略」建議表，持續學習迭代。

---

## 2) 請求封裝（Context Packaging）

- 精簡必需上下文：
  - 用 `rg` 摘要關鍵檔案與片段；只附必要段落（避免爆 context）
  - 附上 `git diff` 片段（若問修正/重構）
- 請求格式（建議）：
  - 指令：目的、限制（唯讀/不動 DB/不得安裝套件）、期望輸出格式（JSON or Markdown 區塊）
  - 資源：路徑清單、片段、版本（node/python/go/…）
- 安全遮罩：一律移除 secrets（.env、金鑰），或以占位符表示

---

## 3) 輸出標準化（Result Normalization）

鼓勵外部 CLI 以結構化輸出（若不支援，請求 JSON in code fence）：

```jsonc
{
  "summary": "一句話總結",
  "changes": [
    { "path": "src/x.ts", "type": "edit", "diff": "patch 或建議" }
  ],
  "commands": ["可選：建議執行的命令"],
  "risks": ["風險與假設"],
  "confidence": 0.0-1.0
}
```

Claude 取回後：
- 先審查（PR Review Toolkit + security-guidance），再決定是否套用
- 一律以「最小變更、可回復」落地（apply_patch / 產生 PR）

---

## 4) 安全與治理（必做）

- 工具權限：把 `Bash(codex:*)`、`Bash(gemini:*)` 納入 `/permissions` 的詢問或允許清單（僅限必要參數）
- 網路與檔案：外部 CLI 預設唯讀；需要寫入時先總結差異與風險
- 機密：永不傳遞 secrets；必要時使用短期 token、環境變數白名單
- 審計：所有命令、輸入摘要、輸出與決策，附到 `CLAUDE_DECISIONS.md`

---

## 5) 工作流模式（可直接採用）

- Handoff（移交）：由 Claude 打包上下文 → 呼叫單一 CLI → 取回結果 → 內部審查 → 最小變更落地
- Ensemble（並行）：Codex/Gemini/Claude 各出一稿 → Claude 整合評審 → 合成一份最終 patch
- Guardrail（護欄）：任何外部變更在落地前都跑 `pr-review-toolkit` 與 `security-guidance`，必要時再回外部請求修正

---

## 5.1) Codex CLI 使用要點（避免常見錯誤）

- `-p/--profile` 是「設定檔名稱」，不是「prompt」。請用 `exec -- "<prompt>"` 傳遞提示詞。
- 全域旗標（如 `-a/--ask-for-approval`, `-s/--sandbox`, `-C/--cd`, `-m/--model`）需置於子命令 `exec` 之前：
  ```bash
  codex -a on-failure -s workspace-write -C "$PWD" -m <MODEL> exec -- "$(cat ctx.md)" > out.txt
  ```
- 使用 `--` 讓後續內容被視為「提示詞」或參數值，避免誤被解析成 CLI 旗標。
- 若需把 `-a` 作為「提示詞內容」的一部分而非旗標，請用 `-- -a`（一般不建議把旗標文字放進提示詞）。

---

## 6) 目錄與檔案建議

- `.claude/interop/`：
  - `context/`：臨時請求封裝（清理敏感資料）
  - `artifacts/`：外部 CLI 的原始輸出
  - `summaries/`：Claude 的整合報告
- `.gitignore`：略過上述臨時檔

---

## 7) 可靠性與重現

- 固定 CLI 版本（`codex --version` / `gemini --version`）並紀錄
- 命令與參數列入審計檔（可重放）
- 超時、重試與降級策略（超時→改用 Router/Cascade）

---

## 8) 推薦 Slash 指令（已提供模板）

- `/interop-broker`：自動判斷 Router/Broker/Cascade，並提示下一步
- `/handoff-codex`：把當前任務交給 Codex CLI，取回後走內建審查與最小落地
- `/handoff-gemini`：同上，交給 Gemini CLI

這些指令會先確認系統是否有對應 CLI，若沒有則只生成可執行的命令建議與說明，不會直接嘗試執行。

---

## 9) 與現有機制的整合

- `/setup` 與 `/project-bootstrap` 已可與外部 CLI 共存，不會互相干擾
- `security-guidance` 與 `pr-review-toolkit` 在外部結果落地前執行，確保品質與安全
- 背景命令可用 Ctrl-b；長任務不中斷主線

---

## 10) 常見錯誤與對策

- CLI 不在 PATH：提示安裝命令與權限需求（不主動安裝）
- 輸出非結構化：由 Claude 嘗試正規化，失敗則退回人審
- 大型 patch：請求對方分批或以檔案分組；Claude 逐批審查
