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

## 🎉 14 Revolutionary New Plugins

This repository now includes **14 cutting-edge Claude Code plugins** that transform development workflows:

### ⭐ New Plugin Suite (v1.0.0)

1. **Autonomous PR Agent** - Intelligent PR reviews with 6-dimension quality scoring
2. **Architecture Enforcer** - Validates code against project architecture rules
3. **Performance Bot** - Detects algorithmic inefficiencies (O(n²) → O(n))
4. **Dependency Sentinel** - Auto-updates dependencies with intelligent changelog parsing
5. **Dead Code Cremator** - Safely identifies and removes unused code
6. **Fullstack Automation** - Generates complete features (DB, API, UI, tests, deployment)
7. **Multi-Agent Collaboration** - 6 specialized agents debate and reach consensus
8. **Tech Debt Liquidator** - Identifies and auto-refactors technical debt
9. **Predictive Bug Prevention** - ML-powered pattern-based bug prediction
10. **Security Audit Bot** - OWASP Top 10 + compliance scanning + secret detection
11. **Enterprise Knowledge** - Learns org patterns and applies them automatically
12. **Performance Optimizer** - ROI-scored optimizations with cost/carbon analysis
13. **Polyglot Orchestrator** - Multi-language microservice consistency enforcement
14. **Code Mentorship** - AI-driven learning with 6 learning style adaptation

### 📚 Documentation

- **Start here:** [QUICKSTART.md](./QUICKSTART.md) - Get up and running in 30 seconds
- **User guide:** [PLUGINS_GUIDE.md](./PLUGINS_GUIDE.md) - Complete plugin documentation
- **Technical:** [TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md) - Architecture & internals
- **Legacy:** [plugins directory](./plugins/README.md) - Original plugins documentation

### 🚀 Quick Commands to Try

```bash
# Learn what's possible
/mentor-explain "What can you do?"

# Security first
/security-audit

# Build something big
/fullstack-build "Create a real-time notification system"

# Get expert feedback
/multi-agent-review

# Clean up code
/dead-code-scan
```

### 💡 Use Cases

- **Startups:** `/fullstack-build` to scaffold features in minutes
- **Enterprise:** `/enterprise-sync` to enforce org standards across repos
- **Security-first teams:** `/security-audit` + `/multi-agent-review`
- **Legacy code:** `/tech-debt-audit` + `/dead-code-cremator`
- **Learning:** `/mentor-explain` with adaptive learning styles

See the [plugins directory](./plugins/README.md) for detailed documentation on all available plugins.

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
