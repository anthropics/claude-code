---
name: credit-balance-error
enabled: true
event: stop_failure
pattern: "credit.balance|credit_balance|balance.too.low|insufficient.fund"
action: warn
---

💳 **Credit Balance Too Low**

Your Anthropic API credit balance ran out and Claude Code has stopped.

**Steps to resume:**

1. **Add funds** at https://platform.claude.com/settings/billing
2. **Restart Claude Code** — the balance status is cached locally and will not
   refresh until you start a new session.

If you've already topped up and the error persists:
- Quit Claude Code completely and reopen it.
- Run `claude logout` then `claude login` to reset your credentials.

> **Note:** This is a known issue in older versions of Claude Code. Updating to
> the latest version (`claude update` or reinstall via the installer) includes
> fixes for stale cache behaviour that can cause this error to linger after a
> top-up.
