# Claude Code (upstream fork note)

このリポジトリは元々 [anthropics/claude-code](https://github.com/anthropics/claude-code) の
fork として出発したため、上流の README 本文を参考として本ファイルに退避している。
本プロジェクトの現在の主題は **エンジニア特化型 SNS** であり、ルートの [README.md](../README.md) を参照。

---

## 元の README 内容 (2026-04 時点で退避)

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase,
and helps you code faster by executing routine tasks, explaining complex code, and handling
git workflows -- all through natural language commands.

**Learn more in the [official documentation](https://code.claude.com/docs/en/overview)**.

### Get started

Installation options (as of 2026-04):

```bash
# MacOS/Linux
curl -fsSL https://claude.ai/install.sh | bash

# Homebrew
brew install --cask claude-code

# Windows
irm https://claude.ai/install.ps1 | iex

# WinGet
winget install Anthropic.ClaudeCode

# NPM (deprecated)
npm install -g @anthropic-ai/claude-code
```

その後、プロジェクトディレクトリで `claude` を実行。

### Plugins

本 fork では上流の `plugins/` ディレクトリを残している。Claude Code の機能拡張として使いたい場合は
[plugins/README.md](../plugins/README.md) を参照。

### Reporting Bugs (上流)

Claude Code 本体のバグは `/bug` または [上流の issue](https://github.com/anthropics/claude-code/issues) へ。
本 SNS プロジェクトのバグは本リポの Issues で管理。

---

## なぜ fork のまま SNS を乗せているか

- 既に設定済みの Claude Code 環境 (plugins, hooks, MCP server 設定) を流用するのが効率的
- SNS 開発期間中の AI エージェント作業ログ・自動化スクリプトが散在しないよう、同一リポで管理
- Phase 9 以降に本番公開する段階で、必要に応じて新規リポジトリへ切り出すか検討

> 詳細は [docs/ROADMAP.md](./ROADMAP.md) と [docs/ARCHITECTURE.md](./ARCHITECTURE.md) を参照。
