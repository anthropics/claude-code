# Claude Code Security Hooks

This directory contains examples of PreToolUse hooks for enhancing Claude Code security.

## Security Demo Hook

`security_demo.py` - A minimal proof-of-concept hook that demonstrates client-side secret detection addressing Issue #2695.

### Features
- Detects common API keys (OpenAI, Anthropic, AWS) before transmission
- Blocks execution when secrets are found
- Fail-safe design (allows execution on errors)
- 60 lines of code for easy review

### Usage

Add to your Claude Code `settings.json`:

```json
{
  "preToolUseHooks": [
    {
      "path": "./examples/hooks/security_demo.py"
    }
  ]
}
```

### Testing

```bash
# Test with safe command
echo '{"tool_name": "Bash", "tool_input": {"command": "echo hello"}}' | python3 security_demo.py
echo $?  # Should be 0 (allowed)

# Test with secret
echo '{"tool_name": "Bash", "tool_input": {"command": "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890"}}' | python3 security_demo.py
echo $?  # Should be 2 (blocked)
```

## Production Implementation

For enterprise-grade security with Byzantine fault tolerance, tamper-proof audit trails, and comprehensive secret detection, see our full zero-trust security library:

**[zero-trust-ai-security](https://github.com/[username]/zero-trust-ai-security)**

Features:
- 12+ secret types detected
- Byzantine fault tolerance with cryptographic commitments  
- Hash-linked tamper-proof audit trails
- Configurable security levels (fail-safe vs fail-secure)
- Integration with multiple AI platforms
- Enterprise compliance (HIPAA, SOX, PCI DSS)

The security demo hook provides the basic concept. The full library provides production-ready zero-trust architecture.