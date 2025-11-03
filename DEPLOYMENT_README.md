# Claude Code Deployment & Development Guide

## Overview

Claude Code is a **CLI tool distributed via npm**, not a web application. This guide explains the proper deployment and development workflow for Claude Code and its plugin marketplace.

---

## Quick Start

### For Users (Installing Claude Code)

```bash
# Install globally from npm
npm install -g @anthropic-ai/claude-code

# Configure with your Anthropic API key
claude config

# Start using Claude Code
cd your-project
claude
```

### For Plugin Developers

```bash
# Run the deployment utility
cd claude-code
./scripts/deploy-claude-code.sh

# Interactive menu will guide you through:
# - Creating new plugins
# - Testing plugins locally
# - Submitting to marketplace
```

### For Maintainers

The deployment script provides tools for:
- Release management
- Version bumping
- Changelog generation
- Marketplace updates

---

## What Was Wrong with the Original Script?

The provided deployment script was designed for **web applications** with servers and databases. Key issues:

| Original Script Assumed | Claude Code Reality |
|------------------------|---------------------|
| Web server (Node.js + Express) | CLI tool |
| PostgreSQL database | No database |
| Railway/Render/Fly.io hosting | npm package distribution |
| 24/7 uptime | Runs on-demand |
| `DATABASE_URL`, `JWT_SECRET` | Only needs `ANTHROPIC_API_KEY` |
| Stripe payments | Not applicable |
| Email services (Resend/SendGrid) | Not applicable |

**See [SCRIPT_REVIEW.md](./SCRIPT_REVIEW.md) for detailed analysis.**

---

## Proper Deployment Architecture

### Distribution Model

```
┌─────────────────────────────────────────────┐
│         NPM Registry                        │
│   @anthropic-ai/claude-code                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│     User's Machine (via npm install)        │
│                                             │
│  ~/.claude/                                 │
│    ├── config (API keys)                    │
│    └── plugins/ (custom plugins)            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│       Claude Code CLI Runtime               │
│                                             │
│  Loads plugins from:                        │
│    - Built-in marketplace (this repo)       │
│    - User's ~/.claude/plugins/              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│       Anthropic Claude API                  │
│   (via HTTPS - api.anthropic.com)           │
└─────────────────────────────────────────────┘
```

### No Server Required!

Claude Code is stateless and runs locally:
- ✅ Installed via `npm install -g`
- ✅ Configuration stored in `~/.claude/`
- ✅ Calls Anthropic API over HTTPS
- ❌ No web server needed
- ❌ No database needed
- ❌ No hosting platform needed

---

## Plugin Development Workflow

### 1. Create a New Plugin

```bash
./scripts/deploy-claude-code.sh
# Select: "1) Create new plugin"
```

This creates:
```
plugins/my-plugin/
├── README.md
├── commands/
│   └── example.md
└── agents/
    └── example-agent.md
```

### 2. Develop Your Plugin

**Command Format** (`commands/my-command.md`):
```markdown
---
name: my-command
description: What this command does
---

# My Command

Instructions for Claude Code to execute this command.

## Steps
1. Do something
2. Do something else
3. Complete the task
```

**Agent Format** (`agents/my-agent.md`):
```markdown
---
name: my-agent
description: What this agent does
model: sonnet
---

# My Agent

Instructions for the AI agent's behavior and capabilities.

## Capabilities
- Feature 1
- Feature 2
```

### 3. Test Locally

```bash
# Link your plugin to Claude Code
mkdir -p ~/.claude/plugins
ln -s $(pwd)/plugins/my-plugin ~/.claude/plugins/

# Test in a project
cd /tmp/test-project
claude
> /my-command
```

### 4. Add to Marketplace

Edit `.claude-plugin/marketplace.json`:
```json
{
  "plugins": [
    {
      "name": "my-plugin",
      "description": "What my plugin does",
      "category": "development",
      "source": "./plugins/my-plugin",
      "version": "1.0.0",
      "author": "Your Name",
      "license": "MIT"
    }
  ]
}
```

### 5. Submit PR

```bash
git checkout -b add-my-plugin
git add plugins/my-plugin .claude-plugin/marketplace.json
git commit -m "feat: Add my-plugin to marketplace"
git push origin add-my-plugin
# Create PR on GitHub
```

---

## Release Management (Maintainers)

### Version Bumping

```bash
./scripts/deploy-claude-code.sh
# Select: "6) Prepare new release"
```

This helps you:
1. Choose new version number (semantic versioning)
2. Generate changelog template
3. Create git tags

### Manual Release Process

```bash
# 1. Update version
# Edit package.json version field (if exists)

# 2. Update CHANGELOG.md
# Add new version section with changes

# 3. Commit changes
git add CHANGELOG.md package.json
git commit -m "chore: Release v1.2.3"

# 4. Create tag
git tag v1.2.3

# 5. Push to GitHub
git push origin main
git push origin v1.2.3

# 6. Publish to npm (Anthropic team only)
npm publish --access public

# 7. Create GitHub Release
# Go to github.com/anthropics/claude-code/releases/new
# Select tag v1.2.3
# Generate release notes
```

---

## Environment Variables

### Required for Users

