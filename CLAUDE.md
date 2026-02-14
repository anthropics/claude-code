# CLAUDE.md - AI Assistant Guidelines for Claude Code Repository

## Project Overview

**Claude Code** is Anthropic's official agentic coding CLI tool that lives in your terminal. It understands codebases and helps users code faster by executing tasks, explaining code, and handling git workflows through natural language commands.

- **Package**: `@anthropic-ai/claude-code` (npm)
- **Documentation**: https://code.claude.com/docs/en/overview
- **Repository**: https://github.com/anthropics/claude-code

## Repository Structure

```
claude-code/
├── .claude/                    # Repository-level Claude Code configuration
│   └── commands/               # Custom slash commands for this repo
│       ├── commit-push-pr.md   # Git workflow command
│       ├── dedupe.md           # Duplicate issue finder
│       └── oncall-triage.md    # Critical issue triage
├── .claude-plugin/             # Plugin marketplace manifest
│   └── marketplace.json        # Defines bundled plugins
├── .devcontainer/              # Development container configuration
│   ├── Dockerfile              # Container with Node.js, firewall, tools
│   ├── devcontainer.json       # VS Code devcontainer settings
│   └── init-firewall.sh        # Network security script
├── .github/
│   ├── ISSUE_TEMPLATE/         # Bug, feature, documentation templates
│   └── workflows/              # GitHub Actions for automation
├── examples/
│   └── hooks/                  # Example hook implementations
├── plugins/                    # Official Claude Code plugins (13 plugins)
├── scripts/                    # Automation scripts for issue management
├── CHANGELOG.md                # Version history
├── README.md                   # User-facing documentation
├── SECURITY.md                 # Vulnerability reporting guidelines
└── LICENSE.md                  # License information
```

## Plugin System

This repository contains 13 official Claude Code plugins. Each plugin follows the standard structure:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Required: Plugin manifest with name, version, description
├── commands/                # Slash commands (.md files)
├── agents/                  # Specialized subagents (.md files)
├── skills/                  # Auto-activating skills (subdirs with SKILL.md)
├── hooks/                   # Event handlers (hooks.json)
└── README.md                # Plugin documentation
```

### Available Plugins

| Plugin | Purpose |
|--------|---------|
| `agent-sdk-dev` | Agent SDK development tools and validators |
| `claude-opus-4-5-migration` | Migrate code/prompts to Opus 4.5 |
| `code-review` | Automated PR review with specialized agents |
| `commit-commands` | Git workflow automation (`/commit`, `/commit-push-pr`) |
| `explanatory-output-style` | Educational insights during coding |
| `feature-dev` | 7-phase feature development workflow |
| `frontend-design` | High-quality frontend interface guidance |
| `hookify` | Custom hook creation via conversation analysis |
| `learning-output-style` | Interactive learning mode |
| `plugin-dev` | Comprehensive plugin development toolkit |
| `pr-review-toolkit` | Specialized PR review agents |
| `ralph-wiggum` | Self-referential AI iteration loops |
| `security-guidance` | Security pattern warnings |

### Plugin Conventions

1. **Manifest**: Always in `.claude-plugin/plugin.json`
2. **Naming**: Use kebab-case for files and directories
3. **Paths**: Use `${CLAUDE_PLUGIN_ROOT}` for portability
4. **Components**: Place at plugin root, not nested in `.claude-plugin/`
5. **Documentation**: Include README.md with usage examples

## GitHub Workflows

The repository uses extensive GitHub Actions for automation:

### Issue Management

| Workflow | Purpose |
|----------|---------|
| `claude-issue-triage.yml` | Auto-label new issues using Claude |
| `claude-dedupe-issues.yml` | Find and mark duplicate issues |
| `auto-close-duplicates.yml` | Auto-close confirmed duplicates |
| `oncall-triage.yml` | Flag critical issues for oncall |
| `stale-issue-manager.yml` | Manage stale issues |
| `lock-closed-issues.yml` | Lock old closed issues |

### Claude Integration

| Workflow | Purpose |
|----------|---------|
| `claude.yml` | Respond to @claude mentions in issues/PRs |

### Workflow Patterns

- Uses `anthropics/claude-code-action@v1` for Claude integration
- MCP servers provide GitHub API access
- Model: `claude-sonnet-4-5-20250929` (default for workflows)
- Allowed tools are explicitly specified for security

## Development Environment

### Devcontainer

The `.devcontainer/` directory provides a sandboxed development environment:

- **Base**: Node.js 20
- **Tools**: git, gh CLI, jq, vim, nano, zsh, fzf
- **Security**: Network firewall restricts outbound traffic to:
  - GitHub (API, web, git)
  - npm registry
  - Anthropic API
  - VS Code marketplace
  - Statsig

### Running in Devcontainer

```bash
# VS Code: "Remote-Containers: Open Folder in Container"
# Or use GitHub Codespaces
```

## Repository Commands

### Custom Slash Commands (`.claude/commands/`)

| Command | Description |
|---------|-------------|
| `/dedupe` | Find duplicate issues (up to 3) for a GitHub issue |
| `/oncall-triage` | Identify critical bugs needing immediate attention |
| `/commit-push-pr` | Full git workflow: commit, push, create PR |

### Usage Notes

- Commands specify `allowed-tools` in frontmatter for security
- Use `gh` CLI for GitHub operations, not web fetch
- Create todo lists for multi-step operations
- Use agents for parallel search operations

## Scripts

### Issue Management (`scripts/`)

| Script | Purpose |
|--------|---------|
| `comment-on-duplicates.sh` | Post duplicate warning comments |
| `auto-close-duplicates.ts` | Auto-close duplicate issues |
| `backfill-duplicate-comments.ts` | Backfill comments on existing duplicates |

### Script Usage

```bash
# Comment on potential duplicates
./scripts/comment-on-duplicates.sh --base-issue 123 --potential-duplicates 456 789

