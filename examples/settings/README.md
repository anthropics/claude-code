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

### FleetView remote session entries persist after TUI exits (zombie entries)

After closing the FleetView TUI (`claude agents`), the remote session entry on the Code tab (Claude Desktop / mobile apps) remains visible for 10+ minutes with no cleanup. Entries accumulate with each FleetView invocation and tapping them produces no response.

**Root cause:** The relay connection teardown when the TUI exits does not trigger server-side entry removal. There is no client-side API to unregister the entry on graceful exit, and no heartbeat timeout to detect disconnects.

**No workaround available.** Keep FleetView open in a dedicated tmux/screen session to minimize re-invocations. Zombie entries eventually clear after an unknown server-side timeout period.