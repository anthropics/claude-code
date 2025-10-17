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
├── commands/                 # Slash commands (optional)
├── agents/                   # Specialized agents (optional)
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
