---
name: business-agent
description: >
  Use this skill when the user is working in or asking about the business-agent/ directory,
  editing business-agent.agent.yaml or business-agent.environment.yaml, running managed-agent
  sessions, or debugging Claude Agent SDK session/vault/resource setup.
---

# Business Agent

The business-agent is a Claude-managed agent that scans GitHub repositories for open issues
and opens fix PRs. It runs via the Claude Agent SDK.

## Key Files

| File | Purpose |
|------|---------|
| `business-agent.agent.yaml` | Agent definition (model, tools, MCP servers, skills) |
| `business-agent.environment.yaml` | Runtime environment (compute, mounts, timeouts) |
| `setup.sh` | One-time setup — creates agent + environment on the platform, writes IDs to `.env` |
| `run_agent.py` | Triggers a full run against the created agent/environment |
| `requirements.txt` | Python deps (`anthropic` SDK) |
| `.env` | **Not committed** — holds `AGENT_ID` and `ENV_ID` written by setup.sh |

## Required Environment Variables for `run_agent.py`

| Var | Source |
|-----|--------|
| `AGENT_ID` | Written to `.env` by `setup.sh` |
| `ENV_ID` | Written to `.env` by `setup.sh` |
| `GITHUB_TOKEN` | Personal access token (Contents read+write) for repo cloning and push |
| `GITHUB_MCP_TOKEN` | OAuth token for the GitHub Copilot MCP endpoint (scopes: `repo`, `issues`, `pull_requests`) |

## Updating the Agent After YAML Changes

After editing `business-agent.agent.yaml`, deploy the new version with:

```bash
source .env
ant beta:agents update --agent-id "$AGENT_ID" < business-agent.agent.yaml
```

Do **not** re-run `setup.sh` — that creates a new agent/environment and overwrites `.env`.

## Repositories the Agent Monitors

- `sjbrenchley89/claude-code`
- `sjbrenchley89/source-build-au`
- `sjbrenchley89/windows-mcp`
- `sjbrenchley89/ruflo`
- `sjbrenchley89/tailscale`

## Session Output

After each run, outputs (including `digest.md`) are written to `/mnt/session/outputs/` and
downloaded by `run_agent.py` to the local working directory.
