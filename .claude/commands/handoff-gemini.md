---
description: 將當前任務交給 Gemini CLI（安全封裝與最小落地）
allowed-tools: Bash(gemini:*), Bash(rg:*), Bash(git diff:*), Bash(ls:*), Bash(cat:*), Bash(echo:*)
---

步驟：

1) 上下文封裝（唯讀）
- 以 `rg` 擷取必要片段與 `git diff`（若適用），存到 `.claude/interop/context/gemini-ctx-<ts>.md`。

2) 命令草案（先顯示，需一次性授權才執行）
```bash
# 建議預設：JSON 輸出 + 僅允許檔案讀取的自動編輯（不跑 Shell），並啟用沙箱
gemini \
  -m <MODEL> \
  --output-format json \
  --approval-mode auto_edit \
  --allowed-tools "read_many_files,glob" \
  -e none \
  -s \
  -p "請根據以下上下文完成任務，輸出結構化 JSON。 @.claude/interop/context/gemini-ctx-<ts>.md" \
  > .claude/interop/artifacts/gemini-<ts>.json
```
注意：
- -p 與位置參數擇一使用；不可同時使用 -p 與 -i（互動）。
- -e none 停用所有 extensions；必要時再個別允許。
- 若需允許特定 Shell，改用 `--allowed-tools "run_shell_command(npm),read_many_files,glob"` 並評估風險。

【長時任務/持續監控：stream-json 變體】
```bash
gemini \
  -m <MODEL> \
  --output-format stream-json \
  --approval-mode auto_edit \
  --allowed-tools "read_many_files,glob" \
  -e none -s \
  -p "請根據以下上下文完成任務。 @.claude/interop/context/gemini-ctx-<ts>.md" \
  | tee .claude/interop/artifacts/gemini-<ts>.jsonl \
  | jq -rc 'select(.type=="result")'
```
說明：
- 輸出逐行 JSONL 事件（含 init/message/tool_use/tool_result/error/result）。
- 以上管線示例會鏡寫到 .jsonl 並即時輸出 `type==result` 的最終事件，便於監控與後處理。

3) 正規化與審查
- 解析 `.json`；若非 JSON，採啟發式解析。
- 使用 `pr-review-toolkit` 與 `security-guidance` 檢查。

4) 最小落地
- 產生 `apply_patch` 或 PR；附回復指令；記錄於 `CLAUDE_DECISIONS.md`。