```bash
# Only one variable needed!
ANTHROPIC_API_KEY=sk-ant-xxx...xxx

# Set via Claude Code configuration:
claude config
# Or set directly:
export ANTHROPIC_API_KEY=sk-ant-xxx...xxx
```

### NOT Needed (Unlike Web Apps)

```bash
# These are for web apps, NOT needed for Claude Code:
DATABASE_URL         # No database
JWT_SECRET          # No authentication
STRIPE_SECRET_KEY   # No payment processing
SMTP_*              # No email sending
PORT                # No web server
NODE_ENV            # Runs locally
```

---

## Development Tools

### Available in Deployment Script

1. **Plugin Management**
   - Create new plugins
   - Validate plugin structure
   - Add to marketplace
   - List all plugins

2. **Release Management**
   - Prepare new release
   - View current version
   - Generate changelog

3. **Development Setup**
   - Check prerequisites
   - Install Claude Code
   - Configure API keys
   - Test plugins locally

4. **Documentation**
   - Generate plugin docs
   - View deployment guide

### Running the Script

```bash
# Interactive menu
./scripts/deploy-claude-code.sh

# Or run directly from any location
cd /path/to/claude-code
./scripts/deploy-claude-code.sh
```

---

## GitHub Actions Integration

### Included Workflows

This repository includes GitHub Actions for:

1. **Claude Code Bot** (`.github/workflows/claude.yml`)
   - Responds to `@claude` mentions in PRs
   - Uses `anthropics/claude-code-action@beta`

2. **Issue Management**
   - Stale issue detection
   - Automatic closing
   - Duplicate detection

3. **Release Automation** (if configured)
   - Automated version bumping
   - Changelog generation
   - npm publishing

### Testing Workflows Locally

Install `act` to test workflows locally:
```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow
act -W .github/workflows/claude.yml
```

---

## Comparison: Web App vs CLI Tool

### Web Application Deployment (Original Script)
```bash
# Build application
npm run build

# Deploy to hosting platform
railway up / flyctl deploy / render deploy

# Needs:
- Web server (Express/Fastify)
- Database (PostgreSQL)
- Environment variables (DATABASE_URL, JWT_SECRET)
- SSL certificates
- Load balancer (for scale)
- 24/7 uptime
- Monitoring

# Costs:
- Hosting: $0-20/month (free tier → paid)
- Database: $0-7/month
- Domain: $10-15/year
```

### Claude Code Deployment (Correct Method)
```bash
# Publish to npm
npm publish

# Users install
npm install -g @anthropic-ai/claude-code

# Needs:
- npm account (free)
- Anthropic API key (pay-per-use)

# Costs:
- npm publishing: FREE
- Users pay: $0 (they use their own API keys)
- No hosting costs
- No infrastructure costs
```

---

## Troubleshooting

### "claude: command not found"

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Or use npx
npx @anthropic-ai/claude-code
```

### "API key not configured"

```bash
# Configure API key
claude config

# Or set environment variable
export ANTHROPIC_API_KEY=sk-ant-xxx...xxx
```

### "Plugin not found"

```bash
# Check plugin installation
ls ~/.claude/plugins/

# Link plugin manually
ln -s /path/to/plugin ~/.claude/plugins/plugin-name

# Or check marketplace.json
cat .claude-plugin/marketplace.json
```

### Script errors

```bash
# Make script executable
chmod +x scripts/deploy-claude-code.sh

# Check you're in the right directory
ls .claude-plugin/marketplace.json

# Check prerequisites
which node npm git
```

---

## Resources

### Documentation
- [Claude Code Official Docs](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Plugin Development Guide](https://docs.anthropic.com/en/docs/claude-code/plugins)
- [GitHub Actions Integration](https://docs.anthropic.com/en/docs/claude-code/github-actions)

### Community
- [Claude Developers Discord](https://anthropic.com/discord)
- [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- [GitHub Discussions](https://github.com/anthropics/claude-code/discussions)

### API
- [Anthropic API Console](https://console.anthropic.com/)
- [API Documentation](https://docs.anthropic.com/en/api/)

---

## FAQ

**Q: Do I need Railway/Render/Fly.io for Claude Code?**
A: No! Claude Code is a CLI tool. Users install it via npm and run it locally.

**Q: Where is the database?**
A: There is no database. Claude Code is stateless and calls the Anthropic API.

**Q: How do users pay for Claude Code?**
A: They use their own Anthropic API keys (pay-per-use). The tool itself is free.

**Q: Can I deploy Claude Code to a server?**
A: You could, but there's no benefit. It's designed to run locally on developer machines.

**Q: How do I distribute my plugin?**
A: Submit a PR to add it to `.claude-plugin/marketplace.json`. It becomes available to all users.

**Q: What about the original deployment script?**
A: It was designed for a different type of application (web app with database). See [SCRIPT_REVIEW.md](./SCRIPT_REVIEW.md) for details.

---

## Summary

✅ **Correct Deployment**: Publish to npm, users install with `npm install -g`
❌ **Incorrect Deployment**: Deploy to Railway/Render/Fly.io with databases

✅ **Environment**: `ANTHROPIC_API_KEY`
❌ **Environment**: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_KEY`

✅ **Development**: Local testing, plugin marketplace, GitHub Actions
❌ **Development**: Web server, database migrations, payment processing

**Claude Code is a CLI tool, not a web app!**