# Scripts validate inputs and check issue existence
```

## Hook Development

Hooks are event-driven automation for Claude Code. Key events:

| Event | When | Use Case |
|-------|------|----------|
| `PreToolUse` | Before tool execution | Validate/block operations |
| `PostToolUse` | After tool completion | Log, provide feedback |
| `Stop` | Agent stopping | Verify task completion |
| `SessionStart` | Session begins | Load context |
| `UserPromptSubmit` | User input | Add context, validate |

### Hook Types

1. **Prompt-based** (recommended): LLM-driven decisions
2. **Command-based**: Bash scripts for deterministic checks

### Example Hook Configuration

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "prompt",
        "prompt": "Validate file write safety"
      }]
    }]
  }
}
```

## Contributing Guidelines

### Plugin Development

1. Follow standard plugin structure
2. Include comprehensive README.md
3. Add plugin metadata in `.claude-plugin/plugin.json`
4. Document all commands and agents
5. Provide usage examples
6. Test thoroughly before submission

### Issue Reporting

- Use `/bug` command in Claude Code for quick reports
- File issues at https://github.com/anthropics/claude-code/issues
- Follow issue templates (bug, feature, documentation, model behavior)
- Check existing issues before filing

### Security

- Report vulnerabilities via HackerOne: https://hackerone.com/anthropic-vdp
- Do not disclose security issues publicly
- See SECURITY.md for full guidelines

## Key Technical Details

### Supported Platforms

- macOS, Linux, Windows
- API platforms: Anthropic API, AWS Bedrock, Google Vertex AI

### Installation Methods

1. **Recommended**: `curl -fsSL https://claude.ai/install.sh | bash`
2. **Homebrew**: `brew install --cask claude-code`
3. **Windows**: `irm https://claude.ai/install.ps1 | iex`
4. **npm** (deprecated): `npm install -g @anthropic-ai/claude-code`

### Model Selection

- Default: Sonnet
- Available: Opus, Sonnet, Haiku
- Check current: `/model` command
- Switch: `--model` flag or settings

## AI Assistant Best Practices

When working on this repository:

1. **Read before editing**: Always read files before proposing changes
2. **Use plugins appropriately**: Understand plugin structure before modifications
3. **Follow conventions**: kebab-case naming, proper manifest structure
4. **Test hooks**: Use `claude --debug` for hook debugging
5. **Document changes**: Update README files when adding features
6. **Security first**: Never commit secrets, validate all inputs
7. **Use allowed tools**: Respect `allowed-tools` restrictions in commands

## Resources

- **Documentation**: https://code.claude.com/docs/en/overview
- **Plugin Docs**: https://docs.claude.com/en/docs/claude-code/plugins
- **Discord**: https://anthropic.com/discord
- **Issues**: https://github.com/anthropics/claude-code/issues
