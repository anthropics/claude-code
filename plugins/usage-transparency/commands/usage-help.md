---
description: Explain quota, rate-limit, auth, and subscription failure modes in Claude Code
argument-hint: Optional error message to classify
allowed-tools:
  - AskUserQuestion
  - Read
---

# Usage Help

Explain the difference between Claude Code usage-related failures in plain language.

## Goal

When a user says Claude Code "hit a limit" or "stopped working", help them understand which class of problem they are dealing with and what evidence is actually available.

## Classification guide

Use the user's pasted text, screenshots, or description to map to one of these categories:
- If the user provides an image path or screenshot path, inspect it with `Read` before classifying.

1. **Rate limit**
   - Temporary throttling
   - Usually recoverable after a wait period
   - May mention retry delay, too many requests, or a short-term limit

2. **Quota exhausted / usage exhausted**
   - Allowance is consumed
   - Not the same as a burst rate limit
   - Exact remaining amount or reset time may be unavailable in Claude Code

3. **Auth conflict**
   - Logged into the wrong account
   - Stale credentials or OAuth state
   - API key and account context not matching the user’s expectation

4. **Organization disabled / workspace restricted**
   - Access blocked by org/workspace status or policy
   - Often needs admin-side follow-up

5. **Subscription mismatch**
   - Signed in successfully, but the active entitlement path does not match expected plan/model access

## Response format

Always answer with:

```markdown
## What this error means
- **Category:** <category>
- **This usually indicates:** <short explanation>

## What Claude Code can and cannot tell you
- **Can tell locally:** <facts from the user’s message only>
- **Cannot tell locally:** <quota remaining, reset time, backend entitlement details if absent>

## Recommended next step
- <one or two concrete next steps>
```

## Important wording rules

- Explicitly distinguish `rate limit` from `quota exhausted`.
- If the user asks for exact quota numbers and you do not have them, say that clearly.
- If the problem sounds account-related, explain why it is different from quota exhaustion.
- If evidence is ambiguous, say `unknown` instead of guessing.
