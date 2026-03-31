---
name: connect-teams
description: "Connect Microsoft Teams to an existing Orchestrator. Guides through Azure Bot registration, credential input, webhook configuration, and connection test. Run with /connect-teams. Use for requests like 'connect teams', 'add teams channel'."
---

# Connect Teams Channel

Connects a Microsoft Teams channel to an already-installed Orchestrator.

## Prerequisites

- `orchestrator/` directory must exist in the current folder
- `orchestrator.yaml` must exist
- A publicly reachable HTTPS URL for the bot webhook endpoint

## Flow

### Step 1: Verify Orchestrator

1. Check `orchestrator.yaml` exists in current directory
2. Load config to find ARCHIVE_PATH
3. If not found -> "Please run /setup-orchestrator first"

### Step 2: Azure Bot Registration Guide

If no credentials found, show the user:

    Azure Bot Setup Guide:
    1. Go to https://portal.azure.com -> Create a resource -> "Azure Bot"
    2. Fill in:
       - Bot handle: choose a unique name
       - Subscription & Resource Group: select yours
       - Pricing: F0 (free) is fine for testing
       - Type of App: Multi Tenant
       - Creation type: "Create new Microsoft App ID"
    3. After creation, go to the Bot resource
    4. Settings -> Configuration:
       - Messaging endpoint: https://YOUR-PUBLIC-HOST:3978/api/messages
       - (You need a public HTTPS URL — use ngrok, Cloudflare Tunnel, or a reverse proxy)
    5. Settings -> Configuration -> "Manage Password" (next to Microsoft App ID)
       - Click "New client secret", copy the Value (this is your app_password)
       - Copy the Application (client) ID (this is your app_id)
    6. Channels -> Microsoft Teams -> Save (enables the Teams channel)
    7. Go to https://teams.microsoft.com -> Apps -> search for your bot name -> Add to a team

### Step 3: Collect Credentials

    app_id      : (Application/client ID from Azure)
    app_password : (Client secret value)
    app_type     : MultiTenant (or SingleTenant if your org requires it)
    allowed_users : (optional, comma-separated Teams user IDs or display names)

### Step 4: Save & Configure

1. Create ARCHIVE_PATH/teams/credentials with the collected values
2. Update orchestrator.yaml: set channels.teams.enabled = true
3. Optionally set channels.teams.port (default 3978)
4. Install dependencies: `pip install botbuilder-integration-aiohttp>=4.14.5`

### Step 5: Networking Check

Before starting, confirm the webhook URL is reachable:

    # If using ngrok for development:
    ngrok http 3978

    # If using Cloudflare Tunnel:
    cloudflared tunnel --url http://localhost:3978

    # The messaging endpoint in Azure Bot config must match:
    # https://YOUR-DOMAIN/api/messages

### Step 6: Test

1. Restart orchestrator (or start it): ./start-orchestrator.sh --fg
2. Check logs for "Teams channel started on port 3978"
3. In Microsoft Teams, go to a channel where the bot is added
4. @mention the bot with a test message, e.g.: @OrchestratorBot hello
5. Verify the confirm/cancel flow works

If no response:
- Check orchestrator logs for errors
- Verify the messaging endpoint URL in Azure Bot settings
- Verify the HTTPS tunnel is running
- Verify the bot is added to the Teams channel

## Credential File Format

    app_id : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    app_password : your-client-secret-value
    app_type : MultiTenant
    allowed_users : User One, User Two

## Rules

- If orchestrator not installed, redirect to /setup-orchestrator
- Never overwrite existing credentials without confirmation
- The webhook endpoint MUST be HTTPS — Teams/Bot Framework will not send to HTTP
- If allowed_users is empty, all users in channels where the bot is added can interact
