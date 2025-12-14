# Accept with Feedback

A Claude Code plugin that lets you approve operations while providing guidance to Claude. Instead of just accepting or rejecting permission requests, you can accept *with feedback* - approving the operation while giving Claude additional context or instructions.

## Why?

Sometimes you want to approve an operation but also want to guide Claude's behavior:

- "Yes, edit that file, but make sure to add error handling"
- "Okay to run those tests, but skip the slow integration tests"
- "Go ahead and commit, but use conventional commit format"

This plugin bridges the gap between simple approval and rejection-with-feedback.

## Installation

This plugin is included in the Claude Code repository. Enable it in your settings or use:

```bash
claude /plugin install accept-with-feedback
```

## Usage

### One-time feedback

Use the `/accept-feedback` command to queue feedback for the next permission request:

```
/accept-feedback Make sure to preserve backwards compatibility
```

When Claude next asks for permission (e.g., to edit a file), the operation will be automatically approved and Claude will receive your guidance as a system message.

### Persistent feedback rules

Create rules that automatically provide feedback for certain types of operations. Add configuration to `.claude/accept-feedback.json`:

```json
{
  "rules": [
    {
      "matcher": "Edit|Write",
      "conditions": {
        "file_path": ".py"
      },
      "feedback": "Follow PEP 8 style and add type hints to all functions."
    },
    {
      "matcher": "Bash",
      "conditions": {
        "command": "npm"
      },
      "feedback": "Use --legacy-peer-deps if you encounter peer dependency issues."
    }
  ]
}
```

Use `/configure-feedback` for an interactive configuration experience.

## Configuration

### Rule properties

| Property | Description | Example |
|----------|-------------|---------|
| `matcher` | Tool name pattern | `"Edit"`, `"Write\|Edit"`, `"*"` |
| `conditions` | Optional filters on tool input | `{"file_path": ".ts"}` |
| `feedback` | Guidance message for Claude | `"Add JSDoc comments"` |

### Configuration locations

- **User-level**: `~/.claude/accept-feedback.json`
- **Project-level**: `.claude/accept-feedback.json` (takes precedence)

## Commands

| Command | Description |
|---------|-------------|
| `/accept-feedback <message>` | Queue feedback for the next permission request |
| `/configure-feedback` | Interactive configuration of persistent rules |

## How it works

1. The plugin uses a `PermissionRequest` hook to intercept permission requests
2. When a permission request occurs:
   - If there's pending feedback (from `/accept-feedback`), approve with that feedback
   - If a configured rule matches, approve with the rule's feedback
   - Otherwise, let the normal permission flow proceed
3. Feedback is sent to Claude as a system message, providing guidance for the operation

## Examples

### Example 1: One-time guidance

```
You: /accept-feedback Please add comprehensive error handling

Claude: I'll edit src/api.ts to add the new endpoint...
[Permission automatically approved with your feedback]

Claude: I've added the endpoint with try-catch blocks and proper error responses...
```

### Example 2: Persistent Python style rules

`.claude/accept-feedback.json`:
```json
{
  "rules": [
    {
      "matcher": "Edit|Write",
      "conditions": {
        "file_path": ".py"
      },
      "feedback": "Use Google-style docstrings and add type hints to all function signatures."
    }
  ]
}
```

Every time Claude edits a Python file, it receives this style guidance.

### Example 3: Git workflow rules

```json
{
  "rules": [
    {
      "matcher": "Bash",
      "conditions": {
        "command": "git commit"
      },
      "feedback": "Use conventional commit format: type(scope): description"
    }
  ]
}
```

## Tips

- Use specific matchers to avoid unnecessary approvals
- Conditions use substring matching - `".py"` matches any path containing `.py`
- Combine with other permission management for a comprehensive workflow
- Feedback is visible in the conversation, so Claude can reference it

## Related

- Rejecting with feedback: Built into Claude Code's plan rejection flow
- Permission hooks: See the [hook development guide](../plugin-dev/skills/hook-development/SKILL.md)
