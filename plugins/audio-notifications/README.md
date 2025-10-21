# Audio Notifications Plugin

Speaks notification messages out loud using your system's text-to-speech capabilities.

## Overview

The Audio Notifications Plugin automatically speaks Claude Code notifications aloud. This helps you stay informed without constantly watching the terminal, particularly useful during long-running tasks like builds, tests, or code reviews.

## How It Works

The plugin registers a hook that listens for notification events. When a notification occurs, the plugin passes the message to your system's text-to-speech command, playing it through your speakers or headphones.

The plugin automatically detects available TTS commands on your system and uses the first one found. You can override this with a custom command in the configuration file.

## Installation

This plugin is included in Claude Code. It will be available in your plugins marketplace once enabled.

```bash
# Enable in Claude Code settings
# Or install from marketplace when available
```

## Configuration

Configuration is stored in `~/.claude/audio_notifications.json`. Create this file to customize behavior.

### Configuration File

```json
{
  "audio_off": false,
  "speech_command": "say"
}
```

### Configuration Options

**audio_off** (boolean)
- Set to `true` to disable audio notifications without uninstalling the plugin
- Default: `false` (audio enabled)
- Useful for temporarily muting notifications during meetings or quiet hours
- Serves as a **shared coordination point** for audio control across plugins
- Other plugins can check this setting to honor audio preferences
- Other plugins can also set this to `true` to silence this plugin when needed

**speech_command** (string)
- The command to use for text-to-speech
- Can include spaces for command options (e.g., `"say -v Victoria"`)
- If not specified, the plugin auto-detects available commands
- See "Supported Systems" section for platform-specific commands

## Supported Systems

The plugin automatically detects and uses available TTS commands:

**macOS:**
- `say` (native macOS command)

**Linux:**
- `spd-say` (Speech Dispatcher)
- `espeak` (eSpeak)

**Custom Commands:**
- Any command that accepts text as final argument
- Example: `festival --tts` or custom scripts

## Usage

Once installed and enabled, the plugin works automatically. No additional setup is required.

### Examples

**Disable audio temporarily:**
```json
{
  "audio_off": true
}
```

**Use a specific voice on macOS:**
```json
{
  "speech_command": "say -v Victoria"
}
```

**Use spd-say on Linux with slower speech:**
```json
{
  "speech_command": "spd-say -r -50"
}
```

## Troubleshooting

### No Audio Playing

**Issue**: Notifications aren't spoken aloud

**Solutions:**
- Check system volume is not muted
- Verify TTS command is installed: `which say` or `which spd-say`
- Confirm `audio_off` is not set to `true` in config
- Check that notification messages are being generated

### Wrong Voice Used

**Issue**: Plugin using unexpected TTS command

**Solutions:**
- Explicitly set `speech_command` in config
- Check auto-detection order: `say` → `spd-say` → `espeak`
- Verify preferred command is installed

### Command Not Found Error

**Issue**: Custom `speech_command` fails

**Solutions:**
- Verify command is in your PATH: `which <command>`
- Test command manually: `echo "test" | <command>`
- Include full path if needed: `/usr/local/bin/say`
- Check for required arguments or flags

### Audio Too Loud or Quiet

**Issue**: Volume too high or low

**Solutions:**
- Adjust system volume level
- Add volume options to `speech_command`: `"say -v Victoria -r 200"`
- Adjust speaker/headphone volume

## Requirements

- System with text-to-speech support
- At least one TTS command available (`say`, `spd-say`, `espeak`, or custom)
- Speakers or headphones (if output desired)

## Tips

- **Disable during meetings**: Set `audio_off: true` in config quickly
- **Plugin coordination**: The `audio_off` config is a shared coordination point—other plugins can silence this plugin, and you can silence all audio-aware plugins by setting this flag
- **Combine with other audio**: Works with other applications, respects system volume
- **Test your setup**: Run a manual test with your TTS command first
- **Reduce notifications**: Works best when notifications are meaningful and not excessive
- **Custom notifications**: Pairs well with any Claude Code workflow that generates notifications

## Author

Fred Lacs (fredlacs@gmail.com)

## Version

1.0.0
