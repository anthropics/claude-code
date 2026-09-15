---
description: Trigger a full business-agent run — scans all monitored repos for open issues and opens fix PRs
argument-hint: (no arguments needed)
---

# Run Business Agent

Trigger a full run of the business-agent session.

## Pre-flight Checks

Before running, verify:

1. `.env` exists in `business-agent/` and contains `AGENT_ID` and `ENV_ID`.
   If missing, tell the user to run `/business-agent:setup` first.

2. The following environment variables are set in the shell:
   - `GITHUB_TOKEN`
   - `GITHUB_MCP_TOKEN`

   If either is missing, explain what each is for and where to get it:
   - `GITHUB_TOKEN`: GitHub Settings → Developer settings → Personal access tokens →
     create with `Contents` read+write scope
   - `GITHUB_MCP_TOKEN`: GitHub Settings → Developer settings → OAuth Apps →
     create app with scopes `repo`, `issues`, `pull_requests` → use the OAuth access token

3. Python deps are installed:
   ```bash
   pip install -r business-agent/requirements.txt
   ```

## Running

```bash
cd business-agent
source .env
python run_agent.py
```

The script prints a platform session URL for live monitoring. It runs a smoke test
first (confirms GitHub MCP connectivity), then executes the full scan-and-fix task.
Outputs (including `digest.md`) are downloaded to the local directory when done.
