# business-agent plugin

Manages the `business-agent/` managed-agent lifecycle within Claude Code.

## What it does

The business-agent is a Claude-managed agent (claude-opus-4-7) that scans GitHub repositories
for open issues and opens fix PRs automatically. This plugin provides Claude Code integration
for setting up, running, and maintaining it.

## Commands

| Command | Description |
|---------|-------------|
| `/business-agent:setup` | One-time setup — registers agent + environment on the platform, writes IDs to `.env` |
| `/business-agent:run` | Trigger a full scan-and-fix run across all monitored repos |
| `/business-agent:update` | Deploy updated `business-agent.agent.yaml` without recreating the agent |

## Agents

**`business-agent-ops`** — Invoked automatically when diagnosing failures, validating YAML,
or inspecting run outputs. Also available explicitly when you need expert help with the
agent lifecycle.

## Skill

**`business-agent`** — Loaded automatically when you're working in `business-agent/` or
asking about managed agents, sessions, or the Agent SDK setup. Provides reference for
required env vars, file layout, and update procedures.

## Hook

A `PostToolUse` hook watches for edits to `business-agent.agent.yaml` and reminds you to
run `/business-agent:update` to deploy the changes.

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | PAT with `Contents` read+write (for repo cloning/push) |
| `GITHUB_MCP_TOKEN` | OAuth token for GitHub Copilot MCP (scopes: `repo`, `issues`, `pull_requests`) |

`AGENT_ID` and `ENV_ID` are written to `business-agent/.env` by `/business-agent:setup`.
