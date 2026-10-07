# Sound Notification Plugin

Play audio notifications when Claude Code completes a task or needs user attention. Useful when running long operations while multitasking.

## Features

- **Task completion sound** — plays when Claude Code finishes a session (`Stop` hook)
- **Permission prompt sound** — plays when Claude Code asks a question (`PreToolUse` on `AskUserQuestion`)
- Cross-platform support (macOS, Linux, Windows via WSL)

## Installation

Add to your project or user settings:

```json
{
  "plugins": ["<path-to>/sound-notification"]
}
```

## Default Sounds

| Event | macOS | Linux/Windows |
|-------|-------|---------------|
| Task complete | Glass (`/System/Library/Sounds/Glass.aiff`) | Terminal bell |
| Permission prompt | Ping (`/System/Library/Sounds/Ping.aiff`) | Terminal bell |

## Configuration

Override defaults with environment variables:

```bash
# Disable all sounds
export CLAUDE_SOUND_DISABLED=1

# Use custom sound files
export CLAUDE_SOUND_COMPLETE="/path/to/complete.wav"
export CLAUDE_SOUND_PERMISSION="/path/to/attention.wav"
```

## Platform Support

| Platform | Audio Backend |
|----------|--------------|
| macOS | `afplay` (built-in) |
| Linux | `paplay` (PulseAudio) or `aplay` (ALSA) |
| Windows (WSL) | `powershell.exe` SoundPlayer |
| Fallback | Terminal bell (`\a`) |

## Related Issues

- [#15795](https://github.com/anthropics/claude-code/issues/15795) — Audio notifications for permission prompts and task completion
- [#25267](https://github.com/anthropics/claude-code/issues/25267) — Add native sound notification/chime for task completion
