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

## Known issues

### False-positive "Update available" banner (Homebrew / WinGet)

Users who installed via Homebrew or WinGet may see an "Update available!" banner
even though their package manager reports no update is available. For example:

```
Update available! Run: brew upgrade claude-code
```

**Why this happens:** Claude Code checks the npm registry for the latest
version. When a new release is published to npm, the Homebrew cask and WinGet
manifest may not be updated yet. During this window the banner fires even though
`brew upgrade` / `winget upgrade` has nothing to install. The banner resolves on
its own once the package registries catch up.

**Verify whether the update is real:**

```bash
# Homebrew
brew update && brew info --cask claude-code   # compare "Installed" vs cask version

# WinGet
winget list Anthropic.ClaudeCode              # compare installed vs available

# npm (if installed via npm)
npm outdated -g @anthropic-ai/claude-code
```

**Workarounds:**

Set the `DISABLE_AUTOUPDATER` environment variable to suppress the banner:

```bash
# One-time
DISABLE_AUTOUPDATER=1 claude

# Persistent (add to ~/.bashrc, ~/.zshrc, or equivalent)
export DISABLE_AUTOUPDATER=1
```

```powershell
# One-time
$env:DISABLE_AUTOUPDATER = 1; claude

# Persistent (PowerShell profile)
[System.Environment]::SetEnvironmentVariable('DISABLE_AUTOUPDATER', '1', 'User')
```

> [!NOTE]
> This suppresses **all** update notifications, including legitimate ones.
> Remove the variable once your package manager has the latest version.

Tracked in [#18047](https://github.com/anthropics/claude-code/issues/18047).

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
