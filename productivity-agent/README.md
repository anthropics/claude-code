# The ONE Thing — Productivity Agent

A serverless AI productivity agent based on **"The One Thing"** by Gary Keller. Every weekday morning it analyzes your Linear tasks and tells you the single most important thing to focus on that day — delivered via Telegram.

> *"What's the ONE Thing I can do such that by doing it everything else will be easier or unnecessary?"*

## How It Works

1. **Every weekday at 8am** (configurable), a Vercel Cron Job triggers the agent
2. It fetches all your assigned, non-completed tasks from Linear
3. Claude AI analyzes them using "The One Thing" methodology — domino effect, urgency vs. importance, leverage
4. You receive a Telegram message with **THE ONE THING** and the reasoning
5. You can reply or tap buttons to dig deeper, push back, or request a refresh

## Architecture

```
Vercel Cron Job (8am weekdays)
         │
         ▼
api/cron/morning.ts ──► Linear API (fetch tasks)
         │                      │
         │               NormalizedIssue[]
         │                      │
         ▼                      ▼
    Anthropic API ◄── src/ai/analyzer.ts (The One Thing prompt)
         │
    Analysis text
         │
         ▼
    Vercel KV ◄── src/conversation/store.ts (persist state)
         │
         ▼
  Telegram Bot API ◄── src/telegram/sender.ts

User replies to Telegram ──► api/webhook.ts ──► Anthropic (follow-up)
```

**Tech stack:** TypeScript · Vercel Serverless Functions · Vercel KV (Redis) · Telegram Bot API · Linear SDK · Anthropic SDK

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** (looks like `123456789:ABCdefGHI...`)
4. Start a conversation with your new bot (send any message)
5. Get your **chat ID**:
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
   Look for `"chat": { "id": 123456789 }` in the response.

### 2. Get a Linear API Key

1. Go to [Linear Settings → API](https://linear.app/settings/api)
2. Under **Personal API Keys**, click **Create key**
3. Copy the key (starts with `lin_api_`)

### 3. Get an Anthropic API Key

1. Go to [Anthropic Console → API Keys](https://console.anthropic.com/settings/keys)
2. Create a new key and copy it

### 4. Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# From the productivity-agent directory
cd productivity-agent
npm install

# Initialize Vercel project
vercel

# Create Vercel KV storage
vercel storage create productivity-kv --type kv

# Set environment variables
vercel env add LINEAR_API_KEY
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_CHAT_ID
vercel env add ANTHROPIC_API_KEY
vercel env add CRON_SECRET

# Deploy
vercel --prod
```

### 5. Register the Telegram Webhook

After deploying, tell Telegram where to send updates:

```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/webhook"
```

You should see `{"ok":true,"result":true}`.

### 6. Test It

Send `/onething` to your Telegram bot to trigger a manual analysis. If it works, the morning cron will handle the rest automatically.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LINEAR_API_KEY` | ✅ | Linear Personal API key |
| `TELEGRAM_BOT_TOKEN` | ✅ | Telegram bot token from BotFather |
| `TELEGRAM_CHAT_ID` | ✅ | Your Telegram user/chat ID |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key |
| `KV_REST_API_URL` | ✅ | Vercel KV REST URL (auto-set when you add KV storage) |
| `KV_REST_API_TOKEN` | ✅ | Vercel KV REST token (auto-set when you add KV storage) |
| `CRON_SECRET` | Recommended | Random string to secure the cron endpoint |
| `CLAUDE_MODEL` | Optional | Claude model ID (default: `claude-sonnet-4-5-20250929`) |
| `TIMEZONE` | Optional | Timezone for display (default: `America/New_York`) |

## Cron Schedule

The morning analysis fires at **8am ET (1pm UTC)** on weekdays. To change the time, edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/morning",
      "schedule": "0 13 * * 1-5"
    }
  ]
}
```

The schedule uses UTC. Common conversions:
- 8am ET = `0 13 * * 1-5`
- 7am PT = `0 15 * * 1-5`
- 8am GMT = `0 8 * * 1-5`

## Bot Commands

| Command | Description |
|---|---|
| `/onething` | Get today's ONE thing (manual trigger) |
| `/tasks` | List your current Linear tasks |
| `/refresh` | Re-fetch tasks from Linear and re-analyze |
| `/reset` | Clear today's conversation context |
| `/help` | Show available commands |

## Inline Buttons

After each analysis, you'll see buttons:

- **Tell me more** — Claude elaborates on the domino effect reasoning
- **Show runner-up** — Explains the second-place task
- **I disagree** — Opens a dialogue to push back with context
- **Refresh** — Re-fetches Linear and runs a fresh analysis

## The One Thing Methodology

The agent encodes these principles from Gary Keller's book:

1. **The Focusing Question** — Every analysis asks: *"What can I do such that by doing it everything else will be easier or unnecessary?"*

2. **The Domino Effect** — One domino can topple another 50% larger. The agent finds the *lead domino* — the task that creates the most downstream leverage.

3. **Urgency vs. Importance** — Due dates alone don't determine priority. A high-priority strategic task beats a low-priority urgent task.

4. **Single focus commitment** — The agent never suggests a list. Exactly one task. Always.

5. **Principled pushback** — If you disagree, Claude engages with your reasoning but stays disciplined unless you present genuinely new information.

## Local Development

```bash
cd productivity-agent
npm install
cp .env.example .env.local
# Fill in .env.local with your keys

# Install Vercel CLI
npm i -g vercel

# Run locally (starts dev server on port 3000)
vercel dev
```

To test the morning cron locally:
```bash
curl http://localhost:3000/api/cron/morning \
  -H "Authorization: Bearer <your-CRON_SECRET>"
```

To test the webhook locally, use [ngrok](https://ngrok.com) to expose your local server:
```bash
ngrok http 3000
# Then set your Telegram webhook to: https://<ngrok-url>/api/webhook
```
