# language-orthography

Enforces full orthographic correctness when the `language` setting targets a non-ASCII language (Portuguese, French, Vietnamese, Czech, Turkish, Spanish, German, etc.).

## The problem

The built-in `language` setting injects a generic instruction like *"Always respond in pt-BR"*, which the model often interprets loosely — producing text without proper accents, cedillas, or other diacritical marks. This is especially noticeable in long sessions and after context compaction.

For example, with `language: "pt-BR"`:

| Expected | What you get |
|----------|-------------|
| informação | informacao |
| não | nao |
| código | codigo |
| você | voce |

## How it works

A `SessionStart` hook reads your `language` setting from `~/.claude/settings.json` (or `settings.local.json`) and injects an explicit orthographic enforcement instruction into the session context. This instruction frames diacritic omission as an orthographic error rather than a style choice, which makes the model treat it with the same weight as a spelling mistake in English.

The hook is a no-op if:
- No `language` setting is configured
- The language is English (`en`, `en-US`, `en-GB`, etc.)

## Installation

```bash
claude plugin add language-orthography
```

Or install from the repository:

```bash
/install-plugin plugins/language-orthography
```

## Configuration

No configuration needed beyond the standard `language` setting in your Claude Code settings:

```json
{
  "language": "pt-BR"
}
```

The plugin reads this value automatically.

## Limitations

This plugin works around the issue at the prompt level. It doesn't fix the underlying causes in the core CLI:

1. The built-in language instruction template should explicitly mention diacritical marks
2. CLAUDE.md instructions are wrapped in a disclaimer that weakens their authority
3. Context compaction doesn't carry language rules to the summarization step

See [#32886](https://github.com/anthropics/claude-code/issues/32886) for the full root cause analysis.
