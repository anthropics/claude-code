# Audit Trail Plugin for Claude Code

Comprehensive audit logging for Claude Code tool usage. Provides an immutable record of all AI agent actions for debugging, compliance, and security review.

## Why Audit Logging?

Claude Code executes powerful operations: writing files, running commands, making network requests. In production environments, you need to answer questions like:

- **Debugging**: "What did Claude change last session that broke the build?"
- **Compliance**: "Can we demonstrate what the AI agent accessed for our SOC 2 audit?"
- **Security**: "Did any session access sensitive files or run unexpected commands?"
- **Accountability**: "What exactly happened during this automated workflow?"

This plugin addresses [Issue #16622](https://github.com/anthropics/claude-code/issues/16622) by providing visibility into Claude Code's actions through structured audit logs.

## Features

- **Comprehensive Logging**: Records all tool calls (Bash, Read, Write, Edit, WebFetch, etc.)
- **Pre and Post Capture**: Logs both the request (before) and result (after) for each tool
- **Automatic Categorization**: Tools are categorized (execution, file_read, file_write, network, etc.)
- **Sensitive Data Redaction**: Automatically masks passwords, API keys, and tokens
- **Daily Log Rotation**: Logs stored in daily JSONL files for easy management
- **Zero-Block Design**: Audit failures never block operations
- **Compliance Ready**: Structured format suitable for SOC 2, HIPAA, and similar requirements

## Installation

### Option 1: Via Plugin Directory

Copy the `audit-trail` folder to your Claude Code plugins directory:

```bash
cp -r audit-trail ~/.claude/plugins/
```

### Option 2: Via Settings

Add to your `.claude/settings.json`:

```json
{
  "plugins": [
    "/path/to/audit-trail"
  ]
}
```

## Usage

Once installed, the plugin automatically logs all tool usage. No configuration required.

### View Audit Logs

Use the `/audit` command to query logs:

```
/audit
```

Or manually inspect the JSONL files:

```bash
# Today's logs
cat ~/.claude/audit/audit-$(date +%Y-%m-%d).jsonl | jq '.'

# Recent activity
tail -10 ~/.claude/audit/audit-*.jsonl | jq '.'
```

### Common Queries

```bash
# Count tool usage by type
cat ~/.claude/audit/audit-*.jsonl | jq -r '.tool.name' | sort | uniq -c | sort -rn

# Find all file modifications
cat ~/.claude/audit/audit-*.jsonl | jq 'select(.tool.category == "file_write")'

# Find all Bash commands run
cat ~/.claude/audit/audit-*.jsonl | jq 'select(.tool.name == "Bash") | .tool.command'

# Find errors
cat ~/.claude/audit/audit-*.jsonl | jq 'select(.result.status == "error")'

# Activity by session
cat ~/.claude/audit/audit-*.jsonl | jq -s 'group_by(.session_id) | map({session: .[0].session_id, count: length})'
```

## Log Format

Each audit record is a JSON object with this structure:

```json
{
  "timestamp": "2026-02-02T18:30:45.123456+00:00",
  "timestamp_unix": 1770156645.123456,
  "event_type": "pre_tool_use",
  "session_id": "a1b2c3d4e5f6",
  "tool": {
    "name": "Bash",
    "category": "execution",
    "command": "npm test"
  },
  "request": {
    "command": "npm test",
    "timeout": 60000
  },
  "context": {
    "cwd": "/home/user/project",
    "user": "developer",
    "config_dir": "~/.claude"
  }
}
```

### Event Types

- `pre_tool_use`: Logged before tool execution (captures intent)
- `post_tool_use`: Logged after tool execution (captures result)

### Tool Categories

| Category | Tools |
|----------|-------|
| `execution` | Bash |
| `file_read` | Read |
| `file_write` | Write, Edit, MultiEdit |
| `file_search` | Glob, Grep |
| `network` | WebFetch, WebSearch |
| `agent` | Task |
| `interaction` | AskUserQuestion |

## Configuration

### Custom Audit Directory

Set `CLAUDE_CONFIG_DIR` to change where logs are stored:

```bash
export CLAUDE_CONFIG_DIR=~/.claude-work
# Logs will be in ~/.claude-work/audit/
```

### Log Retention

Logs are stored in daily files. Implement your own retention policy:

```bash
# Delete logs older than 90 days
find ~/.claude/audit -name "audit-*.jsonl" -mtime +90 -delete
```

## Compliance Use Cases

### SOC 2 Type II

The audit trail provides evidence of:
- Access controls (who accessed what)
- Change management (what was modified)
- System operations (commands executed)

### HIPAA

For healthcare environments:
- Track access to files containing PHI
- Maintain audit logs for required retention period
- Demonstrate access monitoring controls

### Financial Services (SOX, GLBA)

- Document automated processes
- Maintain change audit trail
- Support segregation of duties review

## Privacy Considerations

The plugin automatically redacts values for keys containing:
- password, secret, token, api_key, credential, private_key, auth

For additional privacy:
- File contents from Read operations are not logged (only metadata)
- Large outputs are truncated
- You can post-process logs to remove additional sensitive data

## Troubleshooting

### Logs not appearing

1. Check plugin is loaded: Look for audit-trail in active plugins
2. Verify directory exists: `ls ~/.claude/audit/`
3. Check permissions: `touch ~/.claude/audit/test.txt`

### Hook errors

Errors are logged to stderr but never block operations. Check:
```bash
# Recent errors in Claude Code debug logs
grep -i "audit" ~/.claude/debug/*.log
```

## Contributing

This plugin was created to address [Issue #16622](https://github.com/anthropics/claude-code/issues/16622). Contributions welcome:

- Additional query commands
- Export formats (CSV, SQL)
- Log analysis tools
- Integration with SIEM systems

## License

MIT License

## Author

Steven Elliott - CIO with expertise in compliance (HIPAA, SOC 2, ERISA) and AI transformation in regulated environments.

- GitHub: [@stevenelliottjr](https://github.com/stevenelliottjr)
- LinkedIn: [/in/stevenelliottjr](https://linkedin.com/in/stevenelliottjr)
