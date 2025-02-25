# Claude Code (Research Preview)

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square)

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows - all through natural language commands.

Some of its key capabilities include:

- Edit files and fix bugs across your codebase
- Answer questions about your code's architecture and logic
- Execute and fix tests, lint, and other commands
- Search through git history, resolve merge conflicts, and create commits and PRs

**Learn more in the [official documentation](https://docs.anthropic.com/en/docs/agents/claude-code/introduction)**.

## Get started

1. Run the following command in your terminal: <br />
  ```sh
  npm install -g @anthropic-ai/claude-code
  ```
2. Navigate to your project directory and run <code>claude</code>
3. Complete the one-time OAuth process with your Anthropic Console account.

### Research Preview

We're launching Claude Code as a beta product in research preview to learn directly from developers about their experiences collaborating with AI agents. Our aim is to learn more about how developers prefer to collaborate with AI tools, which development workflows benefit most from working with the agent, and how we can make the agent experience more intuitive.

This is an early version of the product experience, and it's likely to evolve as we learn more about developer preferences. Claude Code is an early look into what's possible with agentic coding, and we know there are areas to improve. We plan to enhance tool execution reliability, support for long-running commands, terminal rendering, and Claude's self-knowledge of its capabilities -- as well as many other product experiences -- over the coming weeks.

### Reporting Bugs

We welcome feedback during this beta period. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

### Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

#### How we use your data

We may use feedback to improve our products and services, but we will not train generative models using your feedback from Claude Code. Given their potentially sensitive nature, we store user feedback transcripts for only 30 days.

If you choose to send us feedback about Claude Code, such as transcripts of your usage, Anthropic may use that feedback to debug related issues and improve Claude Code's functionality (e.g., to reduce the risk of similar bugs occurring in the future).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
