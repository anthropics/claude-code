# Claude Code - Advanced Development Environment

![](https://img.shields.io/badge/Node.js-22%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code) ![](https://img.shields.io/badge/Features-Experimental%20%7C%20Alpha%20%7C%20Beta-orange?style=flat-square) ![](https://img.shields.io/badge/Performance-Optimized-blue?style=flat-square)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an advanced agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. This enhanced version includes experimental, alpha, and beta features for cutting-edge development.

**Learn more in the [official documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**.

<img src="./demo.gif" />

## 🚀 New Features & Enhancements

### ✨ Experimental Features
- **Advanced Code Analysis**: Deep semantic analysis with AI
- **Multi-File Editing**: Edit multiple files with context awareness
- **Intelligent Suggestions**: AI-powered code suggestions and completions
- **Context-Aware Completions**: Project-aware code completions
- **Advanced Debugging**: Enhanced debugging with AI assistance

### 🔬 Alpha Features
- **AI-Powered Refactoring**: Automated code refactoring with AI guidance
- **Predictive Coding**: Predict and suggest next code blocks
- **Smart Error Detection**: Proactive error detection and prevention
- **Automated Testing**: Generate and run tests automatically

### 🧪 Beta Features
- **Enhanced Git Integration**: Advanced Git operations with AI assistance
- **Collaborative Editing**: Real-time collaborative development
- **Advanced Search**: Semantic search across codebase
- **Smart File Navigation**: Intelligent file and symbol navigation

### 🛠️ Advanced Development Tools
- **Modern CLI Tools**: bat, exa, ripgrep, fd-find, lazygit
- **Enhanced Git**: delta, git-lfs, git-extras
- **Performance Tools**: htop, starship prompt
- **Container Tools**: Docker support
- **GitHub CLI**: With Copilot extensions

## 📦 Get started

1. Install Claude Code (latest version with experimental features):

```sh
npm install -g @anthropic-ai/claude-code@1.0.108
```

2. Navigate to your project directory and run `claude` with experimental features:

```sh
# Enable all experimental features
CLAUDE_EXPERIMENTAL_FEATURES=true CLAUDE_ALPHA_FEATURES=true CLAUDE_BETA_FEATURES=true claude
```

### 🐳 Advanced DevContainer Setup

For the full development experience with all experimental features enabled:

#### Windows (PowerShell)
```powershell
# Basic setup with all features enabled
.\Script\run_devcontainer_claude_code.ps1 -Backend docker

# Custom configuration
.\Script\run_devcontainer_claude_code.ps1 -Backend docker -ClaudeVersion "1.0.108" -RebuildContainer $true

# Selective feature control
.\Script\run_devcontainer_claude_code.ps1 -Backend podman -EnableExperimental $true -EnableAlpha $false
```

#### Configuration Options
- **EnableExperimental**: Enable cutting-edge experimental features (default: true)
- **EnableAlpha**: Enable early-stage alpha features (default: true)  
- **EnableBeta**: Enable stable beta features (default: true)
- **InstallAdvancedTools**: Install additional development tools (default: true)
- **ClaudeVersion**: Specify Claude Code version (default: "1.0.108")
- **RebuildContainer**: Force container rebuild (default: false)

### 🎯 Feature Configuration

Customize your experience by editing the configuration file:

```sh
# Edit advanced configuration
claude-config

# Or manually edit
nano ~/.claude/advanced-config.json
```

### 🔧 Environment Variables

Control feature enablement with environment variables:

```sh
export CLAUDE_EXPERIMENTAL_FEATURES=true
export CLAUDE_ALPHA_FEATURES=true
export CLAUDE_BETA_FEATURES=true
export NODE_OPTIONS="--max-old-space-size=8192"
```

## 📊 Performance Optimizations

This enhanced version includes several performance improvements:

- **Memory**: Increased to 8GB max heap size
- **Parallel Processing**: Multi-threaded operations enabled
- **Caching**: Aggressive caching for faster responses
- **Background Processing**: Non-blocking operations
- **Module Preloading**: Faster startup times

## 🔒 Security Features

Enhanced security with experimental features:

- **Data Encryption**: All data encrypted at rest and in transit
- **Vulnerability Scanning**: Automated security analysis
- **Access Control**: Strict permission management
- **Audit Logging**: Comprehensive activity tracking

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

We may use feedback to improve our products and services, but we will not train generative models using your feedback from Claude Code. Given their potentially sensitive nature, we store user feedback transcripts for only 30 days.

If you choose to send us feedback about Claude Code, such as transcripts of your usage, Anthropic may use that feedback to debug related issues and improve Claude Code's functionality (e.g., to reduce the risk of similar bugs occurring in the future).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
