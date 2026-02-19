# The ONE Thing - Productivity Agent

A serverless productivity agent that integrates with **Linear** and **Telegram**, powered by **Claude AI**, deployed on **Vercel**. Based on "The One Thing" by Gary Keller -- it identifies your single most important task each day.

## Architecture Overview

**Serverless on Vercel** means:
- No long-running process (no `node-cron`, no Telegraf long polling)
- Telegram communicates via **webhooks** (POST to your Vercel URL)
- Morning schedule via **Vercel Cron Jobs** (`vercel.json`)
- Conversation state persisted in **Vercel KV** (Redis-based)

## Directory Structure

```
productivity-agent/
├── package.json
├── tsconfig.json
├── vercel.json                       # Cron jobs + routes config
├── .env.example                      # Template for required env vars
├── .gitignore
├── README.md
├── api/
│   ├── webhook.ts                    # Telegram webhook handler (POST /api/webhook)
│   └── cron/
│       └── morning.ts                # Morning analysis (GET /api/cron/morning)
├── src/
│   ├── config.ts                     # Loads & validates env vars
│   ├── types.ts                      # Shared TypeScript interfaces
│   ├── linear/
│   │   ├── client.ts                 # LinearClient initialization
│   │   └── issues.ts                 # Fetch & normalize assigned issues
│   ├── ai/
│   │   ├── prompts.ts                # System prompt + analysis templates ("The One Thing" methodology)
│   │   └── analyzer.ts               # Claude API calls for analysis & follow-up
│   ├── telegram/
│   │   ├── sender.ts                 # Send messages via Telegram Bot API (no Telegraf needed)
│   │   ├── keyboards.ts              # Inline keyboard builders
│   │   └── formatters.ts             # HTML message formatting
│   └── conversation/
│       └── store.ts                  # Vercel KV-backed conversation state
```

## Implementation Steps

### Step 1: Project Scaffolding
- Create `productivity-agent/` directory with `package.json`, `tsconfig.json`, `vercel.json`, `.env.example`, `.gitignore`
- Dependencies: `@anthropic-ai/sdk`, `@linear/sdk`, `@vercel/kv`
- Dev dependencies: `typescript`, `@types/node`, `@vercel/node`

### Step 2: Config & Types (`src/config.ts`, `src/types.ts`)
- Config loads from `process.env` (Vercel environment variables)
- Required: `LINEAR_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- Optional: `CLAUDE_MODEL` (default: `claude-sonnet-4-5-20250929`), `TIMEZONE` (default: `America/New_York`), `CRON_SECRET` (for securing cron endpoint)
- Types: `NormalizedIssue`, `ConversationMessage`, `DailyConversation`

### Step 3: Linear Integration (`src/linear/`)
- `client.ts`: Initialize `LinearClient` with API key
- `issues.ts`: `fetchMyIssues()` function that:
  - Gets authenticated user via `linearClient.viewer`
  - Fetches assigned issues filtered to non-completed/non-canceled
  - Resolves lazy relations (state, project, labels)
  - Returns `NormalizedIssue[]` sorted by priority

### Step 4: AI Analysis Engine (`src/ai/`)
- `prompts.ts`: The core "One Thing" methodology encoded as:
  - System prompt with: focusing question, domino effect analysis, urgency vs importance matrix, goal alignment, leverage evaluation, strict single-focus commitment
  - Analysis template that injects Linear issues and requests structured output (THE ONE THING, WHY/LEAD DOMINO, WHAT THIS MAKES EASIER, RUNNER-UP, FOCUS TIP)
- `analyzer.ts`:
  - `analyzeForOneThing(issues)` - Initial morning analysis
  - `handleFollowUp(history, issues, message)` - Conversational follow-ups with full message history replay

### Step 5: Conversation Store (`src/conversation/store.ts`)
- Uses Vercel KV (Redis) for persistence across serverless invocations
- Key pattern: `conversation:YYYY-MM-DD` for daily conversations
- Operations: `startNewDay()`, `addMessage()`, `getToday()`, `getMessages()`, `getIssues()`, `reset()`
- Auto-expires old entries after 7 days (Redis TTL)

### Step 6: Telegram Integration (`src/telegram/`)
- `sender.ts`: Direct Telegram Bot API calls via `fetch()` (no Telegraf -- too heavy for serverless)
  - `sendMessage(chatId, text, options)` - supports HTML parse mode and inline keyboards
  - `answerCallbackQuery(callbackId)` - acknowledge button presses
- `keyboards.ts`: Inline keyboard builders
  - Post-analysis: [Tell me more] [Show runner-up] / [I disagree] [Refresh]
- `formatters.ts`: HTML formatting for Telegram messages

### Step 7: Webhook Handler (`api/webhook.ts`)
- POST endpoint that Telegram sends updates to
- Validates the request (optional secret token)
- Routes by update type:
  - **Commands**: `/start`, `/onething`, `/tasks`, `/refresh`, `/reset`, `/help`
  - **Text messages**: Treated as follow-up conversation -- sent to Claude with full history
  - **Callback queries**: Handle inline keyboard button presses
- Security: Validates `TELEGRAM_CHAT_ID` to ensure only the authorized user can interact

### Step 8: Morning Cron (`api/cron/morning.ts`)
- GET endpoint triggered by Vercel Cron Job
- Validates `CRON_SECRET` header for security
- Workflow: fetch Linear issues -> Claude analysis -> store in KV -> send Telegram message
- Handles edge cases: no issues, API failures, message too long

### Step 9: Vercel Configuration (`vercel.json`)
- Cron job: `0 13 * * 1-5` (8am ET = 1pm UTC, weekdays)
- Route webhook endpoint

### Step 10: README & Setup Instructions
- How to create a Telegram bot via BotFather
- How to get `TELEGRAM_CHAT_ID`
- How to get a Linear Personal API key
- Vercel deployment with `vercel env` for secrets
- Setting the Telegram webhook URL: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<VERCEL_URL>/api/webhook`

## Key Design Decisions

1. **No Telegraf** - Direct Telegram API via `fetch()`. Telegraf's middleware model is designed for long-running bots, not serverless functions. Direct API calls are simpler and faster for cold starts.

2. **Vercel KV for state** - Conversation context must persist across serverless invocations. Vercel KV (backed by Upstash Redis) is the simplest option with zero setup.

3. **HTML parse mode** - Telegram's MarkdownV2 escaping is error-prone. HTML is more reliable and predictable.

4. **Full history replay** - Each Claude API call includes the full conversation history (synthetic issue context + all prior messages). This is necessary because the Messages API is stateless.

5. **Single-user design** - Chat ID validation ensures only one authorized user. No multi-tenancy complexity.
