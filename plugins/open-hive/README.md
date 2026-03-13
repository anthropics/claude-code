# Open Hive

**Developer collision detection for AI-assisted teams.**

When multiple developers (or Claude Code Agent Teams teammates) work on the same codebase, Open Hive passively detects overlapping work and alerts before conflicts escalate. No workflow changes — hooks fire silently in the background.

## How It Works

Three levels of collision detection run automatically:

| Level | Severity | Detection |
|-------|----------|-----------|
| **L1** | Critical | Two sessions editing the same file |
| **L2** | Warning | Two sessions editing files in the same directory |
| **L3a** | Info | Semantic keyword overlap between developer intents |

When a collision is detected, you see an inline alert like:

> **Heads up** — Alice is also editing `src/auth/login.ts` right now. You might want to sync before continuing.

## Hooks

The plugin registers six hooks that run automatically:

| Hook | Trigger | What It Does |
|------|---------|--------------|
| **SessionStart** | Session opens | Registers you with the backend |
| **UserPromptSubmit** | Every prompt | Captures intent, checks for semantic overlap |
| **PreToolUse** | Before Write/Edit | Checks if someone else is modifying the same file |
| **PostToolUse** | After Write/Edit | Records which files you touched |
| **SessionEnd** | Session closes | Deregisters your session |
| **PreCompact** | Context compaction | Preserves collision awareness across compaction |

All hooks have 3–5 second timeouts and fail silently. If the backend is down, your dev experience is unchanged.

## Commands

| Command | Description |
|---------|-------------|
| `/hive setup` | Configure backend URL and developer identity |
| `/hive status` | Show your active session and any collisions |
| `/hive who` | List all active developers and what they're working on |
| `/hive history` | View recent activity signals for the current repo |

## Setup

### 1. Start the Backend

Open Hive requires a self-hosted backend (Fastify + SQLite, ~30MB Docker image):

```bash
git clone https://github.com/look-itsaxiom/open-hive.git
cd open-hive
docker compose up -d
```

The backend starts on `http://localhost:3000`.

### 2. Configure the Plugin

Run `/hive setup` in any Claude Code session. This saves your config to `~/.open-hive.yaml`:

```yaml
backend_url: http://localhost:3000
identity:
  email: you@company.com
  display_name: Your Name
team: engineering
```

That's it. The plugin works automatically from here.

## Skills Library

The [Open Hive repository](https://github.com/look-itsaxiom/open-hive) includes 12 integration skills that extend the backend:

- **Notifications:** Slack, Microsoft Teams, Discord
- **Auth:** GitHub OAuth, GitLab OAuth, Azure DevOps OAuth
- **Storage:** PostgreSQL (swap SQLite)
- **UI:** Embedded web dashboard
- **Plugin:** MCP Server (6 `hive_*` tools)
- **Detection:** L3b embedding similarity, L3c LLM comparison

Each skill is a self-contained `SKILL.md` that teaches Claude how to add the integration. See [skills/README.md](https://github.com/look-itsaxiom/open-hive/tree/main/skills) for details.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  Developer A        │     │  Developer B        │
│  Claude Code        │     │  Claude Code        │
│  + Open Hive Plugin │     │  + Open Hive Plugin │
└────────┬────────────┘     └────────┬────────────┘
         │  hooks fire passively      │
         ▼                            ▼
┌─────────────────────────────────────────────────┐
│              Open Hive Backend                  │
│         Fastify + SQLite (Docker)               │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Sessions  │  │ Signals  │  │  Collision   │ │
│  │ Registry  │  │  Store   │  │   Engine     │ │
│  └───────────┘  └──────────┘  └──────────────┘ │
└─────────────────────────────────────────────────┘
```

## Links

- **Full repository:** [github.com/look-itsaxiom/open-hive](https://github.com/look-itsaxiom/open-hive)
- **Skills library:** [12 integration skills](https://github.com/look-itsaxiom/open-hive/tree/main/skills)
- **License:** MIT
