# Claude Code

![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm version](https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square)](https://www.npmjs.com/package/@anthropic-ai/claude-code)

Claude Code is a coding agent that runs in your terminal. It reads your codebase and helps you move faster — executing tasks, explaining code, and handling git workflows through natural language. Works in your terminal, IDE, or directly on GitHub via `@claude`.

**[Official documentation](https://code.claude.com/docs/en/overview)**

<img src="./demo.gif" />

## Get Started

> [!NOTE]
> Installation via npm is deprecated. Use one of the recommended methods below.

For more installation options, uninstall steps, and troubleshooting, see the [setup documentation](https://code.claude.com/docs/en/setup).

**macOS / Linux**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```
```bash
brew install --cask claude-code
```

**Windows**
```powershell
irm https://claude.ai/install.ps1 | iex
```
```powershell
winget install Anthropic.ClaudeCode
```

**npm (deprecated)**
```bash
npm install -g @anthropic-ai/claude-code
```

Then navigate to your project directory and run `claude`.

## Plugins

This repository includes plugins that extend Claude Code with custom commands and agents. See the [plugins directory](./plugins/README.md) for documentation.

## Reporting Bugs

Use the `/bug` command inside Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to get help, share feedback, and connect with other developers using Claude Code.

## Data Collection, Usage, and Retention

When you use Claude Code, we collect usage data (such as code acceptance or rejections), associated conversation data, and feedback submitted via the `/bug` command.

### How We Use Your Data

See our [data usage policies](https://code.claude.com/docs/en/data-usage).

### Privacy Safeguards

We limit retention periods for sensitive information, restrict access to user session data, and do not use feedback for model training.

For full details, see our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
