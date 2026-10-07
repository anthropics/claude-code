# Snipara - Context Optimization + Safe Code Execution

Query your documentation with 90% token reduction and execute code safely with Docker isolation.

## What It Does

**Snipara MCP** - Context optimization that reduces 500K tokens to ~5K of highly relevant content for your LLM.

**RLM Runtime** - Recursive Language Model execution with Docker isolation. Break down complex tasks, execute code safely, and get full trajectory logs.

## Features

### Snipara MCP
- **Smart Documentation Querying** - Semantic + keyword hybrid search with token budgeting
- **Memory & Recall** - Remember decisions, learnings, and context across sessions
- **Workflow Modes** - LITE (quick fixes) and FULL (complex features with planning)
- **Team Collaboration** - Multi-project search and shared coding standards
- **Agent Swarms** - Multi-agent coordination with resource claims and task queues

### RLM Runtime
- **Docker Isolation** - Execute code safely in isolated containers
- **Recursive Completion** - Break down complex tasks automatically
- **Trajectory Logging** - Full execution trace for debugging and review
- **Multi-Provider** - Works with OpenAI, Anthropic, LiteLLM
- **Visualization** - Interactive Streamlit dashboard for execution analysis

## Prerequisites

1. **Snipara account** at [snipara.com](https://snipara.com)
2. **MCP configuration** - Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "snipara": {
      "type": "http",
      "url": "https://api.snipara.com/mcp/<your-project-slug>",
      "headers": {
        "X-API-Key": "<your-api-key>"
      }
    }
  }
}
```

Get your API key from [snipara.com/dashboard](https://snipara.com/dashboard).

3. **RLM Runtime** (optional, for code execution):

```bash
pip install rlm-runtime[all]
rlm init
```

Requires Docker for isolated execution.

## Commands

| Command | Description |
|---------|-------------|
| `/snipara:lite-mode [task]` | Quick workflow for bug fixes (<5 files) |
| `/snipara:full-mode [task]` | Complex workflow with 6-phase planning |
| `/snipara:remember [content]` | Save decisions/context to memory |
| `/snipara:recall [query]` | Search previous memories |
| `/snipara:search [pattern]` | Regex search documentation |

## Skills (Auto-Invoked by Claude)

- **query-docs** - Automatically queries Snipara when you ask about code
- **recall-context** - Recalls previous session context at start of sessions

## Full Plugin (14 commands + 5 skills)

For the complete plugin with all features including RLM Runtime Docker execution, team search, shared standards, trajectory visualization, and more:

```
/plugin marketplace add alopez3006/snipara-claude
/plugin install snipara@snipara-plugins
```

## Links

- [Snipara Website](https://snipara.com)
- [Full Plugin Repository](https://github.com/alopez3006/snipara-claude)
- [Documentation](https://github.com/alopez3006/snipara-claude/tree/main/docs)
- [RLM Runtime](https://github.com/recursal/rlm-runtime)
