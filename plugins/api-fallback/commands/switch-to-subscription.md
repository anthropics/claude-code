---
description: Switch back to Claude Pro/Max subscription billing
---

The user wants to switch from API key billing back to their Claude Pro or Max subscription.

## What to tell them

Guide them through switching authentication:

1. Run `/login` to see the authentication selection screen
2. Choose "Claude Pro" or "Claude Max" depending on their subscription
3. Complete the browser OAuth flow when it opens
4. Authorize Claude Code to use their subscription

Let them know:
- Their current conversation will be preserved
- The switch happens immediately
- Usage will count toward subscription limits (not API)
- They can switch back to API anytime

## If they don't have a subscription

Point them to https://claude.ai/settings/account to subscribe to Pro or Max.

## Note

If they hit subscription limits again, they'll need to manually switch back to API using `/login` or `/switch-to-api`. Automatic fallback is tracked in issue #2944.
