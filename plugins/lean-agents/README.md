# Lean Agents

Lightweight subagent replacements for Claude Code users with many MCP servers configured.

## Problem

When you have 10+ MCP servers configured (Supabase, PostHog, Playwright, GitHub, Slack, etc.), built-in subagents (Explore, Plan, general-purpose) fail with **"prompt is too long"** because they inherit all MCP tool schemas from the parent session. With 300+ tools, the schemas alone can exceed Sonnet's 200k context limit before the agent even starts.

See: [#37793](https://github.com/anthropics/claude-code/issues/37793), [#31623](https://github.com/anthropics/claude-code/issues/31623)

## Solution

This plugin provides lightweight agent replacements that use explicit `tools:` allowlists to avoid inheriting MCP tool schemas:

| Agent | Model | Tools | Use Instead Of |
|-------|-------|-------|----------------|
| `lean-explore` | Sonnet | Glob, Grep, Read, Bash, LS | Explore |
| `lean-plan` | Sonnet | Read, Grep, Glob | Plan |
| `lean-general` | Sonnet | Read, Write, Edit, Bash, Grep, Glob | general-purpose |
| `lean-explore-safe` | Opus | All (1M context) | Explore (guaranteed) |
| `lean-plan-safe` | Opus | All (1M context) | Plan (guaranteed) |
| `lean-general-safe` | Opus | All (1M context) | general-purpose (guaranteed) |

### Which variant to use?

- **Standard variants** (`lean-explore`, `lean-plan`, `lean-general`): Use Sonnet with a restricted tool set. Cheaper and faster. Try these first.
- **Safe variants** (`lean-explore-safe`, `lean-plan-safe`, `lean-general-safe`): Use Opus with 1M context window. Guaranteed to work regardless of how many MCP servers you have. Use these if the standard variants still fail.

## Installation

### From the Claude Code plugin marketplace

```bash
claude /plugin install lean-agents
```

### Manual installation

Copy the `lean-agents/` directory to your project or global plugins:

```bash
# Project-level
cp -r lean-agents/ .claude/plugins/lean-agents/

# User-level
cp -r lean-agents/ ~/.claude/plugins/lean-agents/
```

## Usage

The agents are available as subagent types when Claude spawns agents:

```
# In your prompt to Claude:
"Use the lean-explore agent to search for authentication code"
"Use lean-plan-safe to design the implementation"
```

Claude will automatically use these agents when it detects them as the best match for the task, or you can explicitly request them.

## Limitations

- **Standard variants** may still fail if Claude Code's runtime doesn't respect the `tools:` allowlist for MCP tool schema filtering (this is the core bug in [#37793](https://github.com/anthropics/claude-code/issues/37793))
- **Safe variants** use Opus which consumes more API quota
- These agents don't have access to MCP tools (Supabase, PostHog, etc.) — they're designed for pure codebase work
- This is a workaround, not a fix. The proper solution is for Claude Code to support controllable subagent context ([#31623](https://github.com/anthropics/claude-code/issues/31623))

## Contributing

If you find improvements or additional agent variants that help, please open a PR.
