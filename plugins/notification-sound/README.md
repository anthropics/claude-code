# Notification Sound Plugin

Plays a system notification sound when Claude Code finishes processing and is waiting for your input — so you don't have to keep watching the terminal.

## How it works

Hooks into two Claude Code events:
- **Notification** — when Claude sends a notification (e.g., task complete)
- **Stop** — when Claude finishes and is waiting for input

## Platform support

| Platform | Sound backend | Default sound |
|----------|--------------|---------------|
| macOS | `afplay` / `osascript beep` | Glass.aiff |
| Linux | `paplay` / `aplay` / `pw-play` / `canberra-gtk-play` / terminal bell | freedesktop message sound |
| Windows | PowerShell `SystemSounds` | Windows Exclamation |

## Configuration

Set these environment variables (e.g., in your shell profile):

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_NOTIFICATION_SOUND` | `1` | Set to `0` to disable |
| `CLAUDE_NOTIFICATION_SOUND_PATH` | *(auto)* | Custom `.aiff`/`.ogg`/`.wav` file path |
| `CLAUDE_NOTIFICATION_VOLUME` | `50` | Volume 0-100 (macOS only) |

## Usage examples

```bash
# Use a custom sound file
export CLAUDE_NOTIFICATION_SOUND_PATH="/path/to/my-sound.aiff"

# Lower the volume on macOS
export CLAUDE_NOTIFICATION_VOLUME=25

# Disable the sound entirely
export CLAUDE_NOTIFICATION_SOUND=0
```

## Installation

Copy or symlink this plugin into your Claude Code plugins directory, or install from the marketplace.
