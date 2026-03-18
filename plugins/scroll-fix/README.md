# scroll-fix

Fixes the terminal scroll-to-top regression in Claude Code. Works on **all platforms** (Windows, macOS, Linux) and **all terminals**.

## Problem

Claude Code's Ink renderer uses cursor-up (`\x1b[{n}A`) sequences to clear previous output before redrawing. When the output exceeds the viewport height, the cursor moves above the visible area and the terminal viewport follows it — snapping to the top of scrollback on every re-render.

**Root cause:** `eraseLines()` generates N cursor-up sequences where N = number of previously rendered lines. Terminals follow cursor position changes, including during synchronized output blocks.

**Upstream issues:**
- [microsoft/terminal#14774](https://github.com/microsoft/terminal/issues/14774) — `SetConsoleCursorPosition` always scrolls viewport to cursor
- [anthropics/claude-code#33814](https://github.com/anthropics/claude-code/issues/33814) — Forces scroll to top when outputting code
- [anthropics/claude-code#826](https://github.com/anthropics/claude-code/issues/826) — Console scrolling top of history
- [anthropics/claude-code#11801](https://github.com/anthropics/claude-code/issues/11801) — Terminal scrolls to the top after each response
- [anthropics/claude-code#3648](https://github.com/anthropics/claude-code/issues/3648) — Terminal scrolling uncontrollably
- [anthropics/claude-code#34794](https://github.com/anthropics/claude-code/issues/34794) — Terminal scrolls to top during agent execution

## Fix

Intercepts `process.stdout.write` and tracks cumulative cursor-up within each synchronized output block (`\x1b[?2026h` … `\x1b[?2026l`). Clamps total cursor-up to `process.stdout.rows` so the cursor stays within the visible viewport.

### Additional feature: Ctrl+6 freeze toggle

Press **Ctrl+6** to freeze all Ink re-render output. Press again to unfreeze and replay buffered frames. This allows scrolling through terminal history without the viewport being yanked back.

## Installation

### Option 1: Node.js preload (recommended)

```bash
# Set in your shell profile (.bashrc, .zshrc, etc.)
export NODE_OPTIONS="--require /path/to/plugins/scroll-fix/scroll-fix.cjs"

# Then run claude normally
claude
```

### Option 2: Patch cli.js directly

```bash
node plugins/scroll-fix/scripts/install.js /path/to/cli.js
```

To remove:
```bash
node plugins/scroll-fix/scripts/install.js --uninstall /path/to/cli.js
```

### Option 3: Install as Claude Code plugin

```bash
claude /plugin install /path/to/plugins/scroll-fix
```

## How it works

1. **Sync block tracking**: Detects `\x1b[?2026h` (synchronized output start) and resets the cursor-up counter
2. **Cursor-up clamping**: Each `\x1b[{n}A` sequence consumes from a budget equal to `process.stdout.rows`. When budget hits 0, further cursor-up sequences are suppressed
3. **Budget restoration**: Newlines (`\n`) and cursor-down (`\x1b[{n}B`) restore the budget, allowing the next render cycle to clear properly
4. **Sync block end**: `\x1b[?2026l` resets the counter

This ensures the cursor never leaves the visible viewport during re-renders, preventing the terminal from snapping to the top.

## Compatibility

| Platform | Status |
|----------|--------|
| Windows Terminal | ✅ Fixed |
| macOS Terminal.app | ✅ Fixed |
| macOS iTerm2 | ✅ Fixed |
| Linux (all terminals) | ✅ Fixed |
| VS Code integrated terminal | ✅ Fixed |
| tmux | ✅ Fixed |
| Ghostty | ✅ (already minimal, now zero) |
