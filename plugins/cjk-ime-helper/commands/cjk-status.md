# /cjk-status - Check CJK IME Environment Status

Diagnose your CJK input environment and show current workaround recommendations.

## Instructions

When the user runs this command, check and report the following:

1. **Locale Detection**: Run `echo $LANG $LC_ALL $LC_CTYPE` to detect the current locale
2. **Platform**: Detect macOS, Linux, or Windows (WSL)
3. **Terminal**: Check `$TERM_PROGRAM` or `$TERMINAL_EMULATOR` for the terminal app
4. **Clipboard Available**: Test if clipboard commands are available:
   - macOS: `which pbpaste`
   - Linux: `which xclip` or `which xsel`
   - WSL: test `powershell.exe`

5. Display a formatted status report:

```
=== CJK IME Status ===
Language:   Korean (ko_KR.UTF-8)
Platform:   macOS (Darwin)
Terminal:   iTerm2
Clipboard:  ✅ Available (pbpaste)

=== Known Issues ===
⚠️  IME composition characters may be invisible in the input field
⚠️  Characters only appear after pressing Enter

=== Workarounds ===
1. /cjk-paste  - Read from clipboard (recommended)
2. Cmd+V       - Direct paste from external editor
3. Use IDE integration (VS Code) for better IME support

=== Related Issues ===
- https://github.com/anthropics/claude-code/issues/22732
- https://github.com/anthropics/claude-code/issues/18291
```

## Usage

```
/cjk-status
```
