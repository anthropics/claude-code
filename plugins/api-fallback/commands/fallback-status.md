---
description: Check authentication setup and available fallback options
---

The user wants to understand their current authentication configuration and fallback options.

## What to check

Look for the `ANTHROPIC_API_KEY` environment variable to see if they have API key configured.

Note: We can't directly detect which auth method is currently active - that's determined by what they selected during their last `/login`.

## What to tell them

Explain their setup:
- If `ANTHROPIC_API_KEY` is set, they have API fallback available
- They're currently using whatever method they selected in `/login`
- They can switch anytime using `/login`, `/switch-to-api`, or `/switch-to-subscription`

## Available auth methods

- API Key (via `ANTHROPIC_API_KEY` env var)
- Claude Pro/Max (via browser OAuth)
- AWS Bedrock (via `AWS_BEARER_TOKEN_BEDROCK`)
- Google Vertex AI (via `CLOUD_ML_REGION`)

## Setting up both methods

To have quick fallback available:

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

Then use `/login` to select which method to use. Switch between them anytime.

## Limitations

Currently, switching is manual only. Automatic fallback when hitting usage limits requires core CLI changes - tracked in issue #2944.
