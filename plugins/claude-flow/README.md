# Claude-Flow Plugin

AI agent orchestration for Claude Code using [claude-flow](https://github.com/ruvnet/claude-flow) (RuFlo). Coordinate swarms of specialized agents, run hive-mind consensus sessions, and automate complex multi-step workflows.

## Overview

Claude-flow brings enterprise-grade agent orchestration into your Claude Code workflow. Instead of working with a single AI assistant, you can deploy coordinated swarms of specialized agents that work in parallel on complex tasks — each with a defined role, backed by shared memory and fault-tolerant consensus.

## Commands

### `/claude-flow:init`

Initialize claude-flow in the current project.

```bash
/claude-flow:init
/claude-flow:init --sparc   # Initialize with SPARC methodology support
```

Creates configuration files, sets up memory backends, and runs a health check. Run this once per project before using other commands.

### `/claude-flow:swarm`

Launch a coordinated agent swarm to complete an implementation task.

```bash
/claude-flow:swarm Add rate limiting to all API endpoints
/claude-flow:swarm Migrate the test suite from Jest to Vitest
/claude-flow:swarm Implement WebSocket support for real-time notifications
```

Best for: implementation work, refactoring, feature development, and any task with a clear goal where you want parallel agent execution.

### `/claude-flow:hive-mind`

Spawn a queen-led, consensus-based multi-agent system for complex decisions.

```bash
/claude-flow:hive-mind Design the caching strategy for high-traffic endpoints
/claude-flow:hive-mind Should we adopt a monorepo structure?
/claude-flow:hive-mind Review the security model of the user authentication flow
```

Best for: architectural decisions, design trade-offs, security reviews, and any question that benefits from multiple expert perspectives reaching consensus.

## When to Use Each Command

| Situation | Command |
|-----------|---------|
| First time setup | `/claude-flow:init` |
| Build a feature | `/claude-flow:swarm` |
| Refactor code | `/claude-flow:swarm` |
| Choose between approaches | `/claude-flow:hive-mind` |
| Security audit | `/claude-flow:hive-mind` |
| Architecture design | `/claude-flow:hive-mind` |

## Plugin Structure

```
claude-flow/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── commands/
│   ├── init.md              # /claude-flow:init
│   ├── swarm.md             # /claude-flow:swarm
│   └── hive-mind.md         # /claude-flow:hive-mind
└── README.md
```

## Requirements

- Node.js 18+
- `npx` available in your PATH
- Internet access to fetch `claude-flow` via npx (or install globally: `npm install -g claude-flow`)

## Learn More

- [claude-flow on npm](https://www.npmjs.com/package/claude-flow)
- [claude-flow GitHub](https://github.com/ruvnet/claude-flow)
- [Claude Code Plugin Documentation](https://docs.claude.com/en/docs/claude-code/plugins)
