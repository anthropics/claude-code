# Claude Code — Architecture Overview

> Community-contributed analysis of Claude Code's internal architecture.

For the full detailed analysis, see [SOURCE_ARCHITECTURE_ANALYSIS.md](SOURCE_ARCHITECTURE_ANALYSIS.md).

## High-Level Architecture

Claude Code is built with TypeScript + React (Ink) for terminal rendering. Key architectural layers:

### Core Engine
- **QueryEngine** — Orchestrates the conversation loop: user input → context assembly → API call → tool execution → response rendering
- **Tool System** — 40+ tools for file ops, shell execution, web search, MCP integration
- **Task System** — Sub-agent orchestration for parallel work across complex tasks
- **Command System** — 100+ slash commands for workflows (commit, review, debug, etc.)

### Infrastructure
- **State Management** — Zustand-style store + React Context
- **Bridge System** — Desktop/mobile remote control via WebSocket
- **Plugin & Skills** — User-defined extensions loaded from `.claude/` directories
- **MCP Integration** — Model Context Protocol for extensible server-side tools

### Key Design Patterns
- **Hybrid rendering** — React (Ink) for terminal UI with incremental updates
- **Tool-call loop** — LLM requests tools → engine executes → results fed back
- **Permission model** — Layered approval system (auto, ask, deny) per tool
- **Context budget** — Dynamic token allocation across system prompt, user context, and tool results

## Contributing

This analysis is community-maintained. If you find inaccuracies or want to expand a section, PRs are welcome.
