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

## Accessibility

Claude Code supports assistive technologies via the `CLAUDE_CODE_ACCESSIBILITY` environment variable. Set it to `1` to enable accessibility mode:

```bash
export CLAUDE_CODE_ACCESSIBILITY=1
```

When accessibility mode is enabled:

- **Native terminal cursor stays visible** instead of being replaced by an inverted-text cursor indicator. This allows screen magnifiers (such as macOS Zoom) and screen readers to track cursor position.
- **Dialog tab focus is tracked by the native cursor.** When you navigate between tabs in permission dialogs and menus using `Left`/`Right` arrows or `Tab`/`Shift+Tab`, the native terminal cursor moves to the selected tab so assistive technologies can follow the selection.

These behaviors ensure that screen readers and screen magnifiers can reliably follow both text input and dialog navigation within Claude Code.

### Dialog tab navigation

| Action | Keys |
|--------|------|
| Next tab | `Tab` or `Right` |
| Previous tab | `Shift+Tab` or `Left` |

> **Tip:** If you use a screen reader or screen magnifier with Claude Code, set `CLAUDE_CODE_ACCESSIBILITY=1` so the native terminal cursor tracks the selected tab during dialog navigation. See the [environment variables documentation](https://code.claude.com/docs/en/env-vars) and [keybindings reference](https://code.claude.com/docs/en/keybindings) for full details.

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
