# Claude Code CLI — Full Reference

## Executive Summary

Claude Code CLI is an agentic, terminal-first coding assistant by Anthropic that runs in your shell, understands your repository, edits files, runs commands, and integrates with Git and popular IDEs. It turns plain-English development tasks into proposed edits, test runs, and commits, improving developer velocity while preserving review control (source: https://docs.anthropic.com/en/docs/claude-code/overview).

## Technical Overview

- Install via npm: `npm install -g @anthropic-ai/claude-code` (requires Node.js 18+) — docs: https://docs.anthropic.com/en/docs/claude-code/quickstart
- Native installer (BETA): macOS/Linux/WSL: `curl -fsSL https://claude.ai/install.sh | bash`; Windows PowerShell: `irm https://claude.ai/install.ps1 | iex` — docs: https://docs.anthropic.com/en/docs/claude-code/quickstart (WARNING: Beta)
- Verify installation: `claude --version` and `claude doctor` (reports health and config issues) — docs: https://docs.anthropic.com/en/docs/claude-code/setup#update-claude-code
- Start interactive session: `claude` (opens REPL) — docs: https://docs.anthropic.com/en/docs/claude-code/quickstart
- One-off / print mode: `claude -p "explain this function"` (non-interactive) — docs: https://docs.anthropic.com/en/docs/claude-code/quickstart
- Continue/Resume: `claude -c`, `claude -r` to continue or resume conversations — docs: https://docs.anthropic.com/en/docs/claude-code/quickstart
- Git integration: conversational commits and branch commands (e.g., `claude commit`) — docs: https://docs.anthropic.com/en/docs/claude-code/quickstart
- IDE integrations: VS Code and JetBrains auto-enable features when `claude` runs from the IDE terminal — docs: https://docs.anthropic.com/en/docs/claude-code/ide-integrations
- Configuration: per-project `.claude/settings.json` and environment variables such as `DISABLE_AUTOUPDATER` and `ANTHROPIC_DEFAULT_SONNET_MODEL` — docs: https://docs.anthropic.com/en/docs/claude-code/settings

## Feature Matrix

| Feature | Description | Use-case |
|---|---|---|
| Interactive REPL | Conversational terminal session that inspects repository files and answers questions | `claude` → ask "what does this project do?" to get a repo summary (docs: https://docs.anthropic.com/en/docs/claude-code/quickstart) |
| Print / Automation Mode | Non-interactive single-command mode for scripts and CI | `claude -p "run tests and summarize failures"` to generate machine-readable output in CI (docs: https://docs.anthropic.com/en/docs/claude-code/quickstart) |
| File edits & commit flow | Proposes edits, shows diffs, asks for approval, applies changes, and creates commits | `> add input validation to register` → review diffs → `claude commit` (docs) |
| MCP (Model Context Protocol) | Connects external datasources (Google Drive, Slack, Figma) to agent context | `/mcp` commands surface external docs into conversation for accurate, context-rich answers (docs: https://docs.anthropic.com/en/docs/claude-code/mcp) |
| IDE integration | Diff viewing, selection context, quick-launch keys, and diagnostic sharing | Run `claude` from VS Code integrated terminal to enable diffs and selection sharing (docs: https://docs.anthropic.com/en/docs/claude-code/ide-integrations) |
| Hooks & SDKs | TypeScript/Python SDKs and lifecycle hooks for automation | Use SDK/hooks to integrate Claude into CI pipelines or custom tooling (changelog: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md) |
| Devcontainer | Secure, reproducible devcontainer with limited outbound network access for safe use | Use the provided `.devcontainer` to onboard developers with preconfigured protections (docs: https://docs.anthropic.com/en/docs/claude-code/devcontainer) |

## Integration Guide

1. Install Claude Code

   - npm (recommended):

   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

   Expected output (example):

   ```text
   + @anthropic-ai/claude-code@1.0.98
   added 53 packages
   ```

   - Native installer (BETA):

   macOS/Linux/WSL:
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

   Windows PowerShell:
   ```powershell
   irm https://claude.ai/install.ps1 | iex
   ```

   Expected: installer prints version and creates `claude` binary. Run `claude doctor` to verify. (docs: https://docs.anthropic.com/en/docs/claude-code/setup#native-binary-installation-beta)

2. Authenticate

   - Start `claude` and run `/login` or follow the interactive OAuth flow. You may sign in with Claude.ai (Pro/Max) or Anthropic Console (API billing). Expected: a "Claude Code" workspace is created for Anthropic Console users (docs: https://docs.anthropic.com/en/docs/claude-code/iam).

3. IDE setup

   - Open your project in VS Code or a JetBrains IDE. Open the integrated terminal at the project root and run `claude`. The extension auto-installs and enables features like IDE diffs and selection context sharing (docs: https://docs.anthropic.com/en/docs/claude-code/ide-integrations).

4. CI / automation

   - Use non-interactive print mode in automation:

   ```bash
   claude -p "list TODOs in repo" --output-format json
   ```

   Expected output: JSON array of TODOs with file paths and line numbers. (docs: https://docs.anthropic.com/en/docs/claude-code/quickstart)

5. Enterprise / hosting

   - Configure Anthropic Console with Amazon Bedrock or Google Vertex if you need cloud-hosted enterprise deployments. See third-party integration docs: https://docs.anthropic.com/en/docs/claude-code/third-party-integrations

6. Team adoption & governance

   - Add a shared `.claude/settings.json` to the repository to centralize permission rules. Use the provided devcontainer for secure onboarding. Manage cost and workspaces in the Anthropic Console (settings docs: https://docs.anthropic.com/en/docs/claude-code/settings; devcontainer docs: https://docs.anthropic.com/en/docs/claude-code/devcontainer).

## Complete Working Example (cross-platform)

macOS / Linux / WSL (bash):

```bash
# Install via npm (requires Node.js 18+)
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
# Expected example output:
# 1.0.98

# Run the install health check
claude doctor
# Expected example output lines:
# Installation: OK
# ripgrep: found
# Node.js: 18.x

# Start interactive session in project root
cd ~/my-project
claude
# At the prompt: > what does this project do?
```

Windows PowerShell:

```powershell
# Install via npm
npm install -g @anthropic-ai/claude-code

# Verify version
claude --version
# Expected example output:
# 1.0.98

# One-off query
claude -p "explain hello.py"
# Expected example output (illustrative):
# "hello.py defines greet(name) which returns ..."
```

CI / non-interactive example:

```bash
# Produce machine-readable output
claude -p "run unit tests and summarize failures" --output-format json
# Expected: JSON object with test failures summary and file references
```

## Current Status

- Latest published package: `@anthropic-ai/claude-code` version 1.0.98 — published Aug 29, 2025 (npm) — https://www.npmjs.com/package/@anthropic-ai/claude-code
- Repository & changelog: active project with public changelog: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md and repo: https://github.com/anthropics/claude-code
- Stability: GA (1.0.x) release stream; patch releases ongoing
- Experimental / Beta features (WARN):
  - Native binary installer (Beta). Run `claude doctor` after using it and prefer npm install for strict production environments (docs: https://docs.anthropic.com/en/docs/claude-code/setup#native-binary-installation-beta)
  - MCP advanced customizations and certain hooks are evolving; test before automating at scale (docs: https://docs.anthropic.com/en/docs/claude-code/mcp)

## Pricing & Availability

- Consumer plans (as of 2025-08-31):
  - Pro: $17/month (annual plan shows discount). Pro includes access to Claude Code for individuals in the web/app context (https://www.anthropic.com/pricing).
  - Max: from $100/month per person (higher usage tiers and early access; see pricing page) (https://www.anthropic.com/pricing).
- Enterprise/API: Anthropic Console and cloud partner integrations (Amazon Bedrock / Google Vertex) provide enterprise billing and hosting; contact sales for custom pricing (https://docs.anthropic.com/en/docs/claude-code/third-party-integrations, https://www.anthropic.com/enterprise).
- System requirements: macOS 10.15+, Ubuntu 20.04+/Debian 10+, Windows 10+ (WSL or Git for Windows), Node.js 18+, 4GB+ RAM (https://docs.anthropic.com/en/docs/claude-code/setup#system-requirements)

## Competitive Analysis

| Tool | Focus | CLI Pattern | Strengths | Notes |
|---|---:|---|---|---|
| Claude Code (Anthropic) | Terminal-first agent that edits files and runs commands | `claude` / `claude -p "..."` | Deep repo awareness, Git/IDE integration, MCP for external data, hooks/SDKs (https://docs.anthropic.com/en/docs/claude-code/overview) | Enterprise hosting via Bedrock/Vertex; Pro/Max consumer plans (https://www.anthropic.com/pricing)
| Cursor | GUI-first AI code editor + CLI | `cursor-agent` / `cursor-agent -p "..."` | Polished editor UX, privacy mode, fast local workflows (https://cursor.com; CLI docs: https://docs.cursor.com/en/cli/overview) | Editor-focused product; CLI complements GUI
| GitHub Copilot | Editor inline completions; GitHub ecosystem | Editor plugin (Copilot) and evolving CLI integrations | Tight GitHub integration, inline completions inside editors | See GitHub Copilot product pages for latest CLI support (https://github.com/features/copilot)

## Official Sources

1. Claude Code quickstart & overview — https://docs.anthropic.com/en/docs/claude-code/quickstart
2. Claude Code setup / installation — https://docs.anthropic.com/en/docs/claude-code/setup
3. IDE integrations — https://docs.anthropic.com/en/docs/claude-code/ide-integrations
4. MCP & third-party integrations — https://docs.anthropic.com/en/docs/claude-code/mcp
5. Devcontainer reference — https://docs.anthropic.com/en/docs/claude-code/devcontainer
6. Claude Code changelog — https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
7. NPM package (latest published) — https://www.npmjs.com/package/@anthropic-ai/claude-code
8. Anthropic pricing — https://www.anthropic.com/pricing
9. Anthropic Claude Code repo — https://github.com/anthropics/claude-code
10. Cursor CLI docs — https://docs.cursor.com/en/cli/overview
11. Cursor product — https://cursor.com

---

This document is the canonical, single-file reference. Individual `sections/*.md` files mirror each main section for modular editing.
