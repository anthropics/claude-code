# Claude Tunnels Plugin

Route tasks from Slack, Telegram, or Microsoft Teams to the right project, execute in dependency-aware phases, and get structured results back — all through isolated Claude sessions.

## Overview

Claude Tunnels creates a **Project Orchestrator (PO)** layer on top of Claude Code. Send a natural-language message from any supported channel — the orchestrator identifies the target project, builds a phased execution plan, and delegates each task to a fresh, isolated Claude session scoped to that workspace's `.claude/` context.

One channel connection scales to unlimited projects and workspaces.

## Commands

### `/setup-orchestrator`

Full installation wizard that configures the orchestrator runtime.

**What it does:**
1. Detects your environment (projects root, Python version)
2. Installs Python dependencies
3. Generates `orchestrator.yaml` configuration
4. Creates startup script and CLAUDE.md templates
5. Offers to connect channel adapters

**Usage:**
```bash
/setup-orchestrator
```

### `/connect-slack`

Adds a Slack channel adapter using Socket Mode.

**What it does:**
1. Guides you through Slack app creation
2. Stores credentials securely in ARCHIVE directory
3. Enables the Slack adapter in orchestrator.yaml

**Usage:**
```bash
/connect-slack
```

### `/connect-telegram`

Adds a Telegram channel adapter using long-polling.

**Usage:**
```bash
/connect-telegram
```

### `/connect-teams`

Adds a Microsoft Teams channel adapter using Bot Framework.

**Usage:**
```bash
/connect-teams
```

### `/setup-remote-project`

Deploys a lightweight HTTP listener on a remote host via SSH for remote workspace execution.

**Usage:**
```bash
/setup-remote-project
```

### `/setup-remote-workspace`

Connects a Kubernetes pod workspace via kubectl.

**Usage:**
```bash
/setup-remote-workspace
```

## How It Works

### Architecture

```
User Message (Slack / Telegram / Teams)
    |
    v
ConfirmGate (user confirms before execution)
    |
    v
Router (Sonnet) --> identify target project(s)
    |
    v
Project Orchestrator (Opus) --> read CLAUDE.md --> build phased plan
    |
    v
Executor
  Phase 1 (parallel) --> session(cwd=ws-a/), session(cwd=ws-b/)
    |
    v  [collect upstream context]
  Phase 2 (sequential) --> session(cwd=ws-c/, upstream_context)
    |
    v
Task Logger (.tasks/ with 30-day retention)
    |
    v
Formatted results --> Channel
```

### Key Concepts

- **Micro-Agent Architecture (MAA)**: Each workspace runs in its own isolated Claude session with its own `.claude/` context — no shared state, no context bleed
- **Phased Execution**: Independent workspaces run in parallel within a phase; dependent workspaces wait for upstream results
- **ConfirmGate**: Users must confirm before any execution begins
- **Task Logging**: All executions recorded to `.tasks/` with 30-day retention

### Model Strategy

| Component | Model | Reason |
|-----------|-------|--------|
| Router | Sonnet | Fast project identification |
| Project Orchestrator | Opus | Deep dependency analysis |
| Executor | Default | Full code modification |
| JSON Repair | Haiku | Cost-effective recovery |

## Installation

```bash
# Install the plugin
claude plugin install claude-tunnels

# Run the setup wizard
/setup-orchestrator
```

### Requirements

- Python 3.10+
- Claude Code CLI (in PATH)
- `claude-agent-sdk` (installed automatically)
- Channel credentials (Slack app token, Telegram bot token, or Teams app credentials)

## Comparison with Claude Code Channels

| Feature | Claude Code Channels | Claude Tunnels |
|---------|---------------------|----------------|
| Architecture | Single CLI session | Multi-project orchestration server |
| Session model | Session-bound | Background daemon |
| Multi-project | One session = one project | Routes to any project in parallel |
| Workspace isolation | Shared session | Fresh session per workspace |
| Scalability | Single project | Unlimited projects & workspaces |
| Supported channels | Telegram, Discord | Slack, Telegram, Teams |
| Task logging | None | `.tasks/` with 30-day retention |
| Remote workspaces | Not possible | SSH/kubectl listeners |
| Security | Sender allowlist | XML tag isolation + path traversal prevention |

## Security

- XML tag isolation: user input wrapped in `<user_message>` tags
- Path traversal prevention: workspace names validated
- Prompt injection defense: instructions inside tags are never followed
- Context sanitization: downstream context limited to 1000 chars
- Workspace isolation: each session runs in separate cwd
- Credential storage: ARCHIVE/ directory (never committed)

## Author

Claude Tunnels (https://github.com/matteblack9/claude-code-tunnels)

## License

MIT

## Version

1.1.0
