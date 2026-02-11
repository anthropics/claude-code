---
description: Switch to API key billing when subscription limits are reached
---

The user wants to switch from their Claude Pro/Max subscription to API key billing, likely because they've hit usage limits.

## What to tell them

Guide them through switching authentication:

1. They need to run `/login` to see the authentication selection screen
2. Select "API Key" from the options
3. If they don't have an API key yet, they can get one at https://console.anthropic.com/

Let them know:
- Their current conversation will be preserved
- The switch happens immediately
- API usage is billed per token
- They can switch back anytime using `/login`

## If they need an API key

Point them to:
- Console: https://console.anthropic.com/
- API Keys section to create a new key
- Can set `ANTHROPIC_API_KEY` environment variable for convenience

## Note

Automatic fallback on usage limits isn't available yet - that's being tracked in issue #2944. For now, switching is manual.
