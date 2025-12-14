---
description: Configure persistent feedback rules for accept-with-feedback
---

# Configure Accept-with-Feedback Rules

You are helping the user configure persistent feedback rules that automatically provide guidance to Claude when certain operations are approved.

## Configuration file location

Rules are stored in `.claude/accept-feedback.json` in either:
- User's home directory (`~/.claude/accept-feedback.json`) for global rules
- Project directory (`.claude/accept-feedback.json`) for project-specific rules

Project rules take precedence over user rules.

## Configuration format

```json
{
  "rules": [
    {
      "matcher": "Edit|Write",
      "conditions": {
        "file_path": ".py"
      },
      "feedback": "Ensure all Python code follows PEP 8 style guidelines and includes type hints."
    },
    {
      "matcher": "Bash",
      "conditions": {
        "command": "git"
      },
      "feedback": "Use conventional commit format for commit messages."
    },
    {
      "matcher": "*",
      "feedback": "Please explain your reasoning before making changes."
    }
  ]
}
```

## Rule properties

- **matcher**: Tool name pattern (e.g., "Edit", "Write|Edit", "*" for all)
- **conditions**: Optional key-value pairs to match against tool input
- **feedback**: The guidance message to send to Claude when this rule matches

## Instructions

1. Ask the user what kind of feedback rules they want to configure
2. Help them create appropriate rules based on their needs
3. Save the configuration to the appropriate location

## Common use cases

1. **Code style guidance**: Provide style guidelines when editing specific file types
2. **Git workflow**: Add commit message format requirements for git operations
3. **Safety reminders**: Add warnings when working with sensitive files
4. **Project conventions**: Enforce project-specific patterns and practices

## Example interaction

User: "I want to always remind Claude to add tests when editing Python files"

You would create:
```json
{
  "rules": [
    {
      "matcher": "Edit|Write",
      "conditions": {
        "file_path": ".py"
      },
      "feedback": "Remember to add or update tests for any code changes."
    }
  ]
}
```
