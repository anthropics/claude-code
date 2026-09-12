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

## Plugins

This repository includes several Claude Code plugins that extend functionality with custom commands and agents. See the [plugins directory](./plugins/README.md) for detailed documentation on available plugins.

### Warp marketplace plugin setup and verification

To enable Warp terminal integration via marketplace:

1. Add the marketplace:
   ```bash
   claude plugin marketplace add warpdotdev/claude-code-warp
   ```
2. Install and enable the plugin:
   ```bash
   claude plugin install warp@claude-code-warp
   ```
3. Verify plugin and marketplace state:
   ```bash
   claude plugin list
   claude plugin marketplace list
   claude plugin marketplace update claude-code-warp
   ```
4. Install `jq` (required by the Warp notification hooks):
   ```powershell
   winget install --id jqlang.jq --exact --source winget --accept-source-agreements --accept-package-agreements
   ```
5. Verify `jq` is available:
   ```powershell
   jq --version
   ```
6. Run a live Claude session test:
   - Start `claude`
   - Send a simple prompt such as `reply OK`
   - Confirm there is no `Warp notifications require jq` warning on startup

Expected outcome:
- `warp@claude-code-warp` appears as enabled in `claude plugin list`
- Marketplace commands succeed
- `jq --version` returns a valid version (for example, `jq-1.8.1`)
- Live session runs without the missing-`jq` warning, indicating full notification path readiness

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
