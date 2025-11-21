# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square)
[![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)
![Test Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen?style=flat-square)
![Tests](https://img.shields.io/badge/tests-170%2B-blue?style=flat-square)
![Test Status](https://img.shields.io/badge/tests-passing-success?style=flat-square)
![Quality](https://img.shields.io/badge/mutation%20score-85%25-green?style=flat-square)

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

2. Navigate to your project directory and run `claude`.

## Plugins

## Testing 🚀

This repository features a **world-class testing infrastructure** with enterprise-grade capabilities.

### Quick Start

```sh
# Install dependencies
cd tests && ./setup-bats.sh

# Run tests (basic)
npm test

# Run tests (parallel - 3-4x faster!)
npm run test:parallel

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run coverage
```

### Key Metrics

- **170+ tests** with 90%+ coverage
- **3-4x faster** with parallel execution
- **10 advanced features** (coverage, mutation, analytics, etc.)
- **Multi-OS testing** (Ubuntu, macOS)
- **Docker support** for isolation

### Documentation

- **[TESTING.md](TESTING.md)** - Quick reference guide
- **[tests/README.md](tests/README.md)** - Comprehensive documentation
- **[tests/ADVANCED.md](tests/ADVANCED.md)** - Advanced features (500+ lines)

### Features

✨ Parallel execution | 🎯 Watch mode | 📊 Coverage reports | ⚡ Benchmarks | 🧬 Mutation testing | 🐳 Docker | 🌍 Multi-OS | 🎨 Beautiful output

### Data collection, usage, and retention

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
