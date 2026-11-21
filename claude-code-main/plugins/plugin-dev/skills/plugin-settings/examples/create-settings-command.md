---
description: "Create plugin settings file with user preferences"
allowed-tools: ["Write", "AskUserQuestion"]
---

# Create Plugin Settings

This command helps users create a `.claude/my-plugin.local.md` settings file.

## Steps

### Step 1: Ask User for Preferences

Use AskUserQuestion to gather configuration:

```json
{
  "questions": [
    {
      "question": "Enable plugin for this project?",
      "header": "Enable Plugin",
      "multiSelect": false,
      "options": [
        {
          "label": "Yes",
          "description": "Plugin will be active"
        },
        {
          "label": "No",
          "description": "Plugin will be disabled"
        }
      ]
    },
    {
      "question": "Validation mode?",
      "header": "Mode",
      "multiSelect": false,
      "options": [
        {
          "label": "Strict",
          "description": "Maximum validation and security checks"
        },
        {
          "label": "Standard",
          "description": "Balanced validation (recommended)"
        },
        {
          "label": "Lenient",
          "description": "Minimal validation only"
        }
      ]
    }
  ]
}
```

### Step 2: Parse Answers

Extract answers from AskUserQuestion result:

- answers["0"]: enabled (Yes/No)
- answers["1"]: mode (Strict/Standard/Lenient)

### Step 3: Create Settings File

Use Write tool to create `.claude/my-plugin.local.md`:

```markdown
---
enabled: <true if Yes, false if No>
validation_mode: <strict, standard, or lenient>
max_file_size: 1000000
notify_on_errors: true
---

# Plugin Configuration

Your plugin is configured with <mode> validation mode.

To modify settings, edit this file and restart Claude Code.
```

### Step 4: Inform User

Tell the user:
- Settings file created at `.claude/my-plugin.local.md`
- Current configuration summary
- How to edit manually if needed
- Reminder: Restart Claude Code for changes to take effect
- Settings file is gitignored (won't be committed)

## Implementation Notes

Always validate user input before writing:
- Check mode is valid
- Validate numeric fields are numbers
- Ensure paths don't have traversal attempts
- Sanitize any free-text fields
