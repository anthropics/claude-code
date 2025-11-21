# Claude Code Plugins

This directory contains some official Claude Code plugins that extend functionality through custom commands, agents, and workflows. These are examples of what's possible with the Claude Code plugin system—many more plugins are available through community marketplaces.

## What are Claude Code Plugins?

Claude Code plugins are extensions that enhance Claude Code with custom slash commands, specialized agents, hooks, and MCP servers. Plugins can be shared across projects and teams, providing consistent tooling and workflows.

Learn more in the [official plugins documentation](https://docs.claude.com/en/docs/claude-code/plugins).

## Plugins in This Directory

### [agent-sdk-dev](./agent-sdk-dev/)

**Claude Agent SDK Development Plugin**

Streamlines the development of Claude Agent SDK applications with scaffolding commands and verification agents.

- **Command**: `/new-sdk-app` - Interactive setup for new Agent SDK projects
- **Agents**: `agent-sdk-verifier-py` and `agent-sdk-verifier-ts` - Validate SDK applications against best practices
- **Use case**: Creating and verifying Claude Agent SDK applications in Python or TypeScript

### [commit-commands](./commit-commands/)

**Git Workflow Automation Plugin**

Simplifies common git operations with streamlined commands for committing, pushing, and creating pull requests.

- **Commands**:
  - `/commit` - Create a git commit with appropriate message
  - `/commit-push-pr` - Commit, push, and create a PR in one command
  - `/clean_gone` - Clean up stale local branches marked as [gone]
- **Use case**: Faster git workflows with less context switching

### [developer-utilities](./developer-utilities/)

**Developer Utilities Plugin**

Essential developer utilities for cache cleanup, command validation, and workflow optimization. Addresses multiple community-requested features.

- **Commands**:
  - `/clean` - Clean up cache, logs, and temporary files (frees 3-6GB typically)
  - `/validate-commands` - Validate slash command files and check for errors
  - `/permission-examples` - Explain your actual permission rules with examples
  - `/init-skills` - Skills-aware CLAUDE.md initialization
  - `/diagnose-skills` - Troubleshoot skill discovery and invocation issues
  - `/update-plugins` - Update all git-based plugins with one command
- **Use case**: System maintenance, understanding permissions, efficient project initialization, debugging Skills, plugin management
- **Addresses**: [#11646](https://github.com/anthropics/claude-code/issues/11646), [#11655](https://github.com/anthropics/claude-code/issues/11655), [#11632](https://github.com/anthropics/claude-code/issues/11632), [#11661](https://github.com/anthropics/claude-code/issues/11661), [#11459](https://github.com/anthropics/claude-code/issues/11459), [#9716](https://github.com/anthropics/claude-code/issues/9716), [#11322](https://github.com/anthropics/claude-code/issues/11322), [#11676](https://github.com/anthropics/claude-code/issues/11676)

### [code-review](./code-review/)

**Automated Pull Request Code Review Plugin**

Provides automated code review for pull requests using multiple specialized agents with confidence-based scoring to filter false positives.

- **Command**:
  - `/code-review` - Automated PR review workflow
- **Use case**: Automated code review on pull requests with high-confidence issue detection (threshold ≥80)

### [feature-dev](./feature-dev/)

**Comprehensive Feature Development Workflow Plugin**

Provides a structured 7-phase approach to feature development with specialized agents for exploration, architecture, and review.

- **Command**: `/feature-dev` - Guided feature development workflow
- **Agents**:
  - `code-explorer` - Deeply analyzes existing codebase features
  - `code-architect` - Designs feature architectures and implementation blueprints
  - `code-reviewer` - Reviews code for bugs, quality issues, and project conventions
- **Use case**: Building new features with systematic codebase understanding and quality assurance

## Installation

These plugins are included in the Claude Code repository. To use them in your own projects:

1. Install Claude Code globally:
```bash
npm install -g @anthropic-ai/claude-code
```

2. Navigate to your project and run Claude Code:
```bash
claude
```

3. Use the `/plugin` command to install plugins from marketplaces, or configure them in your project's `.claude/settings.json`.

For detailed plugin installation and configuration, see the [official documentation](https://docs.claude.com/en/docs/claude-code/plugins).

## Plugin Structure

Each plugin follows the standard Claude Code plugin structure:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── commands/                # Slash commands (optional)
├── agents/                  # Specialized agents (optional)
├── skills/                  # Agent Skills (optional)
├── hooks/                   # Event handlers (optional)
├── .mcp.json                # External tool configuration (optional)
└── README.md                # Plugin documentation
```

## Contributing

When adding new plugins to this directory:

1. Follow the standard plugin structure
2. Include a comprehensive README.md
3. Add plugin metadata in `.claude-plugin/plugin.json`
4. Document all commands and agents
5. Provide usage examples

## Learn More

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code/overview)
- [Plugin System Documentation](https://docs.claude.com/en/docs/claude-code/plugins)
- [Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk/overview)
