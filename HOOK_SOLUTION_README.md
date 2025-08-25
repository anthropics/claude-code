# Claude Code Security Hook for Issue #2695

**Client-side secret detection to prevent transmission of sensitive data**

## Overview

This hook addresses GitHub Issue #2695 by implementing client-side secret detection in Claude Code. When secrets are detected in tool inputs, the hook blocks execution and provides clear feedback to users.

## How It Works

1. **Pre-execution Analysis**: Hook analyzes all tool calls before execution
2. **Secret Detection**: Pattern matching for API keys, database URLs, sensitive environment variables
3. **Execution Blocking**: Prevents transmission by exiting with code 2
4. **User Feedback**: Clear explanation of what was detected and how to fix
5. **Audit Logging**: Complete compliance trail for enterprise use

## Installation

### Step 1: Install the Hook

```bash
# Copy the hook to Claude Code hooks directory
cp secret_detection_hook.py ~/.claude-code/hooks/
chmod +x ~/.claude-code/hooks/secret_detection_hook.py
```

### Step 2: Configure Claude Code

Add to your `~/.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.claude-code/hooks/secret_detection_hook.py"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Verify Installation

Test with a command containing secrets:

```bash
# This should be blocked:
echo $API_KEY

# Expected output:
# 🔒 CLAUDE CODE SECURITY ALERT
# ⚠️  Secrets detected in tool usage!
# Detected secrets:
#   • SENSITIVE_ENV_VAR: $API_KEY
```

## What Gets Detected

### Secret Patterns
- **OpenAI API Keys**: `sk-[a-zA-Z0-9]{40,}`
- **Anthropic API Keys**: `sk-ant-[a-zA-Z0-9_-]{95,}`
- **GitHub Tokens**: `ghp_[A-Za-z0-9]{36}`
- **AWS Credentials**: `AKIA[0-9A-Z]{16}` and secret key patterns
- **Database URLs**: PostgreSQL, MySQL, MongoDB, Redis connection strings
- **JWT Tokens**: Standard JWT format
- **Generic Secrets**: 32+ character alphanumeric patterns

### Sensitive Environment Variables
Variables containing these keywords are flagged:
- `API_KEY`, `SECRET`, `PASSWORD`, `TOKEN`
- `DATABASE_URL`, `DB_PASSWORD`, `REDIS_URL`
- `AWS_SECRET`, `AZURE_CLIENT`, `GOOGLE_CLIENT`
- `PRIVATE_KEY`, `CREDENTIAL`, `SESSION_SECRET`

### Sensitive Files
Reading files with these patterns triggers alerts:
- `.env` files
- Files containing `secret`, `config`, `credential` in path

## User Experience

### When Secrets Are Detected
```
🔒 CLAUDE CODE SECURITY ALERT
==================================================
⚠️  Secrets detected in tool usage!

Detected secrets:
  • OPENAI_API_KEY: sk-test123...
  • SENSITIVE_ENV_VAR: $DATABASE_URL

🛡️  Zero-trust policy prevents transmission of secrets to AI systems.

To proceed:
1. Remove or mask sensitive values
2. Use environment variables safely (avoid echoing secrets)
3. Consider using placeholder values for demonstration

📝 Detection logged to: ~/.claude-code-security/secret_detections.jsonl
```

### When Commands Are Safe
Safe commands execute normally with no interruption.

## Audit Trail

All secret detections are logged to `~/.claude-code-security/secret_detections.jsonl`:

```json
{
  "timestamp": "2025-08-15T01:59:09.495723Z",
  "tool": "Bash",
  "command_hash": 46068657,
  "secrets_detected": 1,
  "secret_types": ["SENSITIVE_ENV_VAR"],
  "blocked": true
}
```

## Enterprise Features

### Compliance Ready
- **Complete audit trail** for regulatory requirements
- **Privacy-preserving logging** (hashes instead of actual secrets)
- **Tamper-evident records** with timestamps and tool information

### Configuration Options
- **Per-tool sensitivity** adjustments
- **Custom secret patterns** for organization-specific needs
- **Allowlist support** for known-safe patterns

## Issue #2695 Requirements

✅ **Client-side secret detection**: Pattern recognition before transmission  
✅ **Pre-transmission replacement**: Blocks execution instead of transmitting  
✅ **Local resolution only**: User fixes locally and retries  
✅ **Enterprise compliance**: Complete audit trail  

## Security Properties

- **Fail-open design**: Errors allow execution (never break workflows)
- **Privacy preserving**: No actual secrets logged, only metadata
- **Zero dependencies**: Pure Python, works with any Claude Code installation
- **Non-intrusive**: No modification to Claude Code required

## Troubleshooting

### Hook Not Running
1. Verify `secret_detection_hook.py` is executable
2. Check Claude Code configuration syntax
3. Test hook manually: `echo '{"tool": "Bash", "input": {"command": "echo test"}}' | python3 secret_detection_hook.py`

### False Positives
1. Review detection patterns in the hook
2. Add specific patterns to allowlist (customize the script)
3. Use placeholder values for demonstrations

### Audit Log Issues
1. Ensure `~/.claude-code-security/` directory exists
2. Check write permissions
3. Review log format for compliance requirements

---

**This hook provides immediate protection for Issue #2695 while maintaining Claude Code's usability and performance.**