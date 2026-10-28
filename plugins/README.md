# Claude Code Plugins

Anthropic's plugins are developed in [claude-plugins-official](https://github.com/anthropics/claude-plugins-official). The `claude-code-plugins` marketplace in this repository still lists them, and installs them from there. The `claude-opus-4-5-migration` plugin has been retired.

## What are Claude Code Plugins?

Claude Code plugins are extensions that enhance Claude Code with custom slash commands, specialized agents, hooks, and MCP servers. Plugins can be shared across projects and teams, providing consistent tooling and workflows.

Learn more in the [official plugins documentation](https://code.claude.com/docs/en/plugins).

## Installation

To use plugins in your own projects:

1. Install Claude Code globally:
```bash
npm install -g @anthropic-ai/claude-code
```

2. Navigate to your project and run Claude Code:
```bash
claude
```

3. Use the `/plugin` command to install plugins from marketplaces, or configure them in your project's `.claude/settings.json`.

For detailed plugin installation and configuration, see the [official documentation](https://code.claude.com/docs/en/plugins).

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

New plugins belong in [claude-plugins-official](https://github.com/anthropics/claude-plugins-official).

## Learn More

- [Claude Code Documentation](https://code.claude.com/docs/en/overview)
- [Plugin System Documentation](https://code.claude.com/docs/en/plugins)
- [Agent SDK Documentation](https://code.claude.com/docs/en/agent-sdk/overview)
