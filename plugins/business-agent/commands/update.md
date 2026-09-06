---
description: Deploy an updated business-agent.agent.yaml to the platform without recreating the agent
argument-hint: (no arguments needed)
---

# Update Business Agent

Deploy changes to `business-agent.agent.yaml` to the Claude platform.

## When to Use

Use this after editing `business-agent.agent.yaml` — changing the model, adding/removing
tools, MCP servers, or skills. This creates a new agent *version* without changing the
`AGENT_ID`, so existing `.env` values remain valid.

## Steps

1. Confirm changes to `business-agent.agent.yaml` look correct. Show a diff if the file
   was recently edited.

2. Load the IDs from `.env`:
   ```bash
   source business-agent/.env
   ```
   If `.env` does not exist, tell the user to run `/business-agent:setup` first.

3. Deploy the new version:
   ```bash
   ant beta:agents update --agent-id "$AGENT_ID" < business-agent/business-agent.agent.yaml
   ```

4. Confirm success and remind the user the next `/business-agent:run` will use the new version.
