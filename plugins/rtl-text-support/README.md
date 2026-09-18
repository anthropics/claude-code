# RTL Text Support Plugin

Fixes right-to-left (RTL) text rendering broken in the Claude Code VSCode extension webview since **v2.1.63**.

## Problem

Version v2.1.63 introduced a global CSS regression in the extension webview (`webview/index.css`):

```css
* { direction: ltr; unicode-bidi: bidi-override; }
```

The `unicode-bidi: bidi-override` property **forces all text to render left-to-right**, completely breaking RTL languages:
- Persian / Farsi
- Arabic
- Hebrew

Individual characters within words are reversed, making the text unreadable.

**Related issues:** #29754, #29658, #29662, #29545

## The Fix

Change `unicode-bidi` from `bidi-override` to `normal`:

```css
* { direction: ltr; unicode-bidi: normal; }
```

This allows the browser's native **Unicode Bidirectional Algorithm (BIDI)** to handle RTL text correctly, while keeping the overall layout direction left-to-right. Mixed RTL/LTR content (e.g., Hebrew + English) works correctly with this change.

## Installation (Plugin Method — Auto-patches on every session start)

```bash
cp -r plugins/rtl-text-support ~/.claude/plugins/
```

The plugin's `SessionStart` hook automatically detects and patches the installed extension's CSS on every Claude Code session start. It covers:
- `~/.vscode/extensions/anthropic.claude-code-*/webview/index.css`
- `~/.vscode-server/extensions/...` (remote SSH)
- `~/.cursor/extensions/...` (Cursor IDE)
- macOS paths under `~/Library/Application Support/`

> **Note:** The fix must be re-applied after each extension update. The plugin handles this automatically.

## Quick Fix (Standalone Script Method)

If you prefer a one-time manual fix:

```bash
chmod +x scripts/fix-rtl-css.sh
./scripts/fix-rtl-css.sh
```

Then reload VSCode: `Ctrl+Shift+P` → `Developer: Reload Window`

## Manual Fix

Locate and edit the file directly:

```bash
# Find the file
find ~/.vscode/extensions -name 'index.css' -path '*/anthropic.claude-code-*/webview/*'

# Apply the fix (Linux)
sed -i 's/unicode-bidi: bidi-override/unicode-bidi: normal/g' <path-to-index.css>

# Apply the fix (macOS)
sed -i '' 's/unicode-bidi: bidi-override/unicode-bidi: normal/g' <path-to-index.css>
```

## Files

| File | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin metadata |
| `hooks/hooks.json` | SessionStart hook configuration |
| `hooks-handlers/session-start.sh` | Auto-patches extension CSS at session start |
| `../../scripts/fix-rtl-css.sh` | Standalone one-time patch script |
