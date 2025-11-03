# Claude Code Deployment Quick Start

## TL;DR - What You Need to Know

### ❌ WRONG: Original Script Approach
```bash
# DON'T DO THIS - This is for web apps!
railway up
render deploy
flyctl deploy
```
**Why wrong**: Claude Code is a CLI tool, not a web app

### ✅ RIGHT: Claude Code Deployment
```bash
# For users:
npm install -g @anthropic-ai/claude-code

# For developers:
./scripts/deploy-claude-code.sh
```

---

## Three Use Cases

### 1️⃣ I'm a User - I Want to Use Claude Code

```bash
# Install
npm install -g @anthropic-ai/claude-code

# Configure (enter your Anthropic API key)
claude config

# Use it
cd your-project
claude
```

**That's it!** No deployment needed.

---

### 2️⃣ I'm a Developer - I Want to Create a Plugin

```bash
# Clone the marketplace repo
git clone https://github.com/anthropics/claude-code.git
cd claude-code

# Run deployment utility
./scripts/deploy-claude-code.sh
# Select: "1) Create new plugin"

# Edit your plugin
vim plugins/my-plugin/commands/my-command.md

# Test locally
ln -s $(pwd)/plugins/my-plugin ~/.claude/plugins/
cd /tmp/test-project
claude
> /my-command

# Submit to marketplace
git checkout -b add-my-plugin
git add plugins/my-plugin .claude-plugin/marketplace.json
git commit -m "feat: Add my-plugin"
git push origin add-my-plugin
# Create PR on GitHub
```

---

### 3️⃣ I'm a Maintainer - I Want to Release a New Version

```bash
# Prepare release
./scripts/deploy-claude-code.sh
# Select: "6) Prepare new release"

# Manual steps
git add CHANGELOG.md
git commit -m "chore: Release v1.2.3"
git tag v1.2.3
git push origin main
git push origin v1.2.3

# Publish to npm (Anthropic team only)
npm publish --access public
```

---

## Key Differences

| Aspect | Web App (Original Script) | Claude Code (Correct) |
|--------|---------------------------|----------------------|
| **What it is** | Server application | CLI tool |
| **Installation** | Deploy to Railway/Render | `npm install -g` |
| **Runs on** | Cloud servers | User's machine |
| **Needs database** | Yes (PostgreSQL) | No |
| **Environment vars** | DATABASE_URL, JWT_SECRET, etc. | Only ANTHROPIC_API_KEY |
| **Hosting cost** | $0-20/month | $0 (users pay API usage) |
| **Uptime needed** | 24/7 | On-demand |
| **Deployment method** | `railway up`, `flyctl deploy` | `npm publish` |

---

## Common Mistakes

### ❌ Deploying to Railway
```bash
railway init
railway up
# ERROR: Claude Code is not a web server!
```

### ❌ Setting up PostgreSQL
```bash
railway add --database postgres
# ERROR: Claude Code doesn't use a database!
```

### ❌ Creating a Procfile
```bash
echo "web: node src/server.js" > Procfile
# ERROR: No server.js exists!
```

### ✅ Correct Approach
```bash
npm install -g @anthropic-ai/claude-code
# SUCCESS: Users install from npm
```

---

## File Structure

### Original Script Created (WRONG for Claude Code)
```
Procfile               # ❌ No web server
Dockerfile             # ❌ Not needed for CLI
render.yaml            # ❌ Not a web service
DEPLOYMENT_GUIDE.md    # ❌ Wrong deployment method
.dockerignore          # ❌ Not deploying containers
```

### Our New Script Creates (CORRECT)
```
scripts/deploy-claude-code.sh    # ✅ Plugin & release management
SCRIPT_REVIEW.md                 # ✅ Analysis of original script
DEPLOYMENT_README.md             # ✅ Correct deployment guide
DEPLOYMENT_QUICKSTART.md         # ✅ This file
```

---

## The Five-Minute Test

### If This is a Web App:
```bash
# Start local server
npm start

# Should see:
# Server listening on http://localhost:3000

# Should respond to:
curl http://localhost:3000
```

### If This is Claude Code (CLI):
```bash
# Run CLI
claude

# Should see:
# Claude Code interactive session
# Type a message or command...

# Does NOT respond to:
curl http://localhost:3000
# (No server running!)
```

**Result**: Claude Code is a CLI tool! ✅

---

## Quick Reference

### Installation
```bash
npm install -g @anthropic-ai/claude-code
```

### Configuration
```bash
claude config
# Enter: ANTHROPIC_API_KEY=sk-ant-xxx...
```

### Usage
```bash
cd your-project
claude
> help me refactor this code
```

### Plugin Development
```bash
./scripts/deploy-claude-code.sh
```

### Get Help
```bash
claude --help
# Or visit: https://docs.anthropic.com/en/docs/claude-code/
```

---

## Decision Tree

```
Do you want to USE Claude Code?
├─ Yes → npm install -g @anthropic-ai/claude-code
└─ No
    └─ Do you want to CREATE a plugin?
        ├─ Yes → ./scripts/deploy-claude-code.sh
        └─ No
            └─ Do you want to RELEASE a new version?
                ├─ Yes → ./scripts/deploy-claude-code.sh (option 6)
                └─ No → Read the docs!
```

---

## Get Help

- **Full Guide**: [DEPLOYMENT_README.md](./DEPLOYMENT_README.md)
- **Script Analysis**: [SCRIPT_REVIEW.md](./SCRIPT_REVIEW.md)
- **Official Docs**: https://docs.anthropic.com/en/docs/claude-code/
- **Discord**: https://anthropic.com/discord
- **Issues**: https://github.com/anthropics/claude-code/issues

---

## Bottom Line

**Claude Code is an npm package, not a web application.**

✅ Install with: `npm install -g @anthropic-ai/claude-code`
❌ Don't deploy to: Railway, Render, Fly.io

✅ Users run it: Locally on their machines
❌ Not hosted: On cloud servers

✅ One environment variable: `ANTHROPIC_API_KEY`
❌ No need for: Database, JWT secrets, Stripe keys

**That's the key difference!** 🎯
