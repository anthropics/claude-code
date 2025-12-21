# Claude Code 專案深度分析報告

> 生成日期：2025-12-21
> 分析方法：10 個並行 Agent 深度探索

---

## 目錄

1. [專案概覽](#1-專案概覽)
2. [架構結構](#2-架構結構)
3. [核心功能模組](#3-核心功能模組)
4. [API 和 MCP 整合](#4-api-和-mcp-整合)
5. [測試策略](#5-測試策略)
6. [依賴管理](#6-依賴管理)
7. [安全機制](#7-安全機制)
8. [配置管理](#8-配置管理)
9. [CLI 系統](#9-cli-系統)
10. [錯誤處理和日誌](#10-錯誤處理和日誌)
11. [文檔和開發體驗](#11-文檔和開發體驗)
12. [關鍵文件索引](#12-關鍵文件索引)

---

## 1. 專案概覽

Claude Code 是 Anthropic 官方的 CLI AI 編程助手，採用**插件化架構**設計。

### 核心統計

| 指標 | 數值 |
|------|------|
| 官方插件 | 13 個 |
| 斜線命令 | 40+ |
| 專業 Agent | 15+ |
| 技能模組 | 7+ |
| Markdown 文件 | 92 個 |
| JSON 配置文件 | 20 個 |
| Python 代碼 | 1,147 行 |
| Shell 腳本 | 2,672 行 |

### 插件清單

| 插件名稱 | 功能 | 關鍵特性 |
|---------|------|---------|
| **feature-dev** | 7 階段特性開發工作流 | 3 個協調 Agent |
| **code-review** | PR 自動化代碼審查 | 4 個並行 Agent + 信心度評分 |
| **pr-review-toolkit** | 專門評審 Agent 集合 | 6 個獨立 Agent |
| **agent-sdk-dev** | Agent SDK 應用開發 | 自動化驗證 |
| **hookify** | 可配置規則鉤子系統 | 規則引擎 + 動態載入 |
| **commit-commands** | Git 工作流自動化 | commit / push / PR |
| **ralph-wiggum** | 迭代自參考循環 | Stop hook 自反饋 |
| **plugin-dev** | 插件開發工具包 | 7 個專門 Skill |
| **security-guidance** | 安全性提示鉤子 | PreToolUse 事件攔截 |
| **explanatory-output-style** | 教學性輸出風格 | 結構化 prompt |
| **learning-output-style** | 學習模式輸出 | 互動式決策點 |
| **frontend-design** | 前端設計工具 | 高質量 UI 代碼生成 |
| **claude-opus-4-5-migration** | 模型遷移指南 | Sonnet → Opus 升級 |

---

## 2. 架構結構

### 2.1 目錄結構

```
claude-code/
├── .claude/                        # 專案級配置和命令
│   ├── commands/                   # 專案特定的 slash 命令
│   │   ├── commit-push-pr.md
│   │   ├── dedupe.md
│   │   └── oncall-triage.md
│   └── settings.json
├── .claude-plugin/                 # 插件市場配置
│   └── marketplace.json
├── plugins/                        # 13 個官方插件
│   ├── agent-sdk-dev/
│   ├── code-review/
│   ├── feature-dev/
│   ├── hookify/
│   ├── plugin-dev/
│   ├── pr-review-toolkit/
│   ├── security-guidance/
│   ├── commit-commands/
│   ├── explanatory-output-style/
│   ├── learning-output-style/
│   ├── frontend-design/
│   ├── ralph-wiggum/
│   └── claude-opus-4-5-migration/
├── scripts/                        # 自動化腳本
│   ├── auto-close-duplicates.ts
│   └── backfill-duplicate-comments.ts
├── examples/                       # 參考示例
│   └── hooks/
├── .github/                        # GitHub 工作流配置
│   └── workflows/                  # 12 個 CI/CD 工作流
└── .devcontainer/                  # 開發環境配置
    ├── devcontainer.json
    └── Dockerfile
```

### 2.2 插件內部結構

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json              # 插件元數據
├── commands/                    # 斜線命令 (.md)
├── agents/                      # AI 代理定義 (.md)
├── skills/                      # 知識模塊
│   └── skill-name/
│       ├── SKILL.md
│       ├── references/
│       ├── examples/
│       └── scripts/
├── hooks/                       # 事件處理器
│   ├── hooks.json
│   └── *.py
├── .mcp.json                    # MCP 服務器配置
└── README.md
```

### 2.3 核心設計模式

1. **聲明式配置** - Markdown + YAML Frontmatter 定義行為
2. **自動發現** - 標準目錄結構自動加載組件
3. **分層設計** - 配置層 → 組件層 → 實現層
4. **事件驅動** - Hook 系統響應系統事件
5. **能力分級** - 根據任務複雜度選擇 AI 模型

---

## 3. 核心功能模組

### 3.1 Tool 系統

**工具授權機制（Frontmatter）：**
```yaml
---
allowed-tools: Read, Grep, Bash(git:*, npm:*)
model: sonnet
---
```

**可用工具列表：**
- 基礎：`Bash`, `Edit`, `Write`, `Glob`, `Grep`, `Read`, `LS`
- 高級：`TodoWrite`, `WebFetch`, `WebSearch`, `NotebookRead`
- MCP：`mcp__plugin_<name>_<server>__<tool>`

### 3.2 Agent 系統

**Agent 定義格式：**
```markdown
---
name: code-reviewer
description: Use this agent for code review requests
model: sonnet
color: blue
tools: ["Read", "Grep"]
---

You are an expert code reviewer...
```

**模型選擇：**
- `haiku` - 快速、輕量（簡單任務）
- `sonnet` - 平衡性能（推薦默認）
- `opus` - 最大能力（複雜任務）

**關鍵 Agent：**
- `code-explorer` - 代碼深度分析（黃色）
- `code-architect` - 架構設計（綠色）
- `code-reviewer` - 代碼審查（紅色）

### 3.3 Hook 系統

**支持的事件：**

| 事件 | 觸發時機 | 用途 |
|------|---------|------|
| `PreToolUse` | 工具執行前 | 驗證、權限檢查 |
| `PostToolUse` | 工具執行後 | 結果處理、日誌 |
| `Stop` | 停止前 | 完成檢查 |
| `SubagentStop` | 子代理停止前 | 子代理驗證 |
| `SessionStart` | 會話開始 | 加載上下文 |
| `SessionEnd` | 會話結束 | 清理資源 |
| `UserPromptSubmit` | 用戶提交提示 | 輸入驗證 |
| `PreCompact` | 上下文壓縮前 | 敏感信息處理 |
| `Notification` | 發送通知時 | 記錄監控 |

**Hook 配置格式（hooks.json）：**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/validate.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

**Exit 碼語義：**
- `0` - 成功/允許
- `2` - 阻塞（stderr 回饋給 Claude）
- 其他 - 非阻塞錯誤

### 3.4 Skill 系統

**漸進式披露設計：**
1. 元數據（名稱 + 描述）- ~100 字，始終在上下文中
2. SKILL.md 正文 - <5k 字，觸發時加載
3. 綁定資源 - 無限制，根據需要加載

**技能目錄結構：**
```
skill-name/
├── SKILL.md              # 核心文檔
├── references/           # 詳細指南
├── examples/             # 工作示例
└── scripts/              # 驗證工具
```

---

## 4. API 和 MCP 整合

### 4.1 MCP 服務器類型

| 類型 | 用途 | 配置示例 |
|------|------|---------|
| **stdio** | 本地進程 | `"command": "npx", "args": ["-y", "@mcp/server"]` |
| **SSE** | 雲服務 | `"type": "sse", "url": "https://mcp.asana.com/sse"` |
| **HTTP** | REST API | `"type": "http", "url": "https://api.example.com/mcp"` |
| **WebSocket** | 實時連接 | `"type": "ws", "url": "wss://mcp.example.com/ws"` |

### 4.2 MCP 配置示例

**.mcp.json：**
```json
{
  "github": {
    "command": "docker",
    "args": ["run", "-i", "--rm", "ghcr.io/github/github-mcp-server"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_TOKEN}"
    }
  }
}
```

### 4.3 認證機制

- **OAuth 2.0** - 自動處理，令牌安全存儲
- **Bearer Token** - `"Authorization": "Bearer ${API_TOKEN}"`
- **API Key** - `"X-API-Key": "${API_KEY}"`

### 4.4 環境變量

| 變量 | 說明 |
|------|------|
| `${CLAUDE_PLUGIN_ROOT}` | 插件目錄（可移植性） |
| `${CLAUDE_PROJECT_DIR}` | 專案目錄 |
| `${env:VAR_NAME}` | 環境變量引用 |

---

## 5. 測試策略

### 5.1 測試工具

| 工具 | 位置 | 功能 |
|------|------|------|
| `test-hook.sh` | `plugin-dev/skills/hook-development/scripts/` | Hook 單元測試 |
| `validate-hook-schema.sh` | 同上 | Hook 配置驗證 |
| `hook-linter.sh` | 同上 | 代碼品質檢查 |
| `validate-agent.sh` | `plugin-dev/skills/agent-development/scripts/` | Agent 結構驗證 |

### 5.2 測試層次

```
E2E 測試 (GitHub Actions)     ← 11 個 workflows
    ↓
整合測試 (Plugin Integration)  ← Hook + Agent 互動
    ↓
單元測試 (Component Testing)   ← Script 驗證
```

### 5.3 Hook 測試流程

```bash
# 創建測試輸入
./test-hook.sh --create-sample PreToolUse > test-input.json

# 執行測試
./test-hook.sh -v my-hook.sh test-input.json

# 驗證配置
./validate-hook-schema.sh ./hooks.json

# 代碼檢查
./hook-linter.sh ./my-hook.sh
```

### 5.4 GitHub Actions 工作流

| 工作流 | 觸發器 | 功能 |
|-------|-------|------|
| `claude.yml` | Issue/PR comments | Claude Code Agent 執行 |
| `oncall-triage.yml` | 定時(6h) | 關鍵問題標記 |
| `claude-dedupe-issues.yml` | 定時 | 重複問題檢測 |
| `auto-close-duplicates.yml` | 自動 | 關閉重複項 |
| `stale-issue-manager.yml` | 定時 | 陳舊問題管理 |

---

## 6. 依賴管理

### 6.1 核心依賴

| 依賴 | 版本 | 用途 |
|------|------|------|
| Node.js | 20 | 運行時 |
| Python | 3.7+ | Hook 和規則引擎 |
| @anthropic-ai/claude-code | latest | CLI 工具 |
| git-delta | 0.18.2 | Git diff 視覺化 |
| zsh-in-docker | 1.2.0 | Shell 配置 |

### 6.2 Python 標準庫依賴

```python
import re           # 正則表達式
import sys          # 系統 I/O
import json         # JSON 解析
import os           # 環境變量
import glob         # 文件匹配
from functools import lru_cache  # 性能優化
from dataclasses import dataclass  # 數據類
from typing import List, Dict, Any, Optional  # 類型提示
```

**特點：零外部 Python 依賴**

### 6.3 開發環境（devcontainer）

```json
{
  "containerEnv": {
    "NODE_OPTIONS": "--max-old-space-size=4096",
    "CLAUDE_CONFIG_DIR": "/home/node/.claude"
  },
  "extensions": [
    "anthropic.claude-code",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "eamodio.gitlens"
  ]
}
```

---

## 7. 安全機制

### 7.1 認證管理

- OAuth 令牌自動刷新
- 令牌靜態加密存儲
- 環境變量傳遞敏感信息
- 禁止硬編碼令牌

### 7.2 PreToolUse 驗證

**文件寫入驗證示例：**
```bash
# 檢查路徑遍歷
if [[ "$file_path" == *".."* ]]; then
  echo '{"permissionDecision": "deny"}' >&2
  exit 2
fi

# 檢查系統目錄
if [[ "$file_path" == /etc/* ]]; then
  echo '{"permissionDecision": "deny"}' >&2
  exit 2
fi

# 檢查敏感文件
if [[ "$file_path" == *.env ]]; then
  echo '{"permissionDecision": "ask"}' >&2
  exit 2
fi
```

### 7.3 安全提醒系統

**檢測的危險模式：**
- `child_process.exec()` - 命令注入
- `eval()` / `new Function()` - 代碼注入
- `dangerouslySetInnerHTML` - XSS
- `pickle` - 反序列化攻擊
- GitHub Actions workflow 注入

### 7.4 Hookify 規則配置

```markdown
---
name: block-dangerous-rm
enabled: true
event: bash
pattern: rm\s+-rf
action: block
---

⚠️ Dangerous rm command detected!
```

**條件操作符：**
- `regex_match` - 正則匹配
- `contains` - 包含字符串
- `equals` - 精確匹配
- `not_contains` - 不包含
- `starts_with` / `ends_with` - 開頭/結尾匹配

---

## 8. 配置管理

### 8.1 配置優先級

```
1. 專案級配置 (.claude/*.local.md)  ← 最高
2. 專案級命令 (.claude/commands/)
3. 插件配置 (plugin.json)
4. 全局用戶命令 (~/.claude/commands/)
5. 全局配置 (~/.claude/)
6. 插件默認值                        ← 最低
```

### 8.2 配置文件格式

**插件設置（.claude/plugin-name.local.md）：**
```markdown
---
enabled: true
strict_mode: false
max_file_size: 1000000
allowed_extensions: [".js", ".ts"]
---

# 配置說明
專案特定的配置項...
```

### 8.3 環境變量

| 變量 | 用途 |
|------|------|
| `CLAUDE_CONFIG_DIR` | 全局配置目錄 |
| `CLAUDE_PLUGIN_ROOT` | 插件根目錄 |
| `CLAUDE_PROJECT_DIR` | 專案目錄 |
| `CLAUDE_ENV_FILE` | 持久化環境變量 |

---

## 9. CLI 系統

### 9.1 命令定義格式

```markdown
---
description: Deploy to environment
argument-hint: [environment] [version]
allowed-tools: Bash(kubectl:*), Read
model: sonnet
---

Deploy to $1 environment with version $2

Configuration: @config/$1.json
Status: !`kubectl cluster-info`
```

### 9.2 參數傳遞

| 語法 | 功能 |
|------|------|
| `$1`, `$2` | 位置參數 |
| `$ARGUMENTS` | 原始參數字符串 |
| `@file-path` | 文件內容插入 |
| `@$1` | 參數文件引用 |
| `` !`cmd` `` | 執行 Bash 命令 |
| `${CLAUDE_PLUGIN_ROOT}` | 插件路徑 |

### 9.3 命令類型

| 類型 | 位置 | 標記 |
|------|------|------|
| 專案級 | `.claude/commands/` | `(project)` |
| 用戶級 | `~/.claude/commands/` | `(user)` |
| 插件級 | `plugin/commands/` | `(plugin-name)` |

### 9.4 交互式 UI（AskUserQuestion）

```json
{
  "questions": [{
    "question": "Which database?",
    "header": "Database",
    "multiSelect": false,
    "options": [
      {"label": "PostgreSQL", "description": "Relational, ACID"},
      {"label": "MongoDB", "description": "Document store"}
    ]
  }]
}
```

---

## 10. 錯誤處理和日誌

### 10.1 日誌級別

| 前綴 | 用途 |
|------|------|
| `[DEBUG]` | 詳細診斷信息 |
| `[INFO]` | 重要操作開始 |
| `[SUCCESS]` | 操作完成 |
| `[ERROR]` | 操作失敗 |
| `[WARNING]` | 潛在問題 |

### 10.2 調試工具

```bash
# 啟用調試模式
claude --debug

# 查看調試日誌
tail -f ~/.claude/debug-logs/latest
```

### 10.3 遙測系統

**供應商：** Statsig

**事件類型：**
- `github_issue_created`
- `github_duplicate_comment_added`

### 10.4 錯誤處理模式

```typescript
try {
  await operation();
  console.log("[SUCCESS] Operation completed");
} catch (error) {
  console.error(`[ERROR] Operation failed: ${error}`);
}
```

---

## 11. 文檔和開發體驗

### 11.1 文檔結構

- `README.md` - 專案概述
- `CHANGELOG.md` - 變更日誌（74+ 版本）
- `SECURITY.md` - 安全政策
- `plugins/README.md` - 插件系統指南
- 每個插件都有完整的 `README.md`

### 11.2 代碼註解風格

**TypeScript：**
```typescript
// Try to match #123 format first
let match = commentBody.match(/#(\d+)/);

// Try to match GitHub issue URL format
match = commentBody.match(/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/);
```

**Shell：**
```bash
#!/bin/bash
# Example PreToolUse hook for validating Bash commands
set -euo pipefail  # 安全的 shell 設定
```

### 11.3 TypeScript 類型定義

```typescript
interface GitHubIssue {
  number: number;
  title: string;
  user: { id: number };
  created_at: string;
}

async function githubRequest<T>(
  endpoint: string,
  token: string,
  method: string = 'GET'
): Promise<T> { ... }
```

---

## 12. 關鍵文件索引

### 12.1 核心配置

| 文件 | 用途 |
|------|------|
| `.claude-plugin/marketplace.json` | 插件市場清單 |
| `plugins/*/.claude-plugin/plugin.json` | 插件元數據 |
| `plugins/*/hooks/hooks.json` | Hook 配置 |
| `.devcontainer/devcontainer.json` | 開發環境 |

### 12.2 核心實現

| 文件 | 功能 | 行數 |
|------|------|------|
| `plugins/hookify/core/rule_engine.py` | 規則評估引擎 | ~314 |
| `plugins/hookify/core/config_loader.py` | 配置加載器 | ~298 |
| `plugins/hookify/hooks/pretooluse.py` | PreToolUse Hook | ~75 |
| `plugins/security-guidance/hooks/security_reminder_hook.py` | 安全提醒 | ~281 |
| `scripts/auto-close-duplicates.ts` | 重複問題處理 | ~270 |

### 12.3 命令和 Agent

| 類型 | 位置 |
|------|------|
| 專案命令 | `.claude/commands/*.md` |
| Feature Dev Agent | `plugins/feature-dev/agents/*.md` |
| Code Review Agent | `plugins/code-review/commands/code-review.md` |
| PR Review Toolkit | `plugins/pr-review-toolkit/agents/*.md` |

### 12.4 技能文檔

| 技能 | 位置 |
|------|------|
| Hook 開發 | `plugins/plugin-dev/skills/hook-development/` |
| MCP 整合 | `plugins/plugin-dev/skills/mcp-integration/` |
| 命令開發 | `plugins/plugin-dev/skills/command-development/` |
| Agent 開發 | `plugins/plugin-dev/skills/agent-development/` |
| 插件結構 | `plugins/plugin-dev/skills/plugin-structure/` |

### 12.5 工作流

| 工作流 | 功能 |
|-------|------|
| `.github/workflows/claude.yml` | Claude Agent 執行 |
| `.github/workflows/oncall-triage.yml` | 問題分類 |
| `.github/workflows/auto-close-duplicates.yml` | 關閉重複 |
| `.github/workflows/stale-issue-manager.yml` | 陳舊管理 |

---

## 附錄：Issue 處理快速參考

### A. 修復 Bug 的常見位置

| Bug 類型 | 查看位置 |
|---------|---------|
| Hook 問題 | `plugins/*/hooks/` |
| 命令問題 | `.claude/commands/` 或 `plugins/*/commands/` |
| Agent 問題 | `plugins/*/agents/` |
| 配置問題 | `plugin.json` 或 `hooks.json` |
| 腳本問題 | `scripts/` 或 `plugins/*/skills/*/scripts/` |

### B. 常用驗證命令

```bash
# 驗證 Hook 配置
./plugins/plugin-dev/skills/hook-development/scripts/validate-hook-schema.sh hooks.json

# 測試 Hook
./plugins/plugin-dev/skills/hook-development/scripts/test-hook.sh -v hook.sh input.json

# 驗證 Agent
./plugins/plugin-dev/skills/agent-development/scripts/validate-agent.sh agent.md

# 檢查代碼品質
./plugins/plugin-dev/skills/hook-development/scripts/hook-linter.sh hook.sh
```

### C. 調試技巧

```bash
# 啟用調試模式
claude --debug

# 查看日誌
tail -f ~/.claude/debug-logs/latest

# 檢查 Hook 輸出
echo '{"tool_name": "Bash", "tool_input": {"command": "ls"}}' | python3 hook.py
```

---

*此分析報告由 10 個並行 Agent 生成，涵蓋了 Claude Code 專案的所有主要方面。*
