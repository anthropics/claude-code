---
description: Launch a Claude Code Remote Control session to continue your local environment from any browser or mobile device
argument-hint: Optional session name (e.g. "My Project")
allowed-tools: ["Bash", "AskUserQuestion"]
---

# Remote Control Setup and Launch

Start a Claude Code Remote Control session that lets you access your local environment from any browser or the Claude mobile app.

## Your Task

Help the user launch a Remote Control session. Follow these steps:

### Step 1: Check Availability

Run the following to check if Remote Control is available for this account:

```bash
claude remote-control --help 2>&1 || true
```

**If the output contains "not yet enabled":**
- Inform the user that Remote Control requires a paid Claude plan (Pro, Max, Team, or Enterprise)
- Team/Enterprise users: an admin must enable Remote Control at claude.ai/admin-settings/claude-code
- Direct them to upgrade at claude.ai/upgrade if on a free plan
- Show requirements summary (see below) and exit

**If the output does NOT contain an error:**
- Proceed to Step 2

### Step 2: Determine Session Name

If `$ARGUMENTS` is provided, use it as the session name.

If `$ARGUMENTS` is empty, ask the user:
- Question: "What would you like to name this Remote Control session?"
- Hint: "A descriptive name helps identify the session on claude.ai/code and the mobile app"
- Default: the current directory name (`basename $PWD`)

### Step 3: Launch Remote Control

Run the remote control session with the session name:

```bash
claude remote-control --name "SESSION_NAME" 2>&1
```

The command will output a session URL and QR code. Display these prominently for the user.

### Step 4: Confirm and Guide

After launching, tell the user:

1. **To connect from a browser:** Visit the URL shown above at claude.ai/code
2. **To connect from mobile:** Scan the QR code with the Claude iOS/Android app, or open the Sessions list in the app
3. **Multi-device:** You can send messages from the terminal, browser, or phone interchangeably
4. **Reconnection:** If your machine sleeps or network drops, the session reconnects automatically when your machine comes back online

## Requirements Summary

Remote Control requires:
- **Plan:** Claude Pro, Max, Team, or Enterprise subscription
- **Version:** Claude Code v2.1.51 or later (current: run `claude --version`)
- **Auth:** Claude.ai OAuth login (not API key) — run `claude auth status` to check
- **Team/Enterprise only:** Admin must enable Remote Control at claude.ai/admin-settings/claude-code

## Security Notes

- Your machine makes only outbound HTTPS requests — no inbound ports are opened
- All traffic is encrypted with TLS through the Anthropic API
- Your local filesystem, MCP servers, and project configuration remain fully local
