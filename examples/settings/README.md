# Settings Examples

Example Claude Code settings files, primarily intended for organization-wide deployments. Use these as starting points — adjust them to fit your needs.

These may be applied at any level of the [settings hierarchy](https://code.claude.com/docs/en/settings#settings-files), though certain properties only take effect if specified in enterprise settings (e.g. `strictKnownMarketplaces`, `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`).


## Configuration Examples

> [!WARNING]
> These examples are community-maintained snippets which may be unsupported or incorrect. You are responsible for the correctness of your own settings configuration.

| Setting | [`settings-lax.json`](./settings-lax.json) | [`settings-recommended.json`](./settings-recommended.json) | [`settings-strict.json`](./settings-strict.json) | [`settings-bash-sandbox.json`](./settings-bash-sandbox.json) |
|---------|:---:|:---:|:---:|:---:|
| Disable `--dangerously-skip-permissions` | ✅ | ✅ | ✅ | |
| Block plugin marketplaces | ✅ | ✅ | ✅ | |
| Pre-allow safe read-only commands (git status, ls, etc.) | | ✅ | | |
| Deny dangerous commands (rm -rf, chmod 777, curl\|bash, etc.) | | ✅ | | |
| Deny force-push to main/master | | ✅ | | |
| Bash tool must run inside of sandbox | | ✅ | | ✅ |
| Block user and project-defined permission `allow` / `ask` / `deny` | | | ✅ | ✅ |
| Block user and project-defined hooks | | | ✅ | |
| Deny web fetch and search tools | | | ✅ | |
| Bash tool requires approval | | | ✅ | |

## Known Limitations

> [!CAUTION]
> The `permissions.deny` patterns have known limitations. Be aware of these when designing your security configuration.

- **Shell builtins may bypass deny patterns** ([#40730](https://github.com/anthropics/claude-code/issues/40730)): Commands like `source .env` and `. .env` may not be caught by deny rules when invoked with absolute paths. Use a [PreToolUse hook](../hooks/bash_command_validator_example.py) for more reliable blocking.
- **Session-level permission caching with sandbox** ([#40384](https://github.com/anthropics/claude-code/issues/40384)): When sandbox mode is enabled, approving a command once may cache the approval for the entire session. If you need to hard-block specific commands, add them to `permissions.deny` rather than relying on absence from `permissions.allow`.
- **`additionalDirectories` are global, not project-scoped** ([#40606](https://github.com/anthropics/claude-code/issues/40606)): Directories approved in one project persist in `~/.claude/settings.json` and are visible in other projects. Periodically review and clean up your global `additionalDirectories` list.

## Tips
- Consider merging snippets of the above examples to reach your desired configuration
- Settings files must be valid JSON
- Before deploying configuration files to your organization, test them locally by applying to `managed-settings.json`, `settings.json` or `settings.local.json`
- The `sandbox` property only applies to the `Bash` tool; it does not apply to other tools (like Read, Write, WebSearch, WebFetch, MCPs), hooks, or internal commands

## Deploying via MDM

To distribute these settings as enterprise-managed policy through Jamf, Iru (Kandji), Intune, or Group Policy, see the deployment templates in [`../mdm`](../mdm).

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on all available managed settings.
