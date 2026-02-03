# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览（高层结构）
- 仓库主体是 Claude Code 的文档与插件示例，核心入口在 README.md，介绍产品、安装方式与插件目录。参见 README.md:1-58。
- `plugins/` 目录是插件集合及其结构说明，涵盖命令、代理、hooks 与技能等插件构成。参见 plugins/README.md:1-60。
- `.claude/commands/` 包含若干用于工作流的命令定义（如 commit/push/PR、去重、oncall 分流），可作为仓库内工作流参考。参见 .claude/commands/commit-push-pr.md:1-19、dedupe.md:1-23、oncall-triage.md:1-41。
- `scripts/` 中包含与 GitHub Issue 去重相关的脚本（基于 GitHub API），以 bun 运行。参见 scripts/auto-close-duplicates.ts:1-4、scripts/backfill-duplicate-comments.ts:1-5。
- `examples/settings/` 提供 Claude Code 的 settings 示例文件及说明。参见 examples/settings/README.md:1-31。

## 常用命令
- README 未提供仓库构建、lint、测试命令；也未发现 package.json / pyproject.toml / Cargo.toml / Makefile 等常规构建入口。当前仓库主要为文档、示例与脚本集合。
- 如需与 CLI 交互，README 指出运行方式为在项目目录内执行 `claude`。参见 README.md:46。
- Windows 下可用 DevContainer 启动脚本：`./Script/run_devcontainer_claude_code.ps1 -Backend docker|podman`。参见 Script/run_devcontainer_claude_code.ps1:1-19。
- Issue 去重评论脚本用法：`./scripts/comment-on-duplicates.sh --base-issue <id> --potential-duplicates <id...>`。参见 scripts/comment-on-duplicates.sh:1-4。
- 触发去重回填脚本的示例用法（需要 GITHUB_TOKEN）：`GITHUB_TOKEN=... bun run scripts/backfill-duplicate-comments.ts`。参见 scripts/backfill-duplicate-comments.ts:77-85。

## 重要文档入口
- 产品与安装说明：README.md:13-50。
- 插件体系与结构：plugins/README.md:5-60。
- Settings 示例与约束：examples/settings/README.md:1-31。

## DevContainer 相关
- 容器配置位于 `.devcontainer/`，入口是 devcontainer.json。参见 .devcontainer/devcontainer.json:1-57。
- 容器镜像构建与工具安装在 .devcontainer/Dockerfile 中（包含 Claude Code 安装）。参见 .devcontainer/Dockerfile:1-82。
- 启动后会执行网络防火墙初始化脚本 init-firewall.sh。参见 .devcontainer/devcontainer.json:55-56、.devcontainer/init-firewall.sh:1-138。

## 规则与配置
- 未发现 .cursorrules 或 .cursor/rules/ 规则文件。
- 未发现 .github/copilot-instructions.md。
