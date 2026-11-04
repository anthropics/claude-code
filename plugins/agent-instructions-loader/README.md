# Agent Instructions Loader Plugin

Loads custom agent body content as additional context when subagents are spawned via the `SubagentStart` hook.

## The Problem

When custom agents are defined with markdown body content (the text after YAML frontmatter), this body content is supposed to become the system prompt that guides the subagent's behavior. However, the body content is not passed to subagents when spawned via the Task tool.

### Example

Given this agent definition:

```markdown
---
name: my-agent
description: "My specialized agent"
---

# Instructions

You MUST say "HELLO WORLD" as your first response.
```

When spawned via Task tool, the subagent receives the metadata (name, description, tools) but NOT the body instructions. The subagent behaves generically instead of following the custom instructions.

## The Solution

This plugin provides a `SubagentStart` hook that:

1. Intercepts subagent spawn events
2. Looks up the agent definition file by agent type
3. Extracts the body content from the markdown file
4. Loads it as `additionalContext` which gets added to the subagent's context

## How It Works

The `SubagentStart` hook is triggered whenever Claude Code spawns a subagent (via the Task tool). The hook:

1. Receives the `agent_type` (the name of the agent being spawned)
2. Searches for the agent's `.md` file in standard locations:
   - `.claude/agents/<agent_type>.md` (project agents)
   - `plugins/*/agents/<agent_type>.md` (plugin agents)
   - `~/.claude/plugins/*/agents/<agent_type>.md` (user plugin agents)
3. Parses the markdown to extract body content after YAML frontmatter
4. Returns the body as `additionalContext` which Claude Code adds to the subagent

## Installation

### From Claude Code Marketplace

```
/install agent-instructions-loader
```

### Manual Installation

1. Copy this plugin to your Claude Code plugins directory:

   ```bash
   cp -r plugins/agent-instructions-loader ~/.claude/plugins/
   ```

2. Enable the plugin in your settings:

   ```json
   {
     "enabledPlugins": {
       "agent-instructions-loader": true
     }
   }
   ```

## Verification

To verify the plugin is working, create a test agent:

**`.claude/agents/test-canary.md`**
```markdown
---
name: test-canary
description: "Test agent for verifying instructions loading"
---

CRITICAL: You MUST say "CANARY_PHRASE_12345" as the VERY FIRST thing in your response.
```

Then test:
```bash
claude -p "Use the Task tool to spawn test-canary agent with prompt 'say hello'"
```

If working correctly, the response will start with "CANARY_PHRASE_12345".

## Debug Mode

Enable debug logging to troubleshoot:

```bash
AGENT_INSTRUCTIONS_LOADER_DEBUG=true claude
```

This outputs detailed logs to stderr showing agent lookups, file operations, and context loading.

## Technical Details

### Hook Input

```json
{
  "hook_event_name": "SubagentStart",
  "agent_type": "my-agent",
  "agent_id": "agent-abc123",
  "cwd": "/path/to/project",
  "session_id": "session-123"
}
```

### Hook Output

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "# Custom Agent Instructions\n\nThe following instructions..."
  }
}
```

### Built-in Agents

Built-in agents (Bash, Explore, Plan, general-purpose, etc.) are skipped since they don't have custom markdown body content.

### Security

The plugin validates agent types to prevent path traversal:
- Rejects `..` patterns
- Rejects `/` and `\` path separators
- Only allows alphanumeric characters, underscores, hyphens, and colons

## License

MIT
