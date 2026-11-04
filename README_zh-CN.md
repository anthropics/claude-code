# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code 是一款智能编码工具，它驻留在您的终端中，理解您的代码库，并通过执行日常任务、解释复杂代码和处理 git 工作流来帮助您更快地编码——这一切都通过自然语言指令完成。您可以在终端、IDE 中使用它，或在 Github 上标记 @claude。

**了解更多信息，请参阅[官方文档](https://docs.anthropic.com/en/docs/claude-code/overview)**。

<img src="./demo.gif" />

## 开始使用

1.  安装 Claude Code：

**MacOS/Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Homebrew (MacOS):**
```bash
brew install --cask claude-code
```

**Windows:**
```powershell
irm https://claude.ai/install.ps1 | iex
```

**NPM:**
```bash
npm install -g @anthropic-ai/claude-code
```

注意：如果通过 NPM 安装，您还需要安装 [Node.js 18+](https://nodejs.org/en/download/)

2.  导航到您的项目目录并运行 `claude`。

## 插件

此仓库包含多个 Claude Code 插件，这些插件通过自定义命令和代理来扩展功能。有关可用插件的详细文档，请参阅[插件目录](./plugins/README.md)。

## 报告 Bug

我们欢迎您的反馈。您可以直接在 Claude Code 中使用 `/bug` 命令报告问题，或者提交一个 [GitHub issue](https://github.com/anthropics/claude-code/issues)。

## 在 Discord 上交流

加入 [Claude 开发者 Discord](https://anthropic.com/discord)，与使用 Claude Code 的其他开发者交流。获取帮助、分享反馈，并与社区讨论您的项目。

## 数据收集、使用与保留

当您使用 Claude Code 时，我们会收集反馈，其中包括使用数据（例如代码接受或拒绝）、关联的对话数据以及通过 `/bug` 命令提交的用户反馈。

### 我们如何使用您的数据

请参阅我们的[数据使用政策](https://docs.anthropic.com/en/docs/claude-code/data-usage)。

### 隐私保护措施

我们已经实施了几项保护措施来保护您的数据，包括对敏感信息的有限保留期限、对用户会话数据的受限访问，以及明确禁止使用反馈进行模型训练的政策。

有关完整详情，请查看我们的[商业服务条款](https://www.anthropic.com/legal/commercial-terms)和[隐私政策](https://www.anthropic.com/legal/privacy)。