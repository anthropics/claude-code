# ANT_ONLY_METADATA_USER_ID Implementation Specification

## Overview

This document specifies the implementation of the `ANT_ONLY_METADATA_USER_ID` environment variable feature for Claude Code. This feature allows internal Anthropic jobs (like Claude Oracle, Oncall, Ambient, etc.) to pass custom metadata through Claude Code sessions to the Anthropic API for tracking, rate limiting, and incident triage purposes.

## Background

From the Slack discussion:
- Internal API jobs launched via Claude Code currently lack user metadata showing `job_id` or `username` in `api_usage`
- ~85% of requests from heavy CC users (like Closing The Loop org) have no user_metadata or job identifier
- This metadata is critical for:
  - Managing Internal API rate limits
  - Triaging incidents
  - Setting up alerting that pings the DRI researchers
  - Understanding which jobs are driving token usage

## Requirements

1. **Environment Variable**: Claude Code must read an environment variable called `ANT_ONLY_METADATA_USER_ID`
2. **API Integration**: The value must be passed to all Anthropic Messages API calls in the `metadata.user_id` field
3. **Tree Shaking**: Only Anthropic internal builds should be able to use this feature
4. **Format**: The expected format is a JSON object: `{"user": "<anthropic_username>", "job": "<job_name>"}`
   - Example: `{"user": "tedm", "job": "tedm-1208-mu-g-18x"}`
   - Or: `{"user": "vinke", "job": "claude-oracle:fluorine:vinke"}`

## Implementation

### 1. Environment Variable Reading

In the appropriate configuration/env module (likely `src/config/env.ts` or similar):

```typescript
// Environment variable for Anthropic internal builds only
// This is used to pass job metadata to the API for usage tracking
export function getAntOnlyMetadataUserId(): string | undefined {
  // Only available in Anthropic internal builds
  if (!isAnthropicBuild()) {
    return undefined;
  }
  return process.env.ANT_ONLY_METADATA_USER_ID;
}
```

### 2. API Request Metadata

When constructing API requests to the Anthropic Messages API, add the metadata:

```typescript
// In the API client module (e.g., src/api/anthropic.ts)
import { getAntOnlyMetadataUserId } from '../config/env';

function buildApiRequestMetadata(): Record<string, string> | undefined {
  const metadataUserId = getAntOnlyMetadataUserId();

  if (!metadataUserId) {
    return undefined;
  }

  return {
    user_id: metadataUserId
  };
}

// When creating a message:
const response = await client.messages.create({
  model: selectedModel,
  max_tokens: maxTokens,
  messages: conversationMessages,
  // ... other parameters
  metadata: buildApiRequestMetadata()
});
```

### 3. Tree Shaking for Internal Builds

The feature should be conditionally compiled out for public builds using build-time flags:

```typescript
// Using a build-time constant
declare const __ANT_INTERNAL_BUILD__: boolean;

export function isAnthropicBuild(): boolean {
  // This will be replaced at build time
  // For internal builds: true
  // For public builds: false (and the code will be tree-shaken)
  if (typeof __ANT_INTERNAL_BUILD__ !== 'undefined') {
    return __ANT_INTERNAL_BUILD__;
  }
  return false;
}
```

In the build configuration (esbuild/webpack/rollup):

```javascript
// For public builds:
define: {
  '__ANT_INTERNAL_BUILD__': 'false'
}

// For internal builds:
define: {
  '__ANT_INTERNAL_BUILD__': 'true'
}
```

### 4. Validation (Optional but Recommended)

```typescript
function validateMetadataUserId(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed.user === 'string' && typeof parsed.job === 'string';
  } catch {
    // Also allow simple string format for backward compatibility
    return typeof value === 'string' && value.length > 0;
  }
}

export function getValidatedAntOnlyMetadataUserId(): string | undefined {
  const value = getAntOnlyMetadataUserId();
  if (value && !validateMetadataUserId(value)) {
    console.warn('ANT_ONLY_METADATA_USER_ID has invalid format. Expected JSON: {"user": "...", "job": "..."}');
    return undefined;
  }
  return value;
}
```

## Usage by Internal Services

Services like Claude Oracle should set this environment variable before launching Claude Code sessions:

```python
# In Claude Oracle / coo job code
import os
import json

# Set the metadata before spawning Claude Code
os.environ['ANT_ONLY_METADATA_USER_ID'] = json.dumps({
    "user": username,  # Anthropic username
    "job": job_name    # e.g., "claude-oracle:fluorine:vinke"
})

# Then launch Claude Code session...
```

Or via command line:

```bash
ANT_ONLY_METADATA_USER_ID='{"user":"tedm","job":"tedm-1208-mu-g-18x"}' claude --headless ...
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  COO Job / Oracle / Oncall / etc.                               │
│  Sets: ANT_ONLY_METADATA_USER_ID='{"user":"..","job":".."}'    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Claude Code CLI                                                │
│  Reads: process.env.ANT_ONLY_METADATA_USER_ID                  │
│  Adds to API calls: metadata: { user_id: "..." }               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Anthropic API                                                  │
│  Receives: metadata.user_id in request                         │
│  Stores in: api_usage.metadata_user_id (BigQuery)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BigQuery: anthropic.api_production.api_usage                  │
│  Fields populated:                                              │
│  - metadata_user_id                                            │
│  - device_id (if included)                                     │
│  - claude_code_session_id (if included)                        │
└─────────────────────────────────────────────────────────────────┘
```

## Testing

1. **Unit Tests**:
   - Test that `getAntOnlyMetadataUserId()` returns undefined when env var is not set
   - Test that it returns the value when set (in internal builds)
   - Test validation of JSON format

2. **Integration Tests**:
   - Verify metadata is included in API requests
   - Verify tree-shaking removes the code in public builds

3. **E2E Validation** (after deployment):
   - Run a Claude Code session with the env var set
   - Query BigQuery `anthropic.api_production.api_usage` to verify `metadata_user_id` is populated

## Security Considerations

1. **Internal Only**: The tree-shaking ensures this feature is not available in public builds
2. **No Secrets**: The metadata should not contain sensitive information
3. **Validation**: Input validation prevents injection attacks

## Related Files to Modify (Internal Repo)

Based on patterns in the bundled CLI, likely files to modify:

1. `src/config/env.ts` or similar - Add env var reading
2. `src/api/anthropic.ts` or similar - Add metadata to API requests
3. `build.config.ts` or similar - Add build-time flag for internal builds
4. Tests for the above

## References

- Slack thread: Internal API metadata discussion
- BigQuery tables: `anthropic.api_production.api_usage`, `api_events`
- Anthropic API docs: [Messages API metadata parameter](https://docs.anthropic.com/en/api/messages)
