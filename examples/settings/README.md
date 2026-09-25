# Settings Examples

Example Claude Code settings files, primarily intended for organization-wide deployments. Use these as starting points - adjust them to fit your needs.

These may be applied at any level of the [settings hierarchy](https://code.claude.com/docs/en/settings#settings-files), though certain properties only take effect if specified in enterprise settings (e.g. `strictKnownMarketplaces`, `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`).


## Configuration Examples

> [!WARNING]
> These examples are community-maintained snippets which may be unsupported or incorrect. You are responsible for the correctness of your own settings configuration.

| Setting | [`settings-lax.json`](./settings-lax.json) | [`settings-strict.json`](./settings-strict.json) | [`settings-bash-sandbox.json`](./settings-bash-sandbox.json) |
|---------|:---:|:---:|:---:|
| Disable `--dangerously-skip-permissions` | ? | ? | |
| Block plugin marketplaces | ? | ? | |
| Block user and project-defined permission `allow` / `ask` / `deny` | | ? | ? |
| Block user and project-defined hooks | | ? | |
| Deny web fetch and search tools | | ? | |
| Bash tool requires approval | | ? | |
| Bash tool must run inside of sandbox | | | ? |

## Tips
- Consider merging snippets of the above examples to reach your desired configuration
- Settings files must be valid JSON
- Before deploying configuration files to your organization, test them locally by applying to `managed-settings.json`, `settings.json` or `settings.local.json`
- The `sandbox` property only applies to the `Bash` tool; it does not apply to other tools (like Read, Write, WebSearch, WebFetch, MCPs), hooks, or internal commands

## Deploying via MDM

To distribute these settings as enterprise-managed policy through Jamf, Iru (Kandji), Intune, or Group Policy, see the deployment templates in [`../mdm`](../mdm).

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on all available managed settings.

## Troubleshooting

### Terminal scroll jumps to top during streaming (scroll yank)

If the terminal scroll position jumps to the top during streaming output (a "stroboscope" flicker), this is caused by an `ED2` (Erase Display) escape sequence being emitted inside a DEC 2026 synchronized update block, which resets the terminal's scroll position. This is a known interaction between Claude Code's TUI renderer (ink) and the xterm.js terminal library used by VS Code and Cursor.

**Workaround:** Use a native terminal app (macOS Terminal.app, iTerm2, Kitty, Ghostty) instead of VS Code/Cursor's integrated terminal. If you must use VS Code, set `"terminal.integrated.gpuAcceleration": "off"` to mitigate the issue.