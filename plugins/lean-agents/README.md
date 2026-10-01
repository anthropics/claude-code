# Lean Agents

Lightweight subagent replacements for Claude Code users with many MCP servers configured.

## Problem

When you have 10+ MCP servers configured (Supabase, PostHog, Playwright, GitHub, Slack, etc.), built-in subagents (Explore, Plan, general-purpose) fail with **"prompt is too long"** because they inherit all MCP tool schemas from the parent session. With 300+ tools, the schemas alone can exceed Sonnet's 200k context limit before the agent even starts.

See: [#37793](https://github.com/anthropics/claude-code/issues/37793), [#31623](https://github.com/anthropics/claude-code/issues/31623)

## Solution

This plugin provides lightweight agent replacements that use explicit `tools:` allowlists to try to reduce or avoid inheriting MCP tool schemas. This is a runtime-dependent workaround rather than a guaranteed fix (see [Limitations](#limitations)):

| Agent | Model | Tools | Use Instead Of |
|-------|-------|-------|----------------|
| `lean-explore` | Sonnet | Glob, Grep, Read, Bash, LS | Explore |
| `lean-plan` | Sonnet | Read, Grep, Glob | Plan |
| `lean-general` | Sonnet | Read, Write, Edit, Bash, Grep, Glob | general-purpose |
| `lean-explore-safe` | Opus | All (1M context) | Explore |
| `lean-plan-safe` | Opus | All (1M context) | Plan |
| `lean-general-safe` | Opus | All (1M context) | general-purpose |

### Which variant to use?

- **Standard variants** (`lean-explore`, `lean-plan`, `lean-general`): Use Sonnet with a restricted tool set. Cheaper and faster. Try these first.
- **Safe variants** (`lean-explore-safe`, `lean-plan-safe`, `lean-general-safe`): Use Opus with 1M context window. Much less likely to hit prompt limits. Use these if the standard variants still fail.

## Installation

### From the marketplace (canonical source: [moxer-mmh/lean-agents](https://github.com/moxer-mmh/lean-agents))

1. Inside Claude Code, run `/plugin` and select "Add Marketplace"
2. Enter `moxer-mmh/lean-agents`
3. Install the `lean-agents` plugin from the marketplace
4. Restart Claude Code

### From this repository (local testing)

If you've cloned this repo, you can point Claude Code at the local directory:

```bash
# Copy to your user agents directory for immediate use
cp plugins/lean-agents/agents/*.md ~/.claude/agents/
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

- **Standard variants** (Sonnet) restrict tools via `tools:` allowlist, so they intentionally exclude MCP tools. They may still fail if the runtime doesn't respect the allowlist for MCP tool schema filtering (this is the core bug in [#37793](https://github.com/anthropics/claude-code/issues/37793))
- **Safe variants** (Opus) do not restrict tools — they rely on the 1M context window to fit everything. They may still receive MCP tools. While much less likely to hit prompt limits, extremely large MCP configurations could theoretically still overflow
- Standard variants are designed for pure codebase work without MCP tools. Safe variants may have MCP access depending on the runtime's tool inheritance behavior
- This is a workaround, not a fix. The proper solution is for Claude Code to support controllable subagent context ([#31623](https://github.com/anthropics/claude-code/issues/31623))

## Contributing

If you find improvements or additional agent variants that help, please open a PR.
