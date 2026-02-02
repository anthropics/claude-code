# Claude Code Savant

Expert explanations through 4 distinctive AI personas with intelligent question routing.

## Features

- **Smart Router**: Opus-powered question analysis that auto-detects the best persona
- **Multi-Language**: English, 한국어, 日本語, 中文 support
- **Default Mode**: Always-on auto-routing for seamless experience
- **4 Expert Personas**: Each with unique strengths

## Personas

| Persona | Command | Specialty |
|---------|---------|-----------|
| 🧠 Einstein (The Professor) | `/savant-question` | First principles explanations, deep understanding |
| 🎭 Shakespeare (The Bard) | `/savant-code` | Code narratives with Mermaid flowcharts |
| 💡 Steve Jobs (The Visionary) | `/savant-new` | Bold project direction and breakthrough ideas |
| 🔍 Socrates (The Debugger) | `/savant-fix` | Error analysis and root cause investigation |

## Commands

| Command | Description |
|---------|-------------|
| `/savant-setup` | First-time configuration wizard |
| `/savant-lang [en/kr/jp/ch]` | Change response language |
| `/savant-default` | Enable always-on auto-routing |
| `/savant-default-off` | Disable auto-routing |
| `/savant [question]` | Smart router - auto-detect best persona |
| `/savant-question` | Einstein - deep conceptual explanations |
| `/savant-code` | Shakespeare - code analysis with flowcharts |
| `/savant-new` | Steve Jobs - visionary project direction |
| `/savant-fix` | Socrates - error debugging and root cause |
| `/savant-update` | Check for updates |

## Usage Examples

```bash
# Let AI choose the best persona
/savant What is dependency injection?

# Deep explanation (Einstein)
/savant-question What is MCP?

# Code analysis (Shakespeare)
/savant-code Analyze this function

# Project direction (Steve Jobs)
/savant-new What should be the next feature?

# Debug error (Socrates)
/savant-fix NullPointerException at line 42
```

## How Smart Router Works

1. Analyzes your question using Opus model
2. Detects signals (conceptual, code, direction, error)
3. Recommends best persona with confidence level
4. Asks for confirmation before proceeding
5. Executes with chosen persona

## Multi-Language Support

```bash
/savant-lang en   # English
/savant-lang kr   # 한국어
/savant-lang jp   # 日本語
/savant-lang ch   # 中文
```

## Plugin Structure

```
claude-code-savant/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── router.md        # Smart question analyzer
│   ├── einstein.md      # First principles expert
│   ├── shakespeare.md   # Code narrative expert
│   ├── stevejobs.md     # Visionary direction
│   └── socrates.md      # Error debugging expert
└── commands/
    ├── install.md       # Auto-runs on first install
    ├── setup.md         # Manual setup wizard
    ├── lang.md          # Language settings
    ├── default.md       # Enable default mode
    ├── default-off.md   # Disable default mode
    ├── savant.md        # Smart router
    ├── savant-question.md
    ├── savant-code.md
    ├── savant-new.md
    ├── savant-fix.md
    └── update.md
```

## Author

Created by [@rlaope](https://github.com/rlaope)

## License

MIT
