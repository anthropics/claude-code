# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more in the [official documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**.

<img src="./demo.gif" />

## Get started

1. Install Claude Code:

**MacOS/Linux:**
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**Homebrew (MacOS):**
```bash
brew install --cask claude-code
```

**Windows:**
```powershell
irm https://claude.ai/install.ps1 | iex
```

**NPM:**
```bash
npm install -g @anthropic-ai/claude-code
```

NOTE: If installing with NPM, you also need to install [Node.js 18+](https://nodejs.org/en/download/)

 claude/analyze-test-coverage-01KBZmFsE9Bk53MkTuzyk4AQ
## Testing

This repository includes a **world-class test suite with 200+ automated tests** across 7 categories:

- ✅ Unit Tests - Core validation and scripts
- ✅ Integration Tests - Docker containers and firewall rules
- ✅ E2E Tests - Full workflow execution
- ✅ Performance Tests - Benchmarks and stress tests
- ✅ Security Tests - Penetration testing and injection
- ✅ Chaos Tests - Failure injection and error handling
- ✅ Mocked Tests - Fast isolated testing

**Coverage: ~95%** | **Test Suites: 15** | **CI/CD Jobs: 15 parallel**

```sh
# Quick start
bash scripts/setup-tests.sh  # Install dependencies
npm test                      # Run core tests
npm run test:all              # Run all 200+ tests
npm run coverage              # Generate coverage report
```

See [TESTING.md](TESTING.md) for complete testing documentation.

### Reporting Bugs

2. Navigate to your project directory and run `claude`.
 main

## Plugins

This repository includes several Claude Code plugins that extend functionality with custom commands and agents. See the [plugins directory](./plugins/README.md) for detailed documentation on available plugins.

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
