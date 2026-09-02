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

### ScheduleWakeup lost after process crash / disconnect

`ScheduleWakeup` stores pending wakeups only in memory. If the session process dies (OOM, crash, terminal hang, cluster recycle), all scheduled wakeups are lost with no recovery mechanism. The session becomes silently stuck with no way to interrupt it remotely.

**Workaround:** Do not rely on `ScheduleWakeup` for critical autonomous tasks. Use an external scheduler (`systemd --user` timers, cron) instead. If you need long-running self-paced loops, set up a watchdog that monitors session liveness externally (e.g. a script that checks process existence and alerts via Telegram, email, or system notification).