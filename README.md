# Claude Code

![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more in the [official documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**.

![Demo of Claude Code running in a terminal](./demo.gif)

## Get started

1. Install Claude Code:

```sh
npm install -g @anthropic-ai/claude-code
```

2. Navigate to your project directory and launch Claude:

```sh
# Navigate to your project folder
cd /your/project/path

# Start Claude Code
claude
```

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub Issue](https://github.com/anthropics/claude-code/issues).

## Data collection, usage, and retention

When you use Claude Code, we collect the following:
- Usage feedback (e.g. code accepted or rejected)
- Associated conversation data
- Explicit feedback submitted using the `/bug` command

### How we use your data

We may use feedback to improve the product, debug issues, and enhance functionality. We do not train generative models using Claude Code feedback. Transcripts are stored for a maximum of 30 days due to their potentially sensitive nature.

If you choose to send us feedback about Claude Code, such as transcripts of your usage, Anthropic may use that feedback to debug related issues and improve Claude Code's functionality (e.g., to reduce the risk of similar bugs occurring in the future).

### Privacy safeguards

We take your data seriously. Our safeguards include:
- Limited retention periods for sensitive data
- Restricted internal access to user sessions
- No model training on your data
- Transparent privacy and usage terms

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
