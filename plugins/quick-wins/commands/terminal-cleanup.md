---
description: Force terminal state reset (workaround for StatusLine persistence bug)
---

## Reset Terminal State

Executing terminal reset to clear corrupted state:

!`reset`

## Manual Cleanup

If reset doesn't work, run these ANSI escape sequences:

!`printf '\033[?25h\033[2K\033[0m\033[?1049l'`

## Explanation

This command:
- `\033[?25h` - Show cursor
- `\033[2K` - Clear current line
- `\033[0m` - Reset all text attributes
- `\033[?1049l` - Exit alternate screen buffer

This is a workaround for bug #12345 until the core fix is merged.
