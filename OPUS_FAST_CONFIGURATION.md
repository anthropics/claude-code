# Opus Fast Model Configuration

## Issue
The "Opus fast" model deployment is currently limited to 200,000 tokens, causing errors like:
```
Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 282789 tokens > 200000 maximum"},"request_id":"req_011CVZ3fj1gSV2ZBzHGVnRrA"}
```

## Solution

### Environment Variable Configuration

Claude Code uses environment variables to control model aliases. To configure the fast Opus deployment with extended context length, set the following environment variable:

```bash
# Configure Opus alias to use the fast deployment with extended context
export ANTHROPIC_DEFAULT_OPUS_MODEL="claude-opus-4-5-20251101-fast"
```

### Extended Context Configuration

The fast Opus deployment should support extended context length beyond the default 200k tokens. The recommended configuration:

```bash
# For environments supporting extended context (up to 2M tokens)
export ANTHROPIC_DEFAULT_OPUS_MODEL="claude-opus-4-5-20251101-fast"
export ANTHROPIC_OPUS_CONTEXT_LIMIT="1000000"  # 1M tokens as intermediate step
```

### VSCode Configuration

For VSCode users wanting to use the fast Opus model, add these to your settings or environment:

```json
{
  "claude-code.environmentVariables": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-20251101-fast",
    "ANTHROPIC_OPUS_CONTEXT_LIMIT": "1000000"
  }
}
```

### Verification

To verify the configuration is working:

1. Check that the environment variable is set:
   ```bash
   echo $ANTHROPIC_DEFAULT_OPUS_MODEL
   ```

2. Test with a large context that previously failed (>200k tokens)

3. Monitor for the absence of "prompt is too long" errors

## Background

Based on internal discussions, the prod fast Opus deployment is available and should:
- Be properly configured in the model selector
- Have awareness of its extended context length
- Support significantly more than the 200k token limit

The current limitation appears to be a configuration issue where Claude Code is not aware of the extended context capabilities of the fast deployment.

## Related Environment Variables

Other relevant environment variables for model configuration:
- `ANTHROPIC_DEFAULT_SONNET_MODEL`: Controls the Sonnet model alias
- `ANTHROPIC_MODEL`: Used for Bedrock configurations
- `ANTHROPIC_SMALL_FAST_MODEL`: Used for fast model configurations

## Status

- [x] Identified the configuration issue
- [x] Documented the solution
- [ ] Verify with Claude Code development team
- [ ] Test in production environment