# Fast Opus 4.5 Model Configuration

## Issue
The standard Opus 4.5 configuration is limited to 200,000 tokens, causing failures with larger contexts.

## Solution: Fast Opus Deployment

### Environment Variable Configuration

To use the fast Opus deployment with extended context length, configure Claude Code with:

```bash
# Set the Opus alias to use the fast deployment
export ANTHROPIC_DEFAULT_OPUS_MODEL="claude-opus-4-5-20251101-fast"
```

### Model String Updates for Fast Deployment

| Platform | Fast Opus 4.5 Model String |
|----------|---------------------------|
| Anthropic API (1P) | `claude-opus-4-5-20251101-fast` |
| AWS Bedrock | `anthropic.claude-opus-4-5-20251101-fast-v1:0` |
| Google Vertex AI | `claude-opus-4-5-fast@20251101` |
| Azure AI Foundry | `claude-opus-4-5-20251101-fast` |

### Context Length Configuration

The fast deployment supports extended context. Configure the context limit:

```bash
# Extended context configuration (up to 1M tokens)
export ANTHROPIC_OPUS_CONTEXT_LIMIT="1000000"
```

### Integration with Migration Tool

When migrating to Opus 4.5 with extended context requirements:

1. Use the fast model strings above instead of standard ones
2. Set the environment variable for Opus alias
3. Configure extended context limit
4. Test with large contexts (>200k tokens)

### VSCode Configuration

For VSCode extension users:

```json
{
  "claude-code.environmentVariables": {
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-5-20251101-fast",
    "ANTHROPIC_OPUS_CONTEXT_LIMIT": "1000000"
  }
}
```

### Verification

Test the configuration with a prompt that exceeds 200k tokens to ensure the error:
```
prompt is too long: 282789 tokens > 200000 maximum
```
is resolved.

## When to Use Fast vs Standard

- **Use Fast**: For large codebases, extensive context analysis, long conversations
- **Use Standard**: For typical development tasks with smaller context requirements

The fast deployment trades some response speed for much higher context capacity.