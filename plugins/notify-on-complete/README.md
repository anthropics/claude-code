# Notify on Complete Plugin

Ready-to-use completion notifications for Claude Code.

This plugin adds a `Stop` hook that can play a sound, show a desktop notification, or speak a short phrase when Claude finishes a task and is ready to stop.

## Why this plugin exists

Stop hooks are powerful, but even a simple "let me know when Claude is done" setup has a few sharp edges:

- macOS notifications need argument-safe `osascript` usage
- Linux desktop notifications and audio backends vary across distros
- Background audio playback should survive hook process exit
- Hooks must always return a valid approval decision, even if notification commands fail

This plugin packages those details into a small, configurable hook.

## What it does

- Shows a desktop notification on macOS or Linux
- Plays a completion sound on macOS
- Optionally plays a custom sound file on Linux
- Optionally uses text-to-speech on macOS (`say`) or Linux (`espeak`)
- Always returns `{"decision":"approve"}` so notification failures do not block Claude Code from stopping

## Configuration

Set environment variables in your Claude Code settings to control which notification channels run:

```json
{
  "env": {
    "NOTIFY_DESKTOP": "1",
    "NOTIFY_SOUND": "1",
    "NOTIFY_SAY": "0",
    "NOTIFY_TITLE": "Claude Code",
    "NOTIFY_MESSAGE": "Task complete",
    "NOTIFY_SAY_TEXT": "Done",
    "NOTIFY_SOUND_NAME": "Hero",
    "NOTIFY_VOICE": "Samantha"
  }
}
```

### Environment variables

- `NOTIFY_DESKTOP`
  - Default: `1`
  - Enables desktop notifications.
- `NOTIFY_SOUND`
  - Default: `1`
  - Enables audio playback.
- `NOTIFY_SAY`
  - Default: `0`
  - Enables text-to-speech.
- `NOTIFY_TITLE`
  - Default: `Claude Code`
  - Notification title.
- `NOTIFY_MESSAGE`
  - Default: `Task complete`
  - Desktop notification body.
- `NOTIFY_SAY_TEXT`
  - Default: same as `NOTIFY_MESSAGE`
  - Text spoken by `say` or `espeak`.
- `NOTIFY_SOUND_NAME`
  - Default: `Hero`
  - macOS system sound name to play when `NOTIFY_SOUND_FILE` is not set.
- `NOTIFY_SOUND_FILE`
  - Optional custom audio file path.
  - On Linux, audio playback only uses this custom file path.
- `NOTIFY_VOICE`
  - Optional text-to-speech voice override.

Falsey values such as `0`, `false`, `no`, and `off` disable a given channel.

## Platform support

### macOS

- Desktop notifications: `osascript`
- Sound playback: `afplay`
- Text-to-speech: `say`

### Linux

- Desktop notifications: `notify-send`
- Sound playback: `paplay`, `pw-play`, or `aplay` when `NOTIFY_SOUND_FILE` is set
- Text-to-speech: `espeak`

If a backend is missing, the hook silently skips that notification channel and still allows Claude Code to stop normally.
