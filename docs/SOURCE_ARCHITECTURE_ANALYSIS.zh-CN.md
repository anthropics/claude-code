**[English](SOURCE_ARCHITECTURE_ANALYSIS.md)** | **[中文](SOURCE_ARCHITECTURE_ANALYSIS.zh-CN.md)**

# Claude Code 源码架构分析

> 基于公开源码的社区贡献分析。

---

## 项目概述

Claude Code 是 Anthropic 官方的 CLI 工具，一个功能丰富的终端交互式应用。

### 核心能力
- **交互式 REPL** — 在终端中与 Claude 对话编程
- **40+ 工具** — 文件操作、Shell 执行、Web 搜索、MCP 集成等
- **100+ 斜杠命令** — `/commit`、`/review`、`/security-review`
- **任务系统** — 子智能体编排，并行处理复杂工作
- **MCP 集成** — Model Context Protocol 可扩展服务端工具
- **插件 & 技能系统** — 用户自定义扩展

## 技术栈

| 层级 | 技术 |
|------|------|
| 语言 | TypeScript |
| 运行时 | Bun |
| UI 框架 | React + Ink |
| API | @anthropic-ai/sdk |
| 状态管理 | Zustand 风格 Store + React Context |

## 核心架构

### QueryEngine — 对话循环引擎

```
用户输入 → 上下文组装 → API 调用 → 工具请求 → 执行 → 反馈 → ... → 响应
```

### 工具系统 (40+ 工具)
文件操作、Shell、搜索、Web、MCP、笔记本、代理

### 权限模型
三层：自动批准 | 用户确认 | 始终拒绝

### 记忆系统 (memdir/)
跨会话持久化，记忆老化，团队共享

### 内部模型代号
- **Capybara** → Claude 4.6
- **Fennec** → Opus 4.6  
- **Numbat** → 未发布

## 文件统计
- ~1,900 TypeScript 文件
- ~512,000 行代码
- 120+ 组件, 80+ Hooks, 40+ 工具

完整英文分析: [SOURCE_ARCHITECTURE_ANALYSIS.md](SOURCE_ARCHITECTURE_ANALYSIS.md)

*声明：非官方社区分析。Claude Code 归 Anthropic 所有。*
