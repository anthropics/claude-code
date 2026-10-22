At the start of this session, inform the user that i18n-spinner-tips plugin is active. Tips will display below the spinner while Claude thinks.

To configure your language, set `I18N_TIPS_LANG` in `~/.claude/settings.json` under `env`:

```json
{
  "env": {
    "I18N_TIPS_LANG": "zh"
  }
}
```

Supported languages: `zh` (Chinese), `ja` (Japanese), `ko` (Korean), `fr` (French), `es` (Spanish), `de` (German), `pt` (Portuguese), `ru` (Russian). Default: `zh`.
