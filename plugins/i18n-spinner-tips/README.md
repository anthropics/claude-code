# i18n-spinner-tips

Bilingual spinner tips for Claude Code — learn dev tricks while Claude thinks, in your language.

Every time Claude Code displays "Thinking...", a random bilingual tip appears below the spinner. Each tip pairs **English with your local language**, making it useful for developers worldwide.

```
⠋ Thinking...
  💡 git reflog 找回任何删除的 commit | git reflog recovers deleted commits
```

## Supported Languages

| Code | Language | Tips |
|------|----------|------|
| `zh` | Chinese / 中文 | 30 |
| `ja` | Japanese / 日本語 | 30 |
| `ko` | Korean / 한국어 | 30 |
| `fr` | French / Français | 30 |
| `es` | Spanish / Español | 30 |
| `de` | German / Deutsch | 30 |
| `pt` | Portuguese / Português | 30 |
| `ru` | Russian / Русский | 30 |

## What You'll Learn

Each language pack includes 30 curated tips across 5 categories:

| Category | Count | Examples |
|----------|-------|----------|
| **Claude Code** | 12 | Esc, Shift+Tab, /compact, /plan, @files, # memory |
| **Best Practices** | 4 | Break tasks down, TDD workflow, CLAUDE.md rules |
| **Git** | 6 | reflog, bisect, stash -p, diff --stat |
| **JS/TS + Python** | 6 | structuredClone, groupBy, f-string=, pathlib |
| **Shell + Wisdom** | 2 | Ctrl+R, jq, Knuth quotes |

## Quick Install

```bash
# Install Chinese+English tips (default)
bash install.sh

# Install Japanese+English tips
bash install.sh ja

# Install any supported language
bash install.sh ko   # Korean
bash install.sh fr   # French
bash install.sh es   # Spanish
bash install.sh de   # German
bash install.sh pt   # Portuguese
bash install.sh ru   # Russian
```

The installer merges tips into `~/.claude/settings.json` via `spinnerTipsOverride`. All official tips are preserved (`excludeDefault: false`).

## How It Works

Claude Code's `spinnerTipsOverride` setting injects custom tips that display inline below the "Thinking..." spinner. Non-intrusive, no popups, works in any terminal.

- Tips are purely additive — official tips are never replaced
- One random tip per thinking cycle
- Zero dependencies, zero config beyond install

## Plugin Structure

```
i18n-spinner-tips/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── session-start.json
├── hooks-handlers/
│   └── inject-tips.md
├── tips/
│   ├── zh.json
│   ├── ja.json
│   ├── ko.json
│   ├── fr.json
│   ├── es.json
│   ├── de.json
│   ├── pt.json
│   └── ru.json
├── install.sh
└── README.md
```

## Contributing

Want to add a new language? Create a `tips/{lang-code}.json` following the existing format:

```json
{
  "language": "xx",
  "label": "Language / Native Name",
  "tips": [
    "Local translation | English version",
    ...
  ]
}
```

Each tip follows the pattern: `Local language explanation | English explanation`

PRs welcome for new languages and additional tips!

## License

MIT
