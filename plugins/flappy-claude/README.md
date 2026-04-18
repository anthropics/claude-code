# Flappy Claude

A Flappy Bird clone for your terminal, featuring a Claude-themed sprite. Built as a Claude Code plugin.

```
    |||         |||
    |||         |||
    |||  ▛█▜   |||
    |||         |||
    |||         |||
```

## Requirements

- Python 3
- A terminal that supports Unicode block characters
- Minimum terminal size: 60 columns x 24 rows
- macOS or Linux

## Installation

Copy the plugin directory into your Claude Code plugins folder:

```bash
cp -r flappy-claude ~/.claude/plugins/
```

Claude Code will automatically detect the plugin on next launch.

## Usage

In Claude Code, type:

```
/flappy-claude
```

The game launches in a new terminal window automatically.

## Controls

| Key              | Action |
|------------------|--------|
| `Space` / `Up`   | Flap   |
| `Q`              | Quit   |
| `R`              | Restart (on game over screen) |

## How It Works

Flappy Claude uses Python's built-in `curses` library to render the game directly in your terminal. Since Claude Code runs in a non-interactive context without a TTY, the plugin launches a separate terminal window:

- **macOS**: Uses `osascript` to open a new Terminal.app window
- **Linux**: Uses `x-terminal-emulator` or `gnome-terminal`

The game runs at 20 FPS with gravity-based physics. The Claude sprite (`▛█▜` — upper-left block, full block, upper-right block) navigates through pipe gaps. No external dependencies are required — everything uses the Python standard library.

## Game Details

- **Sprite**: `▛█▜` (3 characters wide, 1 row tall)
- **Pipe gap**: 10 rows
- **Frame rate**: 20 FPS
- **Physics**: Gravity 0.3, flap velocity -1.5

## License

MIT
