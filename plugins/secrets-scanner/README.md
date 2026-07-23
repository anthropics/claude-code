# Secrets Scanner Plugin for Claude Code

Real-time detection of exposed secrets, API keys, and credentials in Claude Code output. Warns users immediately when sensitive data is detected to prevent accidental exposure.

## Why This Plugin?

Claude Code can read files, execute commands, and display their output. When working with configuration files, environment variables, or logs, sensitive credentials may be inadvertently exposed in:

- Terminal output (visible to anyone watching)
- Terminal history (persisted in shell history files)
- Claude's cached tool results (`~/.claude/projects/*/tool-results/`)
- Screen recordings or screenshots

This plugin provides defense-in-depth by scanning all tool output for secret patterns and alerting you immediately.

**Addresses Issues:**
- [#18223](https://github.com/anthropics/claude-code/issues/18223) - Claude displayed sensitive .env credentials
- [#22548](https://github.com/anthropics/claude-code/issues/22548) - Auto-mask API keys in VS Code extension
- [#21528](https://github.com/anthropics/claude-code/issues/21528) - Environment Variable Redaction

## Features

### Comprehensive Secret Detection

Detects 35+ types of secrets including:

| Category | Examples |
|----------|----------|
| **AI Services** | Anthropic, OpenAI API keys |
| **Cloud Providers** | AWS, Google Cloud, Azure credentials |
| **Code Platforms** | GitHub tokens, npm tokens |
| **Payment** | Stripe live/test keys |
| **Communication** | Slack, Twilio, SendGrid tokens |
| **Databases** | PostgreSQL, MySQL, MongoDB, Redis connection strings |
| **Cryptographic** | RSA, SSH, PGP private keys |
| **Auth Tokens** | JWTs, Bearer tokens, Basic auth |

### Severity Levels

- 🚨 **Critical**: Production API keys, private keys, database credentials
- ⚠️ **High**: OAuth tokens, webhook URLs, service tokens
- ⚡ **Medium**: Test keys, generic API keys
- ℹ️ **Low**: Potentially sensitive patterns

### Security Logging

All detections are logged (without actual secret values) to:
```
~/.claude/security-logs/secrets-detected-YYYY-MM-DD.jsonl
```

This provides an audit trail for security review without persisting the secrets themselves.

## Installation

### Option 1: Copy to plugins directory

```bash
cp -r secrets-scanner ~/.claude/plugins/
```

### Option 2: Add to settings.json

```json
{
  "plugins": [
    "/path/to/secrets-scanner"
  ]
}
```

## Usage

Once installed, the plugin automatically scans all tool output. No configuration required.

### Example Warning

When secrets are detected, you'll see:

```
============================================================
🔐 SECRETS DETECTED IN OUTPUT
============================================================

🚨 CRITICAL:
   • Stripe Secret Key - Stripe live secret key
   • AWS Access Key ID - AWS access key ID

⚠️  HIGH:
   • GitHub Token (Classic) - GitHub personal access token

Source: .env

⚡ RECOMMENDED ACTIONS:
   1. Do NOT share this terminal output
   2. Clear terminal history: `history -c`
   3. Rotate exposed credentials immediately
   4. Check ~/.claude/projects/ for cached data

📋 This detection has been logged to:
   ~/.claude/security-logs/

============================================================
```

### Reviewing Security Logs

```bash
# View today's detections
cat ~/.claude/security-logs/secrets-detected-$(date +%Y-%m-%d).jsonl | jq '.'

# Count detections by type
cat ~/.claude/security-logs/secrets-detected-*.jsonl | jq -r '.detections[].type' | sort | uniq -c

# Find critical detections
cat ~/.claude/security-logs/secrets-detected-*.jsonl | jq 'select(.detections[].severity == "critical")'
```

## Secret Patterns

### AI Service Keys

| Pattern | Example |
|---------|---------|
| Anthropic API Key | `sk-ant-api03-...` |
| OpenAI API Key | `sk-...` (48 chars) |
| OpenAI Project Key | `sk-proj-...` |

### Cloud Providers

| Pattern | Example |
|---------|---------|
| AWS Access Key ID | `AKIA...` (20 chars) |
| AWS Secret Key | Via `aws_secret_access_key=` |
| Google API Key | `AIza...` (39 chars) |
| Azure Storage Key | Connection string pattern |

### Code Platforms

| Pattern | Example |
|---------|---------|
| GitHub Classic Token | `ghp_...` (40 chars) |
| GitHub Fine-grained | `github_pat_...` |
| npm Token | `npm_...` (40 chars) |

### Database Connection Strings

Detects credentials embedded in connection strings:
- `postgres://user:password@host/db`
- `mysql://user:password@host/db`
- `mongodb+srv://user:password@cluster/db`
- `redis://user:password@host:port`

### Private Keys

Detects key file headers:
- `-----BEGIN RSA PRIVATE KEY-----`
- `-----BEGIN OPENSSH PRIVATE KEY-----`
- `-----BEGIN PGP PRIVATE KEY BLOCK-----`
- `-----BEGIN EC PRIVATE KEY-----`

## Configuration

Currently, the plugin uses built-in patterns. Future versions may support:

```json
{
  "secretsScanner": {
    "additionalPatterns": [...],
    "excludePatterns": [...],
    "minSecretLength": 20,
    "logDetections": true
  }
}
```

## Best Practices

### When Secrets Are Detected

1. **Don't panic** - The warning is to help you, not punish you
2. **Don't share** - Avoid copying/pasting terminal output
3. **Clear history** - Run `history -c` and clear scrollback
4. **Rotate credentials** - Assume they may be compromised
5. **Check caches** - Look in `~/.claude/projects/` for persisted data

### Preventive Measures

1. **Use secret managers** - Don't store secrets in plain text files
2. **Use .gitignore** - Prevent .env files from being committed
3. **Environment variables** - Load secrets from env, not files
4. **Least privilege** - Use API keys with minimal permissions

## Limitations

- **Detection only** - This plugin warns but cannot prevent Claude from seeing the content
- **Pattern-based** - Novel secret formats may not be detected
- **Post-execution** - Scanning happens after the tool runs
- **No redaction** - Full content is still displayed (redaction requires core changes)

For true prevention, consider:
- Using environment variables instead of files
- Implementing a proxy that redacts before display
- Waiting for core redaction support ([#18653](https://github.com/anthropics/claude-code/issues/18653))

## Privacy

This plugin:
- ✅ Logs detection metadata (type, severity, source file)
- ❌ Does NOT log actual secret values
- ❌ Does NOT send data externally
- ✅ All logs stay local in `~/.claude/security-logs/`

## Contributing

Contributions welcome:
- Additional secret patterns
- Improved detection accuracy
- Reduced false positives
- Configuration options

## License

MIT License

## Author

Steven Elliott - CIO with expertise in compliance (HIPAA, SOC 2, ERISA) and AI transformation in regulated environments.

- GitHub: [@stevenelliottjr](https://github.com/stevenelliottjr)
- LinkedIn: [/in/stevenelliottjr](https://linkedin.com/in/stevenelliottjr)
