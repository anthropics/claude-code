# 多家 AI API 導入最佳實踐（OpenRouter / OpenAI / xAI / Gemini / Anthropic）

目標：提供跨供應商的一致整合策略，讓專案可快速導入或切換任一 AI API，同時兼顧安全、效能、成本與可維護性。

---

## 1) 統一抽象（強烈建議）

- 建立「Provider 介面」：input → output 統一形態（messages、tools、stream、metadata）。
- 實作多個 Provider：openrouter、openai、xai、gemini、anthropic。
- 由「Router」決定用誰：
  - 首選（primary）→ 次選（fallback）→ 降級（canary/cascade）。
  - 可用性與配額監控（速率限制、失敗率）。
- 保持請求上下文的最小化，避免供應商之間的 prompt 洩露彼此細節。

---

## 2) 機密與設定

- 統一環境變數命名（建議）：
  - `OPENROUTER_API_KEY`
  - `OPENAI_API_KEY`
  - `XAI_API_KEY`
  - `GEMINI_API_KEY`（Google AI for Developers）或 `GOOGLE_VERTEX_PROJECT/LOCATION`（Vertex）
  - `ANTHROPIC_API_KEY`
- 端點（若需自訂）：
  - `OPENAI_BASE_URL`、`OPENROUTER_BASE_URL`、`ANTHROPIC_BASE_URL`、`XAI_BASE_URL`、`GEMINI_BASE_URL`
- 請勿把 API Key 寫入程式碼或日誌；.env 與密碼管控（Vault/KMS/Secret Manager）。
- 以 .env.example 提供變數名稱與說明，避免提交真實值。

---

## 3) 請求策略（品質與成本）

- 溫度與探勘：`temperature` 與 `top_p` 影響創意度；回覆一致性可用 `temperature=0.2~0.4`。
- 上下文控制：
  - 長文切塊（chunking）+ 要點摘要（map-reduce）；必要時使用「檔案檢索」或向量索引。
  - 僅附必要片段（避免超額 token）。
- 並行與合併（Ensemble）：不同供應商同題目 → Claude 合併，或投票/信心加權。
- 成本：追蹤 token 使用量與每供應商費率，建立成本警戒。

---

## 4) 錯誤處理與重試

- 退避重試（exponential backoff with jitter）：429/5xx 時重試 3–5 次。
- 供應商切換（failover）：主供應商持續 5xx/超時 → 自動切到備援。
- 超時：串流 60–120s，非串流 30–60s；避免阻塞主流程。
- 可重放性：保留 request-id、params、輸出摘要，便於除錯與審計。

---

## 5) 串流與函式/工具呼叫

- 串流：首選串流（SSE/WebSocket）以改善互動感；支援增量渲染與中斷。
- 函式/工具呼叫：
  - OpenAI：function/tool calls（`tool_calls`）。
  - Anthropic：工具使用（`tools` + `tool_use`/`tool_result`）。
  - 其他供應商可用上層抽象統一為「工具意圖 → 參數 → 執行 → 回填」。
- 保持工具 schema（JSON Schema）一致，便於跨供應商互通。

---

## 6) 安全與隱私

- 脫敏：移除 PII/密鑰，再送雲端供應商。
- 日誌：避免完整 prompt/回覆落地；以哈希與摘要替代。
- 模型選擇：依資料敏感程度挑選合規地區與供應商；必要時自建/私有端點。
- 政策對齊：各家安全與使用政策不同；先審閱合規（資料主權、留存、再訓練）。

---

## 7) 監控與評估（Evals）

- 指標：正確率、事實性、完整度、毒性、安全事件、延遲、成本。
- A/B 與線上評估：路由策略與 prompt 變更需驗證。
- 失敗樣本收集：建立最小可重現上下文（red team / regression set）。

---

## 8) 專案落地建議（檔案）

- `ai/providers.json`：供應商清單、優先序、模型名、端點與 timeouts。
- `ai/router.(ts|py)`：路由與退避策略的實作。
- `ai/telemetry.(ts|py)`：打點與審計摘要。
- `.env.example`：各供應商的 key 與可選端點。

這些檔案可透過 `/api-bootstrap` 指令由 Claude 代為生成（偵測 TS/Python ）。

---

## 9) 供應商快速對照（摘要）

- OpenRouter：多供應商匯集（`https://openrouter.ai/api/v1`），可透過 model 名選擇後端；需 `Authorization: Bearer <OPENROUTER_API_KEY>`。
- OpenAI：`https://api.openai.com/v1`；建議使用串流與 function calling；`Authorization: Bearer <OPENAI_API_KEY>`。
- xAI（Grok）：`https://api.x.ai/v1`（常見為 chat/completions）；`Authorization: Bearer <XAI_API_KEY>`。
- Gemini：
  - Google AI for Developers：`https://generativelanguage.googleapis.com/v1beta/models/...:generateContent?key=GEMINI_API_KEY`
  - Vertex AI：以 GCP 專案/位置設定；建議使用服務帳戶（不在程式碼內放金鑰）。
- Anthropic：`https://api.anthropic.com/v1/messages`；Header：`x-api-key` 與 `anthropic-version`；支援工具使用與串流。

以上端點/參數以官方文件為準，請於導入時再次確認。

---

## 10) 最小落地範例（偽代碼）

```ts
interface Provider {
  name: string
  supports: { stream: boolean; tools: boolean }
  call(input: { messages; tools?; stream?: boolean; timeoutMs?: number }): AsyncIterable<string> | Promise<string>
}

class Router {
  constructor(private providers: Provider[]) {}
  async callWithFallback(req) {
    for (const p of this.providers) {
      try { return await p.call(req) } catch (e) { continue }
    }
    throw new Error('All providers failed')
  }
}
```

---

附註：若你的組織有治理需求，請搭配 `.claude/ORG-GOVERNANCE.md`（allowlist/denylist、預設唯讀、審計）。

