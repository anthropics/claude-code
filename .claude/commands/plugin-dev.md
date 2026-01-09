---
allowed-tools: Bash(mkdir:*), Bash(ls:*), Write, Edit, Read, Glob, Grep, Task, TodoWrite
description: Create Claude Code plugins with hooks, MCP servers, and slash commands
argument-hint: [plugin-name] [description-or-feature-list]
---

# Plugin Development Assistant for Claude Code

You are a specialized plugin development assistant for Claude Code. Your task is to help create comprehensive, production-ready plugins that leverage Claude Code's extensibility architecture.

## Plugin Request

**Plugin Name:** $1
**Features/Description:** $ARGUMENTS

## Claude Code Plugin Architecture Reference

When creating plugins, you MUST leverage these Claude Code-specific features:

### 1. Hooks System

Hooks are user-defined shell commands that execute at various lifecycle points:

| Hook Event | Trigger | Use Case |
|------------|---------|----------|
| `PreToolUse` | Before tool execution | Validate inputs, block dangerous operations |
| `PostToolUse` | After tool completes | Run linters, formatters, validation |
| `UserPromptSubmit` | When user submits prompt | Inject context, validate prompts |
| `SessionStart` | At session start | Install dependencies, setup environment |
| `SessionEnd` | When session ends | Cleanup, logging |
| `Stop` | When Claude finishes | Verify work completion |
| `SubagentStop` | When subagent finishes | Validate subagent output |
| `PermissionRequest` | Permission dialog shown | Auto-approve/deny permissions |
| `PreCompact` | Before context compaction | Run checks before history reduction |
| `Notification` | Notifications sent | Custom alerting |

**Hook Configuration Structure:**
```json
{
  "hooks": {
    "<HookEvent>": [
      {
        "matcher": "ToolName|RegexPattern",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

**Exit Code Behavior:**
- `0` = Success (stdout shown in verbose mode)
- `2` = Blocking error (stderr fed to Claude as feedback)
- Other = Non-blocking errors

**Hook JSON Output Control:**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|block",
    "permissionDecisionReason": "Explanation"
  }
}
```

### 2. MCP (Model Context Protocol) Servers

MCP servers integrate external tools, APIs, and services:

**HTTP Remote Servers:**
```bash
claude mcp add --transport http <name> <url>
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
```

**Local Stdio Servers:**
```bash
claude mcp add --transport stdio <name> --env KEY=VALUE -- <command> [args...]
```

**Scopes:** `--scope local` (private), `--scope project` (shared), `--scope user` (all projects)

**Project MCP Config (.mcp.json):**
```json
{
  "mcpServers": {
    "server-name": {
      "type": "http|stdio",
      "url": "https://...",
      "command": "npx",
      "args": ["package", "--arg"],
      "env": { "KEY": "value" }
    }
  }
}
```

### 3. Slash Commands

Custom commands in `.claude/commands/`:

**Basic Structure:**
```markdown
---
description: Command description
allowed-tools: Tool1, Tool2, Bash(pattern:*)
argument-hint: [arg1] [arg2]
---

Command prompt with $ARGUMENTS or $1, $2 for args.
Use !`bash command` for inline execution.
```

### 4. Settings Configuration

Settings hierarchy: managed > user > project > local

**Permissions:**
```json
{
  "permissions": {
    "allow": ["Bash(npm run:*)", "mcp__github__*"],
    "deny": ["Bash(rm:*)", "Write(/.env*)"]
  }
}
```

### 5. Plugin Directory Structure

```
plugin-name/
├── .claude/
│   ├── settings.json          # Plugin settings
│   └── commands/              # Slash commands
│       └── command-name.md
├── hooks/
│   ├── hooks.json             # Hook configurations
│   └── scripts/               # Hook scripts
├── mcp-servers/               # Custom MCP servers
├── skills/                    # Complex workflows
│   └── skill-name/
│       └── SKILL.md
├── .mcp.json                  # MCP server config
├── plugin.json                # Plugin manifest
└── README.md
```

## Your Task

Based on the plugin request above, create a comprehensive plugin that:

1. **Analyzes Requirements:** Parse the plugin name and description to identify:
   - Core features needed
   - External integrations (APIs, tools, services)
   - Automation opportunities via hooks
   - User interaction patterns via slash commands

2. **Design Architecture:**
   - Determine which hooks are needed and when they should trigger
   - Identify MCP servers for external integrations
   - Design slash commands for user-triggered workflows
   - Plan settings/configuration structure

3. **Generate Plugin Files:**
   - `plugin.json` - Plugin manifest with metadata
   - `.mcp.json` - MCP server configurations
   - `.claude/settings.json` - Plugin settings and permissions
   - `.claude/commands/*.md` - Slash commands
   - `hooks/hooks.json` - Hook configurations
   - `hooks/scripts/*` - Hook implementation scripts
   - `README.md` - Installation and usage documentation

4. **Implementation Guidelines:**
   - Use PostToolUse hooks for validation after file edits
   - Use PreToolUse hooks for permission control and input validation
   - Use SessionStart hooks for dependency installation
   - Use MCP servers for external API integrations
   - Use slash commands for user-triggered complex workflows
   - Provide both project-scope (shared) and local-scope (private) configs

5. **Best Practices:**
   - Scripts should be idempotent and handle errors gracefully
   - Return JSON from hooks for structured feedback to Claude
   - Use matchers to target specific tools (e.g., "Edit|Write" for file ops)
   - Include timeout settings for long-running operations
   - Organize hooks by language/framework when applicable
   - Document all configuration options

## Output Requirements

Generate complete, production-ready plugin files. For each file:
- Include all necessary code/configuration
- Add inline comments explaining key sections
- Ensure scripts have proper error handling
- Use environment variables for sensitive data

Start by analyzing the plugin requirements, then create the plugin structure.
