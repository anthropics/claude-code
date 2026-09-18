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

### False "usage limit reached" when plan quota is available

If Claude shows "usage limit reached" but your plan dashboard
shows plenty of quota remaining, the real cause is likely
**context overflow misattributed as a usage limit**.

**The actual chain**:
1. Context grows past the model's window (e.g. 200k tokens)
2. `/compact` fails: "Extra usage is required for 1M context"
3. The error surfaces to the user as "usage limit reached"

**Workaround**:
```bash
# Switch to a 1M context model, compact, then switch back
/model         # select a 1M model
/compact       # compact succeeds on 1M tier
/model         # switch back to your preferred model
```

Or start a new session.

**Root cause**: the client maps the `/compact` failure to the wrong
error message. See issues [#50321](https://github.com/anthropics/claude-code/issues/50321)
and [#61703](https://github.com/anthropics/claude-code/issues/61703).

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on all available managed settings.
