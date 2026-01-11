---
description: Configure OpenAI Codex authentication
allowed-tools: [
  "mcp__codex__codex_status",
  "mcp__codex__codex_login",
  "mcp__codex__codex_set_api_key",
  "AskUserQuestion"
]
---

## Your task

Configure OpenAI Codex authentication.

**CRITICAL: Your FIRST action MUST be to use AskUserQuestion to ask the user which authentication method they prefer. Do NOT call any other tool first.**

### Step 1: Ask User for Authentication Method (MANDATORY FIRST STEP)

Use AskUserQuestion IMMEDIATELY with these exact options:

```
Question: "How would you like to authenticate with OpenAI Codex?"
Header: "Auth"
Options:
1. "ChatGPT Subscription (Recommended)" - "Sign in with Plus/Pro/Team/Enterprise via browser OAuth"
2. "API Key" - "Enter your OpenAI API key (sk-...) for usage-based billing"
```

Wait for the user's selection before proceeding.

### Step 2: Execute Based on User Selection

**If user chose "ChatGPT Subscription":**
1. Call `codex_login` to start OAuth browser flow
2. User will authenticate in browser
3. Call `codex_status` to verify success

**If user chose "API Key":**
1. Ask user to provide their API key (starts with "sk-")
2. Call `codex_set_api_key` with the provided key
3. Call `codex_status` to verify success

**If user chose "Other" and provided custom input:**
- If it looks like an API key (starts with "sk-"), use `codex_set_api_key`
- Otherwise, clarify what they want

### Important

- ChatGPT Subscription uses OAuth and works with Plus/Pro/Team/Enterprise plans
- API Key uses direct OpenAI API with usage-based billing
- Both methods are valid - user preference determines which to use
