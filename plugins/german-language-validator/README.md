# German Language Validator Plugin

A Claude Code plugin that validates German text for correct umlaut usage (ä, ö, ü, ß) during Write and Edit operations.

## Problem

When working with German language content, AI assistants frequently write incorrect umlaut representations:
- `fuer` instead of `für`
- `ueber` instead of `über`
- `koennen` instead of `können`
- `groesse` instead of `Größe`
- `strasse` instead of `Straße`

These errors can cause issues in production code, documentation, and user-facing content.

## Solution

This plugin automatically validates text content before it's written or edited, checking for common German umlaut mistakes and blocking the operation with a warning if errors are found.

## Installation

```bash
# Enable the plugin in your settings.json
{
  "enabledPlugins": {
    "german-language-validator@anthropic": true
  }
}
```

Or install manually by copying the plugin to your `.claude/plugins` directory.

## Supported File Types

The validator checks these file extensions:
- `.md`, `.txt` - Documentation
- `.html`, `.htm` - Web content
- `.tsx`, `.ts`, `.jsx`, `.js` - JavaScript/TypeScript
- `.json` - Configuration files
- `.py` - Python files
- `.yml`, `.yaml` - YAML files
- `.xml`, `.vue` - Other markup

## Validated Words

The plugin checks for 35+ common German words including:

### Modal Verbs
- können, könnte, müssen, würden, würde

### Subjunctive Forms
- hätte, wäre, möchte, mögen

### Common Nouns & Adjectives
- Größe, große, Straße, Änderung, Lösung
- ähnlich, später, nächste, öffentlich
- natürlich, verfügbar, gültig, ungültig

### Common Verbs
- ändern, öffnen, prüfen, löschen
- schließen, heißen, führen, zurück

## Customization

To add more words to validate, edit `hooks/umlaut_validator.py` and add entries to the `UMLAUT_RULES` list:

```python
(re.compile(r'\byourword\b', re.IGNORECASE), 'correct', 'yourword → correct'),
```

## Behavior

- **Blocks** Write/Edit operations that contain umlaut errors
- Shows a warning message listing all found errors
- Does not modify content automatically (user must fix)

To change to warning-only mode (don't block), change `sys.exit(2)` to `sys.exit(0)` in the validator.

## License

MIT
