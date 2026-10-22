# notify-on-complete

Get notified when Claude finishes responding — with a sound, a desktop notification, or a spoken message.

## Why

When running long tasks (refactoring, code review, test suites), you switch to another window. Without this plugin, you keep checking back. With it, you hear a "ding" or see a notification the moment Claude is done.

## What it does

Hooks into the **Stop** event (fires when Claude finishes a response) and runs up to three notification modes, each independently toggleable:

| Mode | macOS | Linux |
|------|-------|-------|
| **Sound** | `afplay` (system sounds) | `paplay` / `pw-play` / `aplay` |
| **Desktop notification** | `osascript` (Notification Center) | `notify-send` (libnotify) |
| **Text-to-speech** | `say` (multi-language) | `espeak-ng` / `espeak` |

Auto-detects your platform. Missing tools are silently skipped.

## Installation

```bash
/plugin install notify-on-complete
# or
claude --plugin-dir /path/to/notify-on-complete
```

## Configuration

All settings are optional environment variables. Set them in your project or global `settings.json`:

```json
{
  "env": {
    "NOTIFY_SOUND": "1",
    "NOTIFY_DESKTOP": "1",
    "NOTIFY_SAY": "0",
    "NOTIFY_SOUND_NAME": "Glass",
    "NOTIFY_MESSAGE": "Task complete",
    "NOTIFY_SAY_TEXT": "Done!",
    "NOTIFY_VOICE": "Samantha"
  }
}
```

### All variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTIFY_SOUND` | `1` | Enable sound (`0` to disable) |
| `NOTIFY_DESKTOP` | `1` | Enable desktop notification (`0` to disable) |
| `NOTIFY_SAY` | `0` | Enable text-to-speech (`1` to enable) |
| `NOTIFY_SOUND_NAME` | `Glass` (macOS) / `complete` (Linux) | Built-in sound name |
| `NOTIFY_SOUND_FILE` | — | Full path to a custom sound file (overrides `NOTIFY_SOUND_NAME`) |
| `NOTIFY_TITLE` | `Claude Code` | Desktop notification title |
| `NOTIFY_MESSAGE` | `Task complete` | Desktop notification text |
| `NOTIFY_SAY_TEXT` | *(falls back to `NOTIFY_MESSAGE`)* | Text to speak aloud (can differ from notification) |
| `NOTIFY_VOICE` | `Samantha` | macOS voice name for text-to-speech |

### Available macOS sounds

Basso, Blow, Bottle, Frog, Funk, **Glass**, Hero, Morse, Ping, Pop, Purr, Sosumi, Submarine, Tink

### Available voices (macOS)

| Language | Voice |
|----------|-------|
| English US | Samantha |
| English UK | Daniel |
| English AU | Karen |
| Japanese | Kyoko |
| Korean | Yuna |
| French | Thomas |
| Portuguese BR | Luciana |
| Chinese TW | Meijia |
| Cantonese HK | Sinji |

Run `say -v '?'` to list all installed voices.

### Example: desktop shows English, voice speaks Chinese

```json
{
  "env": {
    "NOTIFY_SAY": "1",
    "NOTIFY_MESSAGE": "Task complete",
    "NOTIFY_SAY_TEXT": "做好了",
    "NOTIFY_VOICE": "Meijia"
  }
}
```

## Safety

- **`trap EXIT`** guarantees `{"decision":"approve"}` is always output, even if the script crashes — Claude never gets stuck
- **`on run argv`** passes strings to `osascript` via arguments instead of string interpolation, preventing AppleScript injection and preserving UTF-8 (CJK text)
- **`( cmd & )` subshell wrapping** prevents background processes from being killed by SIGHUP on script exit
- **`--` argument separator** prevents user-configured messages starting with `-` from being parsed as flags
