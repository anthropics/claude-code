---
name: connect-telegram
description: "Connect Telegram to an existing Orchestrator. Guides through bot creation via BotFather, bot_token input, and long-polling connection test. Run with /connect-telegram. Use for requests like 'connect telegram', 'add telegram channel'."
---

# Connect Telegram Channel

Connects a Telegram channel to an already-installed Orchestrator.

## Flow

### Step 1: Verify Orchestrator

Check orchestrator.yaml exists. If not → redirect to /setup-orchestrator.

### Step 2: Telegram Bot Guide

If no credentials found:

```
Telegram Bot Setup:
1. Open Telegram, search for @BotFather
2. Send /newbot
3. Choose a name for your bot (e.g., "My Orchestrator Bot")
4. Choose a username (must end in "bot", e.g., "my_orchestrator_bot")
5. BotFather will give you a bot token like: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
6. Copy the entire token
```

### Step 3: Collect Credentials

```
bot_token: (the token from BotFather)
allowed_users: (optional, comma-separated Telegram usernames or user IDs)
```

### Step 4: Save & Configure

1. Create ARCHIVE_PATH/telegram/credentials
2. Update orchestrator.yaml: channels.telegram.enabled = true
3. No extra dependencies needed (uses aiohttp)

### Step 5: Test

1. Restart orchestrator
2. Check logs for "Telegram channel starting (bot: @...)"
3. Send a message to the bot on Telegram
4. Verify the confirm/cancel flow works

## Credential File Format

```
bot_token : 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
allowed_users : username1, username2
```

## Rules

- The allowed_users field is optional. Empty = allow all users.
- Bot token contains a colon — the credential parser splits on " : " (space-colon-space), so this is safe.
