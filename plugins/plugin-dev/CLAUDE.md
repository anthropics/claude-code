# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **plugin-dev** plugin - a comprehensive toolkit for developing Claude Code plugins. It provides 7 specialized skills, 3 agents, and 1 guided workflow command for building high-quality plugins.

## Plugin Structure

```
plugin-dev/
├── .claude-plugin/plugin.json   # Plugin manifest (required location)
├── commands/                    # Slash commands
│   └── create-plugin.md        # /plugin-dev:create-plugin workflow
├── agents/                      # Autonomous agents
│   ├── agent-creator.md        # AI-assisted agent generation
│   ├── plugin-validator.md     # Plugin structure validation
│   └── skill-reviewer.md       # Skill quality review
└── skills/                      # 7 specialized skills
    ├── agent-development/      # Creating agents
    ├── command-development/    # Creating slash commands
    ├── hook-development/       # Event-driven hooks
    ├── mcp-integration/        # MCP server integration
    ├── plugin-settings/        # Configuration patterns
    ├── plugin-structure/       # Plugin organization
    └── skill-development/      # Creating skills
```

## Key Conventions

### Skill Structure

Each skill follows progressive disclosure:

- `SKILL.md` - Core content (1,500-2,000 words, lean)
- `references/` - Detailed documentation (loaded as needed)
- `examples/` - Working code examples
- `scripts/` - Utility scripts

### Writing Style

- **Skill descriptions**: Third-person ("This skill should be used when...")
- **Skill body**: Imperative/infinitive form ("To create X, do Y")
- **Trigger phrases**: Include specific user queries in descriptions

### Path References

Always use `${CLAUDE_PLUGIN_ROOT}` for portable paths in hooks, MCP configs, and scripts.

### Plugin hooks.json Format

Plugin hooks use wrapper format with `hooks` field:

```json
{
  "hooks": {
    "PreToolUse": [...],
    "Stop": [...]
  }
}
```

## Testing

Test the plugin locally:

```bash
cc --plugin-dir /path/to/plugin-dev
```

Validate components:

```bash
# Validate hooks
./skills/hook-development/scripts/validate-hook-schema.sh hooks/hooks.json

# Validate agents
./skills/agent-development/scripts/validate-agent.sh agents/agent-name.md

# Validate settings
./skills/plugin-settings/scripts/validate-settings.sh .claude/plugin.local.md
```

## Component Patterns

### Agents

Agents require YAML frontmatter with:

- `name`: kebab-case identifier (3-50 chars)
- `description`: Starts with "Use this agent when...", includes `<example>` blocks
- `model`: inherit/sonnet/opus/haiku
- `color`: blue/cyan/green/yellow/magenta/red
- `tools`: Array of allowed tools (optional)

### Skills

Skills require:

- Directory in `skills/skill-name/`
- `SKILL.md` with YAML frontmatter (`name`, `description`)
- Strong trigger phrases in description
- Progressive disclosure (detailed content in `references/`)

### Commands

Commands are markdown files with frontmatter:

- `description`: Brief explanation
- `argument-hint`: Optional argument placeholder
- `allowed-tools`: Array of permitted tools

### Hooks

Hooks defined in `hooks/hooks.json`:

- Events: PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart, SessionEnd, UserPromptSubmit, PreCompact, Notification
- Types: `prompt` (LLM-driven) or `command` (bash scripts)
- Use matchers for tool filtering (e.g., "Write|Edit", "*")

## Workflow

The `/plugin-dev:create-plugin` command provides an 8-phase guided workflow:

1. Discovery - Understand requirements
2. Component Planning - Determine needed components
3. Detailed Design - Specify each component
4. Structure Creation - Create directories and manifest
5. Component Implementation - Build each component
6. Validation - Run validators
7. Testing - Verify in Claude Code
8. Documentation - Finalize README

## Validation Agents

Use these agents proactively after creating components:

- **plugin-validator**: Validates entire plugin structure
- **skill-reviewer**: Reviews skill quality and triggering
- **agent-creator**: Generates new agents from descriptions
