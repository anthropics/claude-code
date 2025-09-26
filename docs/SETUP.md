# 🚀 Claude Code & GitHub Copilot Setup Guide

*Complete professional-grade setup for nexcallai/code repository*

## 📋 Overview

This guide documents the complete setup process for integrating Claude Code CLI with GitHub Copilot instructions and Actions, following 2025 best practices.

## 🎯 What This Setup Provides

- **GitHub Copilot Instructions**: Custom `.github/copilot-instructions.md` following 2025 GA format
- **Claude Code Actions**: Automated code review via `@claude` mentions in PRs
- **Local Development**: Secure environment configuration with latest Claude models
- **Security**: Comprehensive protection for API keys and secrets

## ⚡ Quick Start

1. **Install Claude GitHub App**: https://github.com/apps/claude
2. **Add API Secret**: Repository Settings > Secrets > `ANTHROPIC_API_KEY`
3. **Configure Local Environment**: Copy `.env.example` to `.env.local` and add your API key
4. **Create PR**: Use automated workflow or manual PR creation

## 📖 Detailed Setup Process

### Phase 1: GitHub App Installation

1. Navigate to: https://github.com/apps/claude
2. Click "Install"
3. Select `nexcallai/code` repository
4. Grant required permissions:
   - Contents: Read & Write
   - Issues: Read & Write  
   - Pull Requests: Read & Write

### Phase 2: Repository Secrets Configuration

1. Go to: `https://github.com/nexcallai/code/settings/secrets/actions`
2. Click "New repository secret"
3. Create secret:
   - **Name**: `ANTHROPIC_API_KEY`
   - **Value**: Your Anthropic API key from https://console.anthropic.com/settings/keys
4. Click "Add secret"

### Phase 3: Local Environment Setup

1. **Copy environment template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Add your API key**:
   ```bash
   # Edit .env.local and replace:
   ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
   ```

3. **Choose your model** (based on task complexity):
   - **Opus 4.1**: `claude-opus-4-1-20250805` (complex tasks, planning)
   - **Sonnet 4**: `claude-sonnet-4-20250514` (daily tasks) 
   - **Haiku 3.5**: `claude-3-5-haiku-20241022` (quick, simple tasks)

### Phase 4: Repository Components

This setup includes:

```
.github/
├── copilot-instructions.md    # Custom Copilot instructions (2025 format)
└── workflows/
    └── claude.yml            # Claude Code Actions workflow

.env.local                    # Your personal API keys (gitignored)
.env.example                  # Team template (safe to commit)
.gitignore                    # Comprehensive security protection
docs/                         # Complete documentation suite
```

## 🔧 How It Works

### GitHub Copilot Integration
- Follows instructions in `.github/copilot-instructions.md`
- Enforces TypeScript best practices, security protocols, testing requirements
- Maintains team coding standards automatically

### Claude Code Actions  
- Triggers on `@claude` mentions in PR comments/reviews
- Provides automated code review and suggestions
- Uses your repository secrets for authentication

### Local Development
- Environment variables loaded from `.env.local`
- Model selection based on task complexity
- Secure API key management

## 🔐 Security Features

- **Environment Variables**: Protected by comprehensive `.gitignore`
- **Repository Secrets**: Encrypted by GitHub, never visible in logs
- **API Keys**: Never committed to repository
- **Access Control**: GitHub App permissions properly scoped

## 🎛️ Model Selection Guide

Choose your Claude model based on task complexity:

| Model | Use Case | Performance | Speed | Cost |
|-------|----------|-------------|--------|------|
| **Opus 4.1** | Complex reasoning, planning, architecture | Highest | Slower | $15/$75 |
| **Sonnet 4** | Daily coding, reviews, documentation | High | Medium | $3/$15 |  
| **Haiku 3.5** | Quick fixes, simple tasks, fast responses | Good | Fastest | $0.80/$4 |

## ✅ Verification Steps

1. **GitHub App**: Check installed apps in repository settings
2. **API Secret**: Verify `ANTHROPIC_API_KEY` in repository secrets
3. **Local Environment**: Run `echo $ANTHROPIC_API_KEY` should show your key
4. **Copilot**: Create test code - Copilot should follow your custom instructions
5. **Claude Actions**: Comment `@claude` on a PR - should trigger automated review

## 🚨 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## 👥 Team Resources

- [Model Selection Guide](./MODELS.md)
- [Security Best Practices](./SECURITY.md)  
- [Team Onboarding Guide](./TEAM-ONBOARDING.md)

---

*🤖 This setup follows 2025 industry best practices for AI-assisted development*