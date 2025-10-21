# API Fallback Plugin

Quick commands for switching between Claude Pro/Max subscription and API key billing when you hit usage limits.

## Overview

This plugin provides manual switching between authentication methods - a workaround for [issue #2944](https://github.com/anthropics/claude-code/issues/2944) until automatic fallback is built into the core CLI.

If you're a Pro/Max user who hits usage limits, you currently have to remember to use `/login` and manually switch. This plugin makes it easier with dedicated commands.

## Commands

### `/switch-to-api`

Switch from your Pro/Max subscription to API key billing.

**When to use:**
- You've hit your subscription usage limits
- You want to continue working immediately
- You have an API key set up

**What it does:**
Guides you through running `/login` and selecting the API Key option.

**Requirements:**
- An Anthropic API key (get one at https://console.anthropic.com/)
- Can set `ANTHROPIC_API_KEY` environment variable

### `/switch-to-subscription`

Switch from API key back to your Pro/Max subscription.

**When to use:**
- Your subscription limits have reset
- You want to use subscription instead of paying per token
- You're switching back after using API billing

**What it does:**
Guides you through running `/login` and selecting your Pro or Max subscription.

**Requirements:**
- Active Claude Pro or Max subscription

### `/fallback-status`

Check your current authentication configuration and see what fallback options you have available.

**What it shows:**
- Whether you have `ANTHROPIC_API_KEY` configured
- Available authentication methods
- How to set up both methods for quick switching

## Setup

To have both subscription and API key available for quick switching:

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Add to your shell profile to persist
echo 'export ANTHROPIC_API_KEY="your-api-key"' >> ~/.bashrc
```

Then use `/login` to choose which method to use. Switch between them anytime.

## Workflow Example

```bash
# Working on a project with Pro subscription
# ...hit usage limits...

/switch-to-api
# Follow the prompts to switch to API billing
# Continue working

# Later, when subscription resets
/switch-to-subscription
# Switch back to subscription
```

## Limitations

This is a **manual workaround** only. It doesn't automatically detect limits or switch authentication - it just guides you through the existing `/login` command.

For automatic fallback, see [issue #2944](https://github.com/anthropics/claude-code/issues/2944).

## Why This Exists

Many users don't know about the `/login` command for switching authentication mid-session. This plugin makes it more discoverable when you hit usage limits.

## Feedback

Comment on [issue #2944](https://github.com/anthropics/claude-code/issues/2944) if you have suggestions.

## Author

Nicholas Ferraz

## Version

1.0.0
