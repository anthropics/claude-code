# Settings Examples

Example Claude Code settings files, primarily intended for organization-wide deployments. Use these as starting points — adjust them to fit your needs.

These may be applied at any level of the [settings hierarchy](https://code.claude.com/docs/en/settings#settings-files), though certain properties only take effect if specified in enterprise settings (e.g. `strictKnownMarketplaces`, `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`).


## Configuration Examples

> [!WARNING]
> These examples are community-maintained snippets which may be unsupported or incorrect. You are responsible for the correctness of your own settings configuration.

| Setting | [`settings-lax.json`](./settings-lax.json) | [`settings-strict.json`](./settings-strict.json) | [`settings-bash-sandbox.json`](./settings-bash-sandbox.json) |
|---------|:---:|:---:|:---:|
| Disable `--dangerously-skip-permissions` | ✅ | ✅ | |
| Block plugin marketplaces | ✅ | ✅ | |
| Block user and project-defined permission `allow` / `ask` / `deny` | | ✅ | ✅ |
| Block user and project-defined hooks | | ✅ | |
| Deny web fetch and search tools | | ✅ | |
| Bash tool requires approval | | ✅ | |
| Bash tool must run inside of sandbox | | | ✅ |

## Tips
- Consider merging snippets of the above examples to reach your desired configuration
- Settings files must be valid JSON
- Before deploying configuration files to your organization, test them locally by applying to `managed-settings.json`, `settings.json` or `settings.local.json`
- The `sandbox` property only applies to the `Bash` tool; it does not apply to other tools (like Read, Write, WebSearch, WebFetch, MCPs), hooks, or internal commands

## Deploying via MDM

To distribute these settings as enterprise-managed policy through Jamf, Iru (Kandji), Intune, or Group Policy, see the deployment templates in [`../mdm`](../mdm).

## Troubleshooting

### Model identifier invalid after update

If you see `API Error: 400 The provided model identifier is invalid`
after an update, the update may have changed the default model ID
while your regional API endpoint still expects the old format.

This commonly affects users in APAC/EU regions using the desktop app
or Bedrock, where model IDs like `claude-opus-4-7` may not be recognized.

**Workarounds**:
- Select a different model in the model picker (e.g. `claude-sonnet-4-6`)
- Clear settings: delete `settings.json` from the app config directory
- If using Bedrock, verify region prefix: `apac.` / `eu.` / `us.`
- If `AWS_REGION` / `CLAUDE_CODE_USE_BEDROCK` env vars are set, unset them — they cause the model resolver to pick up Bedrock region prefixes while the desktop auth flow calls the direct Anthropic API, rejecting the prefixed model ID with 400

See issue [#61707](https://github.com/anthropics/claude-code/issues/61707).

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on all available managed settings.
