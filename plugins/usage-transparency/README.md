# Usage Transparency Plugin

Add clearer, repeatable troubleshooting for Claude Code usage failures without pretending the CLI has backend billing visibility.

## Installation and availability

This plugin lives in the Claude Code repository as an example plugin. Its commands are not core built-in commands in this repo by default; they are available only when this plugin is installed or enabled through the normal Claude Code plugin workflow.

To use it in a project, install or copy the plugin following your normal Claude Code plugin workflow.

## Why this plugin exists

A common Claude Code failure mode is not just "being limited" — it is **not knowing what kind of limit or access problem happened**.

Users often need to distinguish between:

- **Rate limit**: temporary throttling or retry window
- **Quota exhausted**: the current allowance is consumed
- **Auth conflict**: stale credentials, wrong account, or mismatched auth path
- **Organization disabled**: org/workspace state blocks access
- **Subscription mismatch**: signed in, but the active entitlement path does not match expectations

This plugin adds slash commands that focus on **classification, visible local signals, and next-step guidance**.

## What this plugin does

### `/usage-status`

Provides a structured diagnosis flow for current usage/access problems.

It is designed to:
- classify the failure mode
- use local diagnostics only when relevant
- clearly separate **known local facts** from **unknown platform-side billing state**
- avoid fake quota estimates or invented reset times

When useful, it can inspect:
- `claude auth status`
- `claude doctor`
- the exact error text pasted by the user

Example invocation:

```text
/usage-status I keep getting "rate limited, try again later" in the terminal
```

### `/usage-help`

Explains what a reported error *means* and how it differs from similar errors.

Use it when the user already has an error message and mainly needs interpretation.

Example invocation:

```text
/usage-help You do not have access to this organization
```

## Design principles

### 1. Do not invent billing data

If Claude Code does not expose exact remaining quota, reset time, or entitlement state in the current environment, say so explicitly.

Good wording:

> Claude Code does not expose exact remaining quota from the currently available local signals.

Avoid:
- guessed reset timestamps
- rough percentage estimates
- vague answers that collapse everything into "usage limit"

### 2. Keep categories distinct

The plugin intentionally separates:

| Category | Meaning | Typical next step |
|---|---|---|
| Rate limit | Temporary throttling window | Retry later, reduce burstiness, inspect retry hint |
| Quota exhausted | Allowance consumed | Check whether any quota/reset info is actually visible; avoid guessing |
| Auth conflict | Session/account mismatch | Inspect auth status and active account context |
| Organization disabled | Admin or workspace state issue | Confirm org context and escalate to admin if needed |
| Subscription mismatch | Signed in, but entitlement path differs from expectation | Check auth path, account context, and entitlement assumptions |

### 3. Separate repository scope from platform scope

This repository can improve **guidance and diagnostics workflows**.

It cannot, by itself, guarantee access to:
- exact quota remaining
- quota reset timestamps
- backend billing breakdowns
- authoritative subscription entitlement APIs

Those are platform-side capabilities.

## Example outcomes

### Example: rate limit

```markdown
## Usage status
- **Classification:** rate limit
- **What Claude Code can confirm locally:** the error indicates temporary throttling
- **What remains unavailable locally:** exact backend capacity policy and future reset timing

## Why this is happening
- The current request pattern hit a temporary throttle window.
- This differs from an exhausted usage bucket.

## What to do next
- Retry after the indicated delay if one was shown.
- Reduce repeated or concurrent requests.
```

### Example: quota exhausted

```markdown
## Usage status
- **Classification:** quota exhausted
- **What Claude Code can confirm locally:** the current allowance appears consumed
- **What remains unavailable locally:** exact remaining quota and reset timestamp

## Why this is happening
- This looks like allowance exhaustion rather than a short-term rate throttle.

## What to do next
- Check whether the current environment exposes any concrete quota details.
- If not, say so explicitly instead of estimating.
```

### Example: auth conflict

```markdown
## Usage status
- **Classification:** auth conflict
- **What Claude Code can confirm locally:** authentication state can be inspected locally
- **What remains unavailable locally:** backend entitlement decisions unless explicitly exposed

## Why this is happening
- The session may be using a different auth path or stale credentials.

## What to do next
- Inspect `claude auth status`.
- Re-authenticate only if the observed state supports that conclusion.
```

## Commands summary

- `/usage-status` — diagnose current usage, quota, and auth symptoms
- `/usage-help` — explain a pasted error and clarify what it does and does not mean
