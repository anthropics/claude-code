# Project Theme Plugin

Applies per-project theme settings from `.claude/settings.json` on session start.

## Problem

When working on multiple projects simultaneously, all Claude Code sessions look identical. You have to manually run `/theme` each time you switch projects.

## Solution

This plugin reads theme settings from your project's `.claude/settings.json` and automatically applies them when the session starts.

## Installation

```bash
/plugin install project-theme
```

Or for development:

```bash
claude --plugin-dir /path/to/project-theme
```

## Usage

Add a `theme` or `color` key to your project's `.claude/settings.json`:

```json
{
  "theme": "pink"
}
```

Or use `.claude/settings.local.json` for local overrides:

```json
{
  "theme": "dark"
}
```

## Supported Values

Any theme name supported by Claude Code's `/theme` command:

- `dark` (default)
- `light`
- `light-ansi`
- `dark-ansi`
- `pink`
- `blue`
- `green`
- `orange`
- `purple`
- `red`
- `yellow`
- Custom theme names from `~/.claude/themes/`

## Priority

Settings are loaded in this order (last wins):

1. `.claude/settings.json` (project)
2. `.claude/settings.local.json` (local override)

## Example Workflow

1. Create a project:
   ```bash
   mkdir my-project && cd my-project
   mkdir -p .claude
   echo '{"theme": "pink"}' > .claude/settings.json
   ```

2. Start Claude Code:
   ```bash
   claude
   ```

3. The pink theme is automatically applied!

## How It Works

The plugin uses a `SessionStart` hook that:

1. Reads `.claude/settings.json` or `.claude/settings.local.json`
2. Extracts the `theme` or `color` value
3. Outputs a theme command that Claude Code processes

## Limitations

- Requires Claude Code 2.1.119+ (when `/config` settings persistence was added)
- Theme is applied at session start; changing the file requires restarting
- The hook reads files using basic grep; complex JSON with nested objects may not parse correctly

## Contributing

Contributions welcome! Areas for improvement:

- Support JSON parsing for complex settings files
- Add OSC terminal background color support
- Watch for file changes and hot-reload themes
- Support theme inheritance from parent directories

## License

MIT
