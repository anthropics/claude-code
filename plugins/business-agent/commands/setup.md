---
description: First-time setup — create the business-agent agent and environment on the Claude platform, then write IDs to .env
argument-hint: (no arguments needed)
---

# Business Agent Setup

Run the one-time setup script to register the agent and environment on the Claude platform.

## Steps

1. Confirm the user is in the `business-agent/` directory (or offer to cd there).

2. Check that `.env` does **not** already exist. If it does, warn the user:
   > `.env` already exists with AGENT_ID and ENV_ID. Re-running setup will create NEW
   > agent and environment objects, overwriting the existing IDs. Are you sure?
   Only proceed if they confirm.

3. Run the setup script:
   ```bash
   cd business-agent && bash setup.sh
   ```

4. Verify `.env` was created and contains both `AGENT_ID` and `ENV_ID`. Show the user the
   values (without exposing secrets — the IDs are not sensitive).

5. Remind the user that three env vars must be exported before running:
   ```
   GITHUB_TOKEN      — PAT with Contents read+write
   GITHUB_MCP_TOKEN  — OAuth token for GitHub Copilot MCP (scopes: repo, issues, pull_requests)
   ```
