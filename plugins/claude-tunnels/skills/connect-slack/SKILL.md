---
name: connect-slack
description: "Connect Slack to an existing Orchestrator. Guides through Slack App creation, credential input, Socket Mode configuration, and connection test. Run with /connect-slack. Use for requests like 'connect slack', 'add slack channel'."
---

# Connect Slack Channel

Connects a Slack channel to an already-installed Orchestrator.

## Prerequisites

- `orchestrator/` directory must exist in the current folder
- `orchestrator.yaml` must exist

## Flow

### Step 1: Verify Orchestrator

1. Check `orchestrator.yaml` exists in current directory
2. Load config to find ARCHIVE_PATH
3. If not found → "Please run /setup-orchestrator first"

### Step 2: Slack App Guide

If no credentials found, show the user:

```
Slack App Setup Guide:
1. Go to https://api.slack.com/apps → Create New App
2. Choose "From scratch", name your app, select workspace
3. Settings → Socket Mode → Enable Socket Mode
   - Generate app-level token (xapp-...) with connections:write scope
4. Event Subscriptions → Enable Events
   - Subscribe to: message.channels, app_mention
5. OAuth & Permissions → Bot Token Scopes:
   - chat:write, channels:history, app_mentions:read
6. Install App to Workspace
7. Copy the Bot Token (xoxb-...)
```

### Step 3: Collect Credentials

```
app_id:
client_id:
client_secret:
signing_secret:
app_level_token: (xapp-...)
bot_token: (xoxb-...)
```

### Step 4: Save & Configure

1. Create ARCHIVE_PATH/slack/credentials
2. Update orchestrator.yaml: set channels.slack.enabled = true
3. Install dependencies: `pip install slack-bolt slack-sdk`

### Step 5: Test

1. Restart orchestrator
2. Check logs for "Slack channel starting (Socket Mode)..."
3. Instruct user to send a test message in Slack

## Rules

- If orchestrator not installed, redirect to /setup-orchestrator
- Never overwrite existing credentials without confirmation
