<!--
IMPORTANT: This file is a localized version of README.md. 
When updating README.md, please ensure that the corresponding changes are also applied to this file to maintain parity.
-->

# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

<p align="center">
  <a href="README.md">English</a> ·
  <strong>中文</strong>
</p>

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code 是一款运行在终端内的 AI 编程智能体 (Agentic coding tool)，它能理解你的代码库，并通过自然语言命令帮你执行日常任务、解释复杂的代码以及处理 git 工作流，从而让你写代码更快。你可以在终端或 IDE 中使用它，甚至可以在 Github 上艾特 @claude。

**了解更多信息请访问[官方文档](https://code.claude.com/docs/en/overview)**。

<img src="./demo.gif" />

## 快速开始
> [!NOTE]
> 现已弃用通过 npm 安装的方式。请使用下方推荐的安装方法之一。

获取更多安装选项、卸载步骤及故障排除信息，请参阅[设置文档](https://code.claude.com/docs/en/setup)。

1. 安装 Claude Code：

    **MacOS/Linux (推荐):**
    ```bash
    curl -fsSL https://claude.ai/install.sh | bash
    ```

    **Homebrew (MacOS/Linux):**
    ```bash
    brew install --cask claude-code
    ```

    **Windows (推荐):**
    ```powershell
    irm https://claude.ai/install.ps1 | iex
    ```

    **WinGet (Windows):**
    ```powershell
    winget install Anthropic.ClaudeCode
    ```

    **NPM (已弃用):**
    ```bash
    npm install -g @anthropic-ai/claude-code
    ```

2. 导航到您的项目目录并运行 `claude`。

## 插件 (Plugins)

此仓库包含多个 Claude Code 插件，可通过自定义命令和 Agent 来扩展其功能。请参阅[插件目录](./plugins/README.md)以获取有关可用插件的详细文档。

---

*本文档由 [@JasonYeYuhe](https://github.com/JasonYeYuhe) 翻译并维护。如果您发现任何翻译问题或需要补充内容，欢迎提交 Issue 或与我联系。*