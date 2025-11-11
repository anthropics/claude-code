# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more in the [official documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**.

<img src="./demo.gif" />

## Get started

1. Install Claude Code:

```sh
npm install -g @anthropic-ai/claude-code
```

2. Navigate to your project directory and run `claude`.

## Plugins

This repository includes 8 official Claude Code plugins that extend functionality with custom commands and agents:

- **[agent-sdk-dev](./plugins/agent-sdk-dev/)** - Development tools for Claude Agent SDK applications
- **[code-review](./plugins/code-review/)** - Automated pull request code review
- **[commit-commands](./plugins/commit-commands/)** - Git workflow automation
- **[explanatory-output-style](./plugins/explanatory-output-style/)** - Enhanced explanatory communication style
- **[feature-dev](./plugins/feature-dev/)** - Comprehensive feature development workflow
- **[learning-output-style](./plugins/learning-output-style/)** - Educational and learning-focused output
- **[pr-review-toolkit](./plugins/pr-review-toolkit/)** - Advanced PR review tools
- **[security-guidance](./plugins/security-guidance/)** - Security-focused development guidance

See the [plugins directory](./plugins/README.md) for detailed documentation on available plugins.

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Connect on Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to connect with other developers using Claude Code. Get help, share feedback, and discuss your projects with the community.

## Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

See our [data usage policies](https://docs.anthropic.com/en/docs/claude-code/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
