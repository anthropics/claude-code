# CJK IME Helper Plugin

Workarounds and utilities for CJK (Chinese, Japanese, Korean) IME input issues in Claude Code terminal.

## Problem

Claude Code uses React Ink for terminal UI rendering. Due to limitations in terminal raw mode, IME (Input Method Editor) composition characters are invisible during typing. CJK users must type "blind" — characters only appear after pressing Enter.

This affects:
- **Korean** (한국어) — Hangul jamo composition invisible
- **Japanese** (日本語) — Hiragana/Katakana conversion invisible
- **Chinese** (中文) — Pinyin composition invisible
- **Vietnamese** — Telex composition invisible

## What This Plugin Does

### 1. Session Start Detection (Hook)

Automatically detects CJK locale at session start and displays a helpful notice with workaround tips in the user's language.

### 2. `/cjk-paste` Command

Clipboard-based input workaround:

1. Compose CJK text in any external editor (Notes, TextEdit, VS Code, etc.)
2. Copy to clipboard (`Cmd+C` / `Ctrl+C`)
3. Run `/cjk-paste` in Claude Code
4. Plugin reads clipboard and processes it as your prompt

```
> /cjk-paste
Clipboard content: "이 프로젝트의 구조를 설명해줘"
Processing your request...
```

### 3. `/cjk-status` Command

Diagnose your CJK input environment:

```
> /cjk-status

=== CJK IME Status ===
Language:   Korean (ko_KR.UTF-8)
Platform:   macOS (Darwin)
Clipboard:  ✅ Available (pbpaste)

=== Workarounds ===
1. /cjk-paste  - Read from clipboard (recommended)
2. Cmd+V       - Direct paste from external editor
3. Use IDE integration for better IME support
```

### 4. CJK Awareness Skill

Automatically activates when CJK language is detected, making Claude more patient and helpful with potentially garbled input from blind typing.

## Installation

Install via Claude Code plugin system:

```bash
claude /plugin install cjk-ime-helper
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": ["cjk-ime-helper"]
}
```

## Plugin Structure

```
cjk-ime-helper/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── commands/
│   ├── cjk-paste.md         # Clipboard input command
│   └── cjk-status.md        # Environment diagnostic command
├── hooks/
│   ├── hooks.json            # Hook configuration
│   └── cjk_session_hook.py   # CJK locale detection hook
├── skills/
│   └── cjk-awareness.md      # CJK-aware interaction skill
└── README.md
```

## Supported Platforms

| Platform | Clipboard | Status |
|----------|-----------|--------|
| macOS | `pbpaste` | ✅ Full support |
| Linux | `xclip` / `xsel` | ✅ Full support |
| Windows (WSL) | `powershell.exe Get-Clipboard` | ✅ Full support |
| Windows (native) | `powershell Get-Clipboard` | ✅ Full support |

## Related Issues

- [anthropics/claude-code#22732](https://github.com/anthropics/claude-code/issues/22732) — Korean IME invisible during composition
- [anthropics/claude-code#18291](https://github.com/anthropics/claude-code/issues/18291) — Korean jamo not displayed
- [anthropics/claude-code#16322](https://github.com/anthropics/claude-code/issues/16322) — Composition at wrong position
- [anthropics/claude-code#3045](https://github.com/anthropics/claude-code/issues/3045) — React Ink IME investigation

## Contributing

This plugin provides workarounds while the core IME issue is being resolved upstream. Contributions welcome:

1. Additional language-specific tips
2. Better clipboard integration
3. Platform-specific IME detection improvements
4. Terminal-specific workarounds (iTerm2, Kitty, Alacritty, etc.)

## License

MIT — Same as Claude Code
