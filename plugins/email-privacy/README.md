# Email Privacy Plugin

Toggle to hide your email address from displaying in the Claude Code CLI.

## Overview

This plugin provides a simple setting to control whether your email address is displayed in the Claude Code interface. When enabled, your email will be masked or hidden in places like the `/status` command output.

## Installation

Install using the Claude Code plugin command:

```
/plugin install email-privacy
```

Or add to your `.claude/settings.json`:

```json
{
  "plugins": ["email-privacy"]
}
```

## Configuration

### Using settings.json

Add the `hideEmail` setting to your user or project settings:

**User settings** (`~/.claude/settings.json`):
```json
{
  "hideEmail": true
}
```

**Project settings** (`.claude/settings.json`):
```json
{
  "hideEmail": true
}
```

### Using /config

You can toggle email visibility using the `/config` command:

```
/config
```

Then select "Hide email address" from the toggle options.

## Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `hideEmail` | boolean | `false` | When `true`, masks your email address in CLI output |

## How It Works

When `hideEmail` is enabled:
- Email in `/status` output is displayed as `***@***.***`
- Account information shows "Account: (hidden)" instead of your email
- The setting is respected across all CLI displays

## Privacy Notes

- This setting only affects local display - your email is still used for authentication
- The setting persists across sessions when configured in settings.json
- Project-level settings override user-level settings

## Examples

### Before (hideEmail: false)
```
Account: user@example.com
Plan: Pro
```

### After (hideEmail: true)
```
Account: (hidden)
Plan: Pro
```

## Related Settings

- `/privacy-settings` - Controls data privacy and model training preferences
- `/status` - Shows account and system information

## Feedback

If you encounter issues or have suggestions, use `/bug` to report them or file an issue at https://github.com/anthropics/claude-code/issues.
