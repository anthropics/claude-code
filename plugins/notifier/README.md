# claude-code-notifier

Get notified when Claude Code completes your tasks (Windows/macOS/Linux)

## Features

- **Cross-platform**: Windows (Native/WSL2), macOS, and Linux support
- **Smart notifications**: Only notifies for tasks taking 20+ seconds
- **Prompt preview**: Shows the first few characters of your prompt
- **Session-aware**: Multiple Claude Code sessions work independently
- **Zero config**: Works out of the box with sensible defaults
- **Slash command**: Easy configuration with `/notifier` command

## Tested Environments

| Platform | Status |
|----------|--------|
| macOS | ✅ Tested |
| Linux | ✅ Tested (Docker) |
| Windows (Native) | ✅ Tested |
| Windows (WSL2) | ✅ Tested |

> Found an issue? Please [open an issue](https://github.com/js-koo/claude-code-notifier/issues)!

## Requirements

- [Claude Code CLI](https://claude.ai/code)
- `jq` (JSON processor)
- **Linux only**: `libnotify-bin` (for `notify-send`)

## Installation

This plugin is included in the official Claude Code plugins directory.

For standalone installation, see [claude-code-notifier](https://github.com/js-koo/claude-code-notifier).

## Configuration

### Using Slash Command (Recommended)

Use the `/notifier` command in Claude Code:

| Command | Description |
|---------|-------------|
| `/notifier help` | Show available commands |
| `/notifier status` | Show current configuration |
| `/notifier lang <en\|ko>` | Set language (en: English, ko: 한국어) |
| `/notifier duration <seconds>` | Set minimum task duration (default: 20) |
| `/notifier preview <length>` | Set prompt preview length (default: 45) |
| `/notifier test` | Send a test notification |
| `/notifier uninstall` | Uninstall claude-code-notifier |

### Manual Configuration

Edit `config.sh` in the plugin's `hooks-handlers/` directory:

```bash
# Language setting: "en" (English) or "ko" (한국어)
NOTIFIER_LANG="en"

# Minimum task duration (seconds) to trigger notification
MIN_DURATION_SECONDS=20

# Number of characters to preview from the prompt
PROMPT_PREVIEW_LENGTH=45
```

### Configuration Options Explained

| Option | Default | Description |
|--------|---------|-------------|
| `NOTIFIER_LANG` | `en` | UI language. `en` for English, `ko` for Korean. Affects notification messages and slash command responses. |
| `MIN_DURATION_SECONDS` | `20` | Minimum task duration to trigger notification. Tasks completing faster than this won't show notifications. Set to `0` to notify on every task. |
| `PROMPT_PREVIEW_LENGTH` | `45` | Number of characters to show from your original prompt in the notification. |

### Notification Messages

Messages are automatically set based on `NOTIFIER_LANG`:

| Event | English | 한국어 |
|-------|---------|--------|
| Task completed | Task completed! | 작업 완료! |
| Permission required | Permission required! | 권한 필요! |
| Waiting for input | Waiting for input... | 입력 대기 중... |

### Examples

**Quick tasks without notifications:**
```bash
# Only notify for tasks taking 60+ seconds
/notifier duration 60
```

**Always notify:**
```bash
# Notify on every task completion
/notifier duration 0
```

**Longer prompt preview:**
```bash
# Show more of the original prompt
/notifier preview 100
```

**Switch to Korean:**
```bash
/notifier lang ko
```

## How It Works

This tool uses Claude Code's [hooks system](https://docs.anthropic.com/en/docs/claude-code/hooks) to:

1. **UserPromptSubmit**: Save the prompt and start time when you submit a task
2. **Stop**: Show a notification when Claude Code finishes (if duration > threshold)
3. **Notification**: Alert when permission is required or Claude is waiting for input
4. **SessionEnd**: Clean up temporary files when the session ends

Session data is stored in `~/.claude-code-notifier/data/`.

## Troubleshooting

### Notifications not appearing

**Windows (WSL)**:
- Ensure Windows notifications are enabled in Settings > System > Notifications
- Check that Focus Assist is not blocking notifications

**macOS**:
- Allow notifications from "Script Editor" in System Preferences > Notifications

**Linux**:
- Install `libnotify-bin`: `sudo apt install libnotify-bin`
- Check if `notify-send` works: `notify-send "Test" "Hello"`

### jq not found

Install jq using your package manager (see Installation section).

### WSL path issues

If you're using a non-default WSL distribution, the path conversion should still work automatically. If issues persist, check that `wslpath` is available.

## License

MIT License - see the [original repository](https://github.com/js-koo/claude-code-notifier) for details.

## Contributing

Contributions are welcome!

- **Bug reports / Feature requests**: [Open an Issue](https://github.com/js-koo/claude-code-notifier/issues)
- **Code contributions**: Submit a Pull Request
