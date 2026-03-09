# Usage Transparency Plugin

Add clearer, repeatable troubleshooting for Claude Code usage failures without pretending the CLI has backend billing visibility.

## Installation and availability

This plugin lives in the Claude Code repository as an example plugin. Its commands are not core built-in commands in this repo by default; they are available only when this plugin is installed or enabled through the normal Claude Code plugin workflow.

For a repo-local setup example, copy `plugins/usage-transparency` into your own project's plugin directory (for example, `.claude/plugins/usage-transparency`) and enable it through your normal Claude Code plugin workflow there.

This repository copy is primarily a reference/example; simply cloning this repo does not make `/usage-status` or `/usage-help` available in every Claude Code session.

## Why this plugin exists

A recurring troubleshooting problem in Claude Code is not just "being limited" — it is **not knowing what kind of limit or access problem happened**.

This also reflects recurring public requests for clearer distinction between throttling vs exhausted allowance and for more visible usage signals, including [#25805](https://github.com/anthropics/claude-code/issues/25805), [#21943](https://github.com/anthropics/claude-code/issues/21943), and [#28999](https://github.com/anthropics/claude-code/issues/28999).

When troubleshooting, users need to distinguish between:

- **Rate limit**: temporary throttling or retry window
- **Quota exhausted**: the current allowance is consumed
- **Auth conflict**: stale credentials, wrong account, or mismatched auth path
- **Organization disabled**: org/workspace state blocks access
- **Subscription mismatch**: signed in, but the active entitlement path does not match expectations

This plugin adds slash commands that focus on **classification, visible local signals, and next-step guidance**.

## What this plugin does

These plugin commands do not replace Claude Code's built-in `/usage` command or any backend or future quota API. They provide a consistent interpretation layer for troubleshooting when official visible signals are limited or do not clearly distinguish rate limits, quota exhaustion, and access-path issues.

### Command relationship

| Command | Scope | When to use it |
|---|---|---|
| `/usage` | Built-in Claude Code usage view | Use when you want the official usage information the CLI currently exposes |
| `/usage-help` | Plugin interpretation of a pasted error | Use when you already have an error and want it classified without inventing backend details |
| `/usage-status` | Plugin diagnosis flow for a current symptom | Use when you want step-by-step troubleshooting from local signals |

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

## Publicly verifiable acceptance samples

This section is limited to genuinely public or directly verifiable material. It is not proof of backend billing visibility.

### Public issue evidence

Public issue reports motivating clearer usage differentiation include [#25805](https://github.com/anthropics/claude-code/issues/25805), [#21943](https://github.com/anthropics/claude-code/issues/21943), and [#28999](https://github.com/anthropics/claude-code/issues/28999). Use [#25805](https://github.com/anthropics/claude-code/issues/25805) as the concrete public runtime sample with the verified string `API Error: Rate limit reached`. Treat [#21943](https://github.com/anthropics/claude-code/issues/21943) and [#28999](https://github.com/anthropics/claude-code/issues/28999) as positioning evidence for clearer `/usage` visibility, not as exact runtime error samples.

| Publicly verifiable sample | Expected classification |
|---|---|
| `API Error: Rate limit reached` | `rate limit` |

## Synthetic taxonomy examples

The examples below are synthetic prompt-taxonomy fixtures for maintainers. They are intentionally invented to exercise category boundaries and should not be presented as quotations from public issues.

| Pasted error example | Expected classification |
|---|---|
| `Rate limited, try again in 2 minutes.` | `rate limit` |
| `Usage limit reached for your current plan.` | `quota exhausted` |
| `Your session appears valid, but this workspace was opened under a different account.` | `auth conflict` |
| `Access denied: your organization has been disabled.` | `organization disabled` |
| `You are signed in, but your current subscription does not include access to this model in this workspace.` | `subscription mismatch` |

## Acceptance check

Reviewer checklist:

- For public-facing acceptance checks, use the publicly verifiable sample above and keep public-issue references labeled as evidence rather than exact source strings unless the exact string is verified.
- Use the synthetic taxonomy examples only as invented fixtures for maintainers, not as public evidence.
- Feed each sample above to `/usage-help`.
- Confirm the output includes the expected classification.
- Confirm the output includes `What Claude Code can confirm locally`.
- Confirm the output includes `What remains unavailable locally`.
- Confirm the output does not invent quota or reset numbers.

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

Pasted error input:

```text
Your session appears valid, but this workspace was opened under a different account. Please re-check which account is active.
```

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

### Example: organization disabled

Pasted error input:

```text
Access denied: your organization has been disabled. Contact your workspace administrator.
```

```markdown
## Usage status
- **Classification:** organization disabled
- **What Claude Code can confirm locally:** the pasted error points to an organization or workspace access block
- **What remains unavailable locally:** backend org status details and any admin-side remediation state

## Why this is happening
- This looks like an org or workspace state issue rather than a normal rate or quota limit.

## What to do next
- Confirm the active org or workspace context.
- Escalate to the workspace administrator because local CLI signals usually cannot confirm backend org state directly.
```

### Example: subscription mismatch

Pasted error input:

```text
You are signed in, but your current subscription does not include access to this model in this workspace.
```

```markdown
## Usage status
- **Classification:** subscription mismatch
- **What Claude Code can confirm locally:** the pasted error indicates a signed-in session whose entitlement path does not match the expected access
- **What remains unavailable locally:** the exact platform-side entitlement rule or billing reason unless explicitly exposed

## Why this is happening
- The account appears authenticated, but the active entitlement path differs from the expected subscription or workspace access.

## What to do next
- Check which account and workspace are active.
- State only the locally observed auth or subscription hints, and avoid guessing the backend billing reason.
```

## Maintainer notes

- This is a documentation/prompt-guidance-only example plugin in the repository.
- Keep the default taxonomy at five categories unless Claude Code platform behavior clearly changes.
- If Claude Code later exposes authoritative quota or entitlement signals, revise the examples and the unknown-boundary wording to use those outputs directly.
- If a claim cannot be verified from public documentation or local CLI behavior, write it as unknown instead of inferring it.

## Commands summary

- `/usage-status` — diagnose current usage, quota, and auth symptoms
- `/usage-help` — explain a pasted error and clarify what it does and does not mean
