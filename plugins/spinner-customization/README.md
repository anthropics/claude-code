# Spinner Customization Plugin

Switch between spinner verb modes without manually editing `settings.json`.

Addresses [#34700](https://github.com/anthropics/claude-code/issues/34700) — users who find the default quirky spinner verbs ("Bloviating", "Perambulating", etc.) distracting can switch to professional, minimal, or silent alternatives with a single command.

## Commands

### `/spinner-mode [quirky|plain|minimal|none]`

Sets the spinner verb style by updating `spinnerVerbs` in `~/.claude/settings.json`.

| Mode | Verbs | Use case |
|------|-------|----------|
| `quirky` | Default playful verbs | Fun, casual usage |
| `plain` | "Processing", "Analyzing", "Searching", ... | Screen sharing, demos, professional environments |
| `minimal` | "Working", "Thinking", "Running" | Low distraction |
| `none` | No text | Spinner icon only |

```bash
/spinner-mode plain
```

### `/spinner-preview`

Shows a preview of all available modes and their verb sets.

```bash
/spinner-preview
```

## How it works

The plugin uses Claude Code's built-in `spinnerVerbs` setting. The `/spinner-mode` command reads your `~/.claude/settings.json`, updates the `spinnerVerbs` key with the selected verb set, and writes it back — preserving all other settings.

Choosing `quirky` removes the override so the built-in defaults are used.

## Installation

This plugin is included in the Claude Code repository. Copy the `spinner-customization` directory into your project's `.claude/plugins/` folder, or add it to your global plugins directory.

To enable it, add the plugin to your `.claude/settings.json`:

```json
{
  "enabledPlugins": ["spinner-customization"]
}
```

## Related

- [#34700](https://github.com/anthropics/claude-code/issues/34700) — Allow customizing or disabling spinner/loading messages
- [#34541](https://github.com/anthropics/claude-code/issues/34541) — Customize spinner animation frames via settings
- `spinnerVerbs` setting ([CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md))
- `spinnerTipsOverride` setting ([CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md))
