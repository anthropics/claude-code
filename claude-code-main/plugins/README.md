# Claude Code Plugins

This directory contains some official Claude Code plugins that extend functionality through custom commands, agents, and workflows. These are examples of what's possible with the Claude Code plugin system—many more plugins are available through community marketplaces.

## What are Claude Code Plugins?

Claude Code plugins are extensions that enhance Claude Code with custom slash commands, specialized agents, hooks, and MCP servers. Plugins can be shared across projects and teams, providing consistent tooling and workflows.

Learn more in the [official plugins documentation](https://docs.claude.com/en/docs/claude-code/plugins).

## Plugins in This Directory

| Name | Description | Contents |
|------|-------------|----------|
| [agent-sdk-dev](./agent-sdk-dev/) | Development kit for working with the Claude Agent SDK | **Command:** `/new-sdk-app` - Interactive setup for new Agent SDK projects<br>**Agents:** `agent-sdk-verifier-py`, `agent-sdk-verifier-ts` - Validate SDK applications against best practices |
| [claude-opus-4-5-migration](./claude-opus-4-5-migration/) | Migrate code and prompts from Sonnet 4.x and Opus 4.1 to Opus 4.5 | **Skill:** `claude-opus-4-5-migration` - Automated migration of model strings, beta headers, and prompt adjustments |
| [code-review](./code-review/) | Automated PR code review using multiple specialized agents with confidence-based scoring to filter false positives | **Command:** `/code-review` - Automated PR review workflow<br>**Agents:** 5 parallel Sonnet agents for CLAUDE.md compliance, bug detection, historical context, PR history, and code comments |
| [commit-commands](./commit-commands/) | Git workflow automation for committing, pushing, and creating pull requests | **Commands:** `/commit`, `/commit-push-pr`, `/clean_gone` - Streamlined git operations |
| [explanatory-output-style](./explanatory-output-style/) | Adds educational insights about implementation choices and codebase patterns (mimics the deprecated Explanatory output style) | **Hook:** SessionStart - Injects educational context at the start of each session |
| [feature-dev](./feature-dev/) | Comprehensive feature development workflow with a structured 7-phase approach | **Command:** `/feature-dev` - Guided feature development workflow<br>**Agents:** `code-explorer`, `code-architect`, `code-reviewer` - For codebase analysis, architecture design, and quality review |
| [frontend-design](./frontend-design/) | Create distinctive, production-grade frontend interfaces that avoid generic AI aesthetics | **Skill:** `frontend-design` - Auto-invoked for frontend work, providing guidance on bold design choices, typography, animations, and visual details |
| [hookify](./hookify/) | Easily create custom hooks to prevent unwanted behaviors by analyzing conversation patterns or explicit instructions | **Commands:** `/hookify`, `/hookify:list`, `/hookify:configure`, `/hookify:help`<br>**Agent:** `conversation-analyzer` - Analyzes conversations for problematic behaviors<br>**Skill:** `writing-rules` - Guidance on hookify rule syntax |
| [learning-output-style](./learning-output-style/) | Interactive learning mode that requests meaningful code contributions at decision points (mimics the unshipped Learning output style) | **Hook:** SessionStart - Encourages users to write meaningful code (5-10 lines) at decision points while receiving educational insights |
| [plugin-dev](./plugin-dev/) | Comprehensive toolkit for developing Claude Code plugins with 7 expert skills and AI-assisted creation | **Command:** `/plugin-dev:create-plugin` - 8-phase guided workflow for building plugins<br>**Agents:** `agent-creator`, `plugin-validator`, `skill-reviewer`<br>**Skills:** Hook development, MCP integration, plugin structure, settings, commands, agents, and skill development |
| [pr-review-toolkit](./pr-review-toolkit/) | Comprehensive PR review agents specializing in comments, tests, error handling, type design, code quality, and code simplification | **Command:** `/pr-review-toolkit:review-pr` - Run with optional review aspects (comments, tests, errors, types, code, simplify, all)<br>**Agents:** `comment-analyzer`, `pr-test-analyzer`, `silent-failure-hunter`, `type-design-analyzer`, `code-reviewer`, `code-simplifier` |
| [ralph-wiggum](./ralph-wiggum/) | Interactive self-referential AI loops for iterative development. Claude works on the same task repeatedly until completion | **Commands:** `/ralph-loop`, `/cancel-ralph` - Start/stop autonomous iteration loops<br>**Hook:** Stop - Intercepts exit attempts to continue iteration |
| [security-guidance](./security-guidance/) | Security reminder hook that warns about potential security issues when editing files | **Hook:** PreToolUse - Monitors 9 security patterns including command injection, XSS, eval usage, dangerous HTML, pickle deserialization, and os.system calls |

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
