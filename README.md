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

## Troubleshooting upstream API errors

Some terminal-visible errors come from the Claude API service itself, not from Claude Code. The most common pattern looks like this:

```
API Error: 500 {"type":"error","error":{"type":"api_error","message":"Internal server error"},"request_id":"req_..."}
Claude may be experiencing issues. Check https://status.anthropic.com for service status.
```

That is an upstream 500 from the API, not a client bug. The `request_id` is a server-side identifier that Anthropic support can use to look up the trace.

If you see one, before filing a bug report:

1. **Check the status page** at https://status.claude.com (which is where `status.anthropic.com` now points). If there is an active or recently-resolved incident for the model you are using, the error is being driven by that incident and usually clears within minutes.
2. **Retry the request**. Most transient `api_error` 500s clear on the next attempt.
3. **Try a different model** if your current one is listed as degraded on the status page. The status page reports per-model.
4. **Search existing issues** at https://github.com/anthropics/claude-code/issues?q=is%3Aissue+500+Internal+Server+Error before opening a new one. Service-side incidents tend to produce clusters of duplicate reports; you may find an open issue for the same window.
5. **If it persists for more than a few minutes** on the same model and prompt, that is when filing a bug or contacting support makes sense. Include the `request_id` so the trace can be looked up.

The same approach applies to `overloaded_error` (the API is temporarily out of capacity for the model, retry with backoff) and `rate_limit_error` (slow down, or switch to a model with more headroom).

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
