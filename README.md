# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more in the [official documentation](https://code.claude.com/docs/en/overview)**.

<img src="./demo.gif" />

## Get started
> [!NOTE]
> Installation via npm is deprecated. Use one of the recommended methods below.

For more installation options, uninstall steps, and troubleshooting, see the [setup documentation](https://code.claude.com/docs/en/setup).

1. Install Claude Code:

    **MacOS/Linux (Recommended):**
    ```bash
    curl -fsSL https://claude.ai/install.sh | bash
    ```

    **Homebrew (MacOS/Linux):**
    ```bash
    brew install --cask claude-code
    ```

    **Windows (Recommended):**
    ```powershell
    irm https://claude.ai/install.ps1 | iex
    ```

    **WinGet (Windows):**
    ```powershell
    winget install Anthropic.ClaudeCode
    ```

    **NPM (Deprecated):**
    ```bash
    npm install -g @anthropic-ai/claude-code
    ```

2. Navigate to your project directory and run `claude`.

## Configuration

Claude Code uses several configuration files, each serving a distinct purpose. The two most commonly encountered are:

| File | Purpose | Editing |
|------|---------|---------|
| `~/.claude.json` | **Application state** — OAuth tokens, MCP server registrations (local/user scope), theme, notifications, per-project state, and caches | Managed by Claude Code. Avoid manual edits. |
| `~/.claude/settings.json` | **User settings** — permissions, model selection, language, hooks, environment variables, and plugin configuration | User-editable. This is where your preferences go. |

**Why two files?** `~/.claude.json` is a runtime state file that Claude Code reads and writes automatically (session tokens, caches, MCP server registrations added via `claude mcp add`). `~/.claude/settings.json` is your configuration file — settings you consciously choose and can safely edit by hand. Separating state from configuration keeps the user-editable file clean and predictable.

Beyond these two, Claude Code supports a full hierarchy of settings and memory files:

| File | Scope | Purpose |
|------|-------|---------|
| `~/.claude/settings.json` | User | Personal settings across all projects |
| `.claude/settings.json` | Project | Team-shared settings (committed to git) |
| `.claude/settings.local.json` | Local | Personal project overrides (git-ignored) |
| `.mcp.json` | Project | Project-scoped MCP servers (committed to git) |
| `CLAUDE.md` / `.claude/CLAUDE.md` | Project | Team-shared memory and instructions |
| `~/.claude/CLAUDE.md` | User | Personal memory across all projects |
| `CLAUDE.local.md` | Local | Personal project memory (git-ignored) |

Settings follow a precedence order: **Managed** (IT-deployed) > **Command line** > **Local** > **Project** > **User**. More specific scopes override less specific ones.

For full details, see the [settings documentation](https://code.claude.com/docs/en/settings) and [memory documentation](https://code.claude.com/docs/en/memory).

## Plugins

This repository includes several Claude Code plugins that extend functionality with custom commands and agents. See the [plugins directory](./plugins/README.md) for detailed documentation on available plugins.

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Connect on Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to connect with other developers using Claude Code. Get help, share feedback, and discuss your projects with the community.

## Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

See our [data usage policies](https://code.claude.com/docs/en/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
