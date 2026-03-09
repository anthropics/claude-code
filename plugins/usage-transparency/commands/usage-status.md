---
description: Inspect Claude Code usage, quota, and auth signals without inventing unavailable billing data
argument-hint: Optional pasted error message or symptom
allowed-tools:
  - AskUserQuestion
  - Bash
  - Read
---

# Usage Status

Help the user understand *why Claude Code is currently limited* without pretending you have access to billing data that may not exist in the CLI. This plugin command complements built-in `/usage` by adding a troubleshooting interpretation layer from local visible signals.

## Core rules

- Do **not** invent remaining quota, reset times, or subscription entitlements.
- Clearly separate **observed local signals** from **unknown platform-side state**.
- Prefer concrete classification: `rate limit`, `quota exhausted`, `auth conflict`, `organization disabled`, `subscription mismatch`, or `unknown`.
- If a signal is unavailable, say so explicitly.

## Inputs

- User-provided argument: `$ARGUMENTS`
- If the user pasted an error message, treat it as the strongest signal.
- If no error text is provided, gather context interactively.

## Step 1: Collect the minimum context

If `$ARGUMENTS` is empty, use `AskUserQuestion` to gather the current symptom. Ask up to two short questions:

1. **What are you seeing right now?**
   - Rate-limited message
   - Quota / usage exhausted
   - Login / auth problem
   - Organization / workspace access issue
   - Unsure / something else

2. **Where is this happening?**
   - Terminal Claude Code session
   - VS Code Claude session
   - Remote / container / CI
   - Unsure

If the user already pasted a clear error, skip the questions.

## Step 2: Gather local diagnostics

Use these commands when relevant:

1. `claude auth status`
   - Use to determine whether the current session appears authenticated and what auth path is active.

2. `claude doctor`
   - Use to gather CLI environment diagnostics if auth/configuration seems suspicious.

Only run commands that are relevant to the current symptom. Do not run unrelated commands.

## Step 3: Classify the issue

Classify using the strongest evidence available.

### A. Rate limit
Use this category when the error indicates temporary throttling, request rate saturation, or short-term overage handling.

**Explain:**
- This usually means requests are being throttled for a window, not that the account is permanently broken.
- Reset timing may be controlled by the service and may not be visible locally.

**Next steps:**
- Retry after the indicated delay if one exists.
- Reduce concurrent or repeated requests.
- Mention environment-specific follow-up options only if they are explicitly available in the user's setup or pasted error.

### B. Quota exhausted / usage exhausted
Use this category when the error indicates that the current plan, allowance, or usage bucket has been consumed.

**Explain:**
- This differs from rate limiting: the issue is allowance exhaustion, not a short burst throttle.
- Exact remaining quota or reset time may not be available from local CLI signals.

**Next steps:**
- Tell the user whether the CLI exposed any concrete quota or reset data.
- If not, explicitly say: "Claude Code does not expose exact remaining quota from the currently available local signals."
- Mention environment-specific usage or billing follow-up only if it is explicitly relevant to the user’s setup or pasted error.

### C. Auth conflict
Use this category when signs suggest conflicting auth modes, stale login state, expired credentials, or mismatched account context.

**Explain:**
- The problem may come from stale OAuth state, mixed auth methods, or a session bound to a different account than expected.

**Next steps:**
- Use `claude auth status` results if available.
- Tell the user which auth state was confirmed locally and which parts remain unknown.
- Recommend re-authentication only if the observed state supports it.

### D. Organization disabled / workspace access issue
Use this category when the message indicates the organization, workspace, or policy context is preventing access.

**Explain:**
- This is not a normal rate-limit problem.
- The failure is likely due to org state, admin policy, or workspace entitlement.

**Next steps:**
- Say that local CLI tools usually cannot confirm the backend org status directly.
- Recommend checking the active org/account context and escalating to the workspace admin if needed.

### E. Subscription mismatch
Use this category when the user appears signed in, but the active session, model access, or entitlement does not match the expected subscription path.

**Explain:**
- The account may be authenticated, but the active entitlement path may differ from what the user expects.
- Avoid guessing the exact billing reason unless the evidence is explicit.

**Next steps:**
- State any locally observed subscription/auth hints.
- State what remains unknown because it depends on platform-side entitlement logic.

### F. Unknown
If the evidence is weak or contradictory, say so directly and provide the smallest useful next step.

## Step 4: Produce a structured answer

Respond with this structure:

```markdown
## Usage status
- **Classification:** <one category>
- **What Claude Code can confirm locally:** <facts only>
- **What remains unavailable locally:** <unknown billing/quota/reset details>

## Why this is happening
- <1-3 bullets tailored to the category>

## What to do next
- <targeted next steps>
```

## Required distinctions

Be explicit about these differences:
- `rate limit` = temporary throttling window
- `quota exhausted` = allowance consumed
- `auth conflict` = credential/account/session mismatch
- `organization disabled` = admin/org state problem
- `subscription mismatch` = signed in, but entitlement path does not match expectation

## Never do these things

- Do not make up a reset timestamp.
- Do not estimate remaining quota.
- Do not claim backend billing visibility unless the command output explicitly shows it.
- Do not collapse all failures into a generic "usage limit" answer.
