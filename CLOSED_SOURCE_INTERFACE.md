# Claude Code 閉源接口分析報告

> 生成日期：2025-12-31
> 分析方法：多層次接口探索

---

## 目錄

1. [概述](#1-概述)
2. [插件載入接口](#2-插件載入接口)
3. [Hook 系統協議](#3-hook-系統協議)
4. [MCP 服務器協議](#4-mcp-服務器協議)
5. [Markdown Frontmatter 解析](#5-markdown-frontmatter-解析)
6. [環境變量注入](#6-環境變量注入)
7. [NPM 包依賴](#7-npm-包依賴)
8. [架構圖](#8-架構圖)
9. [通信協議詳解](#9-通信協議詳解)

---

## 1. 概述

Claude Code 專案採用**開源插件 + 閉源核心**的架構設計。本文件詳細記錄了開源插件與閉源核心之間的所有接口點。

### 架構分層

```
┌─────────────────────────────────────────┐
│  @anthropic-ai/claude-code (閉源核心)    │
│  ┌─────────────────────────────────────┐│
│  │ Plugin Loader                       ││
│  │ Hook Dispatcher (stdin/stdout)      ││
│  │ MCP Manager                         ││
│  │ Frontmatter Parser                  ││
│  │ Environment Injector                ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
              ↓ ↑ JSON 協議
┌─────────────────────────────────────────┐
│  本 Repo (開源插件生態系統)              │
│  - plugins/*/hooks/*.py                 │
│  - plugins/*/agents/*.md                │
│  - plugins/*/skills/*/SKILL.md          │
│  - .claude/commands/*.md                │
└─────────────────────────────────────────┘
```

---

## 2. 插件載入接口

### 2.1 Schema 驗證端點

```
.claude-plugin/marketplace.json
  ↓ schema 驗證
https://anthropic.com/claude-code/marketplace.schema.json  ← 閉源端
```

### 2.2 Marketplace 配置格式

**文件位置：** `.claude-plugin/marketplace.json`

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "claude-code-plugins",
  "version": "1.0.0",
  "plugins": [
    {
      "name": "hookify",
      "version": "0.1.0",
      "source": "./plugins/hookify",
      "category": "productivity"
    }
  ]
}
```

### 2.3 Plugin Manifest 格式

**文件位置：** `plugins/*/.claude-plugin/plugin.json`

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": {
    "name": "Author Name",
    "email": "author@example.com"
  }
}
```

### 2.4 自動發現機制

閉源核心會自動掃描以下目錄結構：

```
plugin-name/
├── .claude-plugin/plugin.json    # 元數據（必需）
├── commands/*.md                 # 斜線命令
├── agents/*.md                   # AI 代理
├── skills/*/SKILL.md             # 技能模塊
├── hooks/hooks.json              # Hook 配置
└── .mcp.json                     # MCP 服務器
```

---

## 3. Hook 系統協議

### 3.1 支援的事件類型

| 事件 | 觸發時機 | 主要用途 |
|------|---------|---------|
| `PreToolUse` | 工具執行前 | 驗證、權限檢查、攔截 |
| `PostToolUse` | 工具執行後 | 結果處理、日誌記錄 |
| `Stop` | Agent 停止前 | 完成度檢查 |
| `SubagentStop` | 子代理停止前 | 子代理驗證 |
| `SessionStart` | 會話開始 | 加載上下文 |
| `SessionEnd` | 會話結束 | 清理資源 |
| `UserPromptSubmit` | 用戶提交提示 | 輸入驗證 |
| `PreCompact` | 上下文壓縮前 | 敏感信息處理 |
| `Notification` | 發送通知時 | 監控記錄 |

### 3.2 Hook 配置格式

**文件位置：** `plugins/*/hooks/hooks.json`

```json
{
  "description": "Hook description",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/pretooluse.py",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 3.3 stdin/stdout 通信協議

#### 輸入格式（stdin）

閉源核心發送 JSON 到 Hook 腳本的 stdin：

```json
{
  "hook_event_name": "PreToolUse",
  "session_id": "abc-123",
  "cwd": "/project/root",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.py",
    "old_string": "original",
    "new_string": "modified"
  },
  "transcript_path": "/tmp/transcript.txt"
}
```

#### 輸出格式（stdout）

Hook 腳本輸出 JSON 到 stdout：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask",
    "updatedInput": {}
  },
  "systemMessage": "警告或錯誤信息"
}
```

### 3.4 退出碼語義

| 退出碼 | 含義 | 行為 |
|--------|------|------|
| `0` | 成功/允許 | 操作繼續 |
| `2` | 阻塞 | stderr 回饋給 Claude |
| 其他 | 非阻塞錯誤 | 記錄錯誤但繼續 |

### 3.5 完整通信流程

```
閉源核心                              Hook 腳本
   │                                      │
   ├──── PreToolUse 事件觸發 ─────────────►│
   │     (stdin: JSON)                    │
   │                                      │
   │                                      ├─► 解析 JSON
   │                                      ├─► 評估規則
   │                                      ├─► 生成決策
   │                                      │
   │◄──── JSON 輸出 ──────────────────────┤
   │      (stdout)                        │
   │                                      │
   ├──── 讀取 exit code ──────────────────┤
   │                                      │
   ├─► 根據決策執行或阻止工具
   │
```

---

## 4. MCP 服務器協議

### 4.1 配置格式

**文件位置：** `plugins/*/.mcp.json`

```json
{
  "server-name": {
    "command": "npx",
    "args": ["-y", "@mcp/server"],
    "env": {
      "API_KEY": "${env:API_KEY}"
    }
  }
}
```

### 4.2 服務器類型

| 類型 | 傳輸方式 | 配置示例 |
|------|---------|---------|
| **stdio** | 本地進程 | `"command": "npx", "args": [...]` |
| **SSE** | Server-Sent Events | `"type": "sse", "url": "https://..."` |
| **HTTP** | REST API | `"type": "http", "url": "https://..."` |
| **WebSocket** | 雙向實時 | `"type": "ws", "url": "wss://..."` |

### 4.3 工具命名約定

MCP 工具在系統中的命名格式：

```
mcp__plugin_<plugin-name>_<server-name>__<tool-name>

示例：
mcp__plugin_asana_asana__asana_create_task
mcp__plugin_myplug_database__query
```

### 4.4 認證機制

| 方式 | 配置 | 用途 |
|------|------|------|
| **OAuth 2.0** | 自動處理 | SSE 服務（如 Asana） |
| **Bearer Token** | `headers.Authorization` | HTTP/WebSocket |
| **API Key** | `headers.X-API-Key` | 自定義服務 |
| **環境變量** | `env` 字段 | stdio 服務器 |

---

## 5. Markdown Frontmatter 解析

### 5.1 命令格式

**文件位置：** `.claude/commands/*.md` 或 `plugins/*/commands/*.md`

```yaml
---
description: 命令描述
argument-hint: [arg1] [arg2]
allowed-tools: Read, Bash(git:*), Write
model: sonnet
---

命令提示內容...
```

### 5.2 Agent 格式

**文件位置：** `plugins/*/agents/*.md`

```yaml
---
name: agent-name
description: |
  Use this agent when...
  <example>
    context: ...
    user: "..."
    assistant: "..."
  </example>
model: sonnet|opus|haiku|inherit
color: blue|yellow|green|red|magenta|cyan
tools: ["Read", "Grep", "Bash"]
---

Agent 系統提示...
```

### 5.3 Skill 格式

**文件位置：** `plugins/*/skills/*/SKILL.md`

```yaml
---
name: skill-name
description: 此 skill 用於...
version: 1.0.0
---

# Skill 指導內容

程序化指導和參考資料...
```

### 5.4 關鍵 Frontmatter 字段

| 字段 | 適用於 | 說明 |
|------|--------|------|
| `name` | Agent, Skill | 唯一標識符 |
| `description` | 所有 | 觸發條件和用途 |
| `model` | Command, Agent | AI 模型選擇 |
| `allowed-tools` | Command | 工具白名單 |
| `tools` | Agent | 可用工具列表 |
| `color` | Agent | UI 顯示顏色 |

---

## 6. 環境變量注入

### 6.1 系統變量

閉源核心注入以下變量供插件使用：

| 變量 | 說明 | 示例值 |
|------|------|--------|
| `CLAUDE_PLUGIN_ROOT` | 插件根目錄 | `/path/to/plugin` |
| `CLAUDE_PROJECT_DIR` | 專案目錄 | `/path/to/project` |
| `CLAUDE_CONFIG_DIR` | 配置目錄 | `~/.claude` |
| `CLAUDE_ENV_FILE` | 環境文件 | `.env` |
| `CLAUDE_SESSION_ID` | 會話 ID | `abc-123` |

### 6.2 在配置中使用

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/run.sh",
  "env": {
    "PROJECT": "${CLAUDE_PROJECT_DIR}",
    "API_KEY": "${env:MY_API_KEY}"
  }
}
```

### 6.3 其他控制變量

| 變量 | 說明 |
|------|------|
| `CLAUDE_CODE_SHELL` | Shell 選擇覆蓋 |
| `CLAUDE_BASH_NO_LOGIN` | 跳過登錄 Shell |
| `CLAUDE_CODE_AUTO_CONNECT_IDE` | IDE 自動連接 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 禁用非必要流量 |

---

## 7. NPM 包依賴

### 7.1 閉源核心包

```bash
npm install -g @anthropic-ai/claude-code
```

這是閉源的 CLI 核心，本 repo 是其插件生態系統。

### 7.2 相關包

| 包名 | 用途 |
|------|------|
| `@anthropic-ai/claude-code` | 主 CLI 工具 |
| `@anthropic-ai/claude-agent-sdk` | Agent SDK |
| `@modelcontextprotocol/*` | MCP 服務器 |

### 7.3 官方文檔

- https://docs.claude.com/en/docs/claude-code/overview
- https://docs.anthropic.com/en/docs/claude-code/hooks
- https://docs.anthropic.com/en/docs/claude-code/mcp

---

## 8. 架構圖

### 8.1 多層通信架構

```
┌────────────────────────────────────────────────────────────────────┐
│                    Claude Code CLI（閉源）                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Layer 1: Plugin Discovery                                        │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 掃描 marketplace.json → 加載 plugin.json → 註冊組件         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Layer 2: Hook System                                              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 事件觸發 → stdin JSON → Hook 腳本 → stdout JSON → 決策      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Layer 3: MCP Manager                                              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 加載 .mcp.json → 啟動服務器 → 工具發現 → 工具調用           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Layer 4: Frontmatter Parser                                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 解析 *.md → 提取 YAML → 構建 Command/Agent/Skill 對象       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Layer 5: Environment Manager                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 注入 CLAUDE_* 變量 → 展開 ${} 引用 → 傳遞給子進程           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 8.2 數據流圖

```
用戶輸入
    │
    ▼
┌─────────────────┐
│ UserPromptSubmit│ ← Hook 攔截點
│     Hook        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 命令/Agent 路由 │ ← Frontmatter 解析
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PreToolUse     │ ← Hook 攔截點
│     Hook        │
└────────┬────────┘
         │
    ┌────┴────┐
    │ 決策    │
    ├─────────┤
    │ Allow   │──► 工具執行 ──► PostToolUse Hook
    │ Deny    │──► 阻止操作
    │ Ask     │──► 請求用戶確認
    └─────────┘
         │
         ▼
┌─────────────────┐
│     Stop        │ ← Hook 攔截點（可阻止退出）
│     Hook        │
└─────────────────┘
```

---

## 9. 通信協議詳解

### 9.1 Hook 協議規範

#### PreToolUse 事件

**輸入：**
```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash|Edit|Write|...",
  "tool_input": {
    "command": "...",
    "file_path": "...",
    "content": "..."
  }
}
```

**輸出：**
```json
{
  "hookSpecificOutput": {
    "permissionDecision": "allow|deny|ask"
  },
  "systemMessage": "可選的消息"
}
```

#### Stop 事件

**輸入：**
```json
{
  "hook_event_name": "Stop",
  "reason": "Task completed",
  "transcript_path": "/path/to/transcript.txt"
}
```

**輸出：**
```json
{
  "decision": "block",
  "reason": "Tests not executed",
  "systemMessage": "必須運行測試"
}
```

### 9.2 MCP 協議規範

#### stdio 服務器啟動

```
核心執行：spawn(command, args, { env })
  │
  ├─► 進程啟動
  │
  ├─► JSON-RPC over stdin/stdout
  │
  └─► 工具調用和結果
```

#### SSE 服務器連接

```
核心執行：HTTP GET (url)
  │
  ├─► SSE 連接建立
  │
  ├─► OAuth 自動處理（如需要）
  │
  └─► 事件流接收
```

### 9.3 配置優先級

```
1. 專案級配置 (.claude/*.local.md)     ← 最高
2. 專案級命令 (.claude/commands/)
3. 插件配置 (plugin.json)
4. 全局用戶命令 (~/.claude/commands/)
5. 全局配置 (~/.claude/)
6. 插件默認值                          ← 最低
```

---

## 總結

本 repo 是 Claude Code 的**插件生態系統**，與閉源核心的連接主要透過：

1. **JSON 配置文件** — 聲明式定義插件結構和能力
2. **stdin/stdout 協議** — Hook 系統的運行時通信
3. **Markdown Frontmatter** — 命令、Agent、Skill 的元數據
4. **環境變量** — 路徑和配置的動態注入
5. **MCP 協議** — 外部服務的標準化集成

所有核心邏輯（CLI、AI 模型調用、工具執行引擎）都在閉源的 `@anthropic-ai/claude-code` npm 包中。

---

*此文件由深度分析生成，記錄了 Claude Code 開源插件與閉源核心之間的所有接口點。*
