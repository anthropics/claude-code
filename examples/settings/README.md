# Settings Examples

Example Claude Code settings files, primarily intended for organization-wide deployments. Use these as starting points -- adjust them to fit your needs.

These may be applied at any level of the [settings hierarchy](https://code.claude.com/docs/en/settings#settings-files), though certain properties only take effect if specified in enterprise settings (e.g. `strictKnownMarketplaces`, `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`).


## Configuration Examples

> [!WARNING]
> These examples are community-maintained snippets which may be unsupported or incorrect. You are responsible for the correctness of your own settings configuration.

| Setting | [`settings-lax.json`](./settings-lax.json) | [`settings-strict.json`](./settings-strict.json) | [`settings-bash-sandbox.json`](./settings-bash-sandbox.json) | [`settings-subprocess-hardening.json`](./settings-subprocess-hardening.json) |
|---------|:---:|:---:|:---:|:---:|
| Disable `--dangerously-skip-permissions` | ✅ | ✅ | | |
| Block plugin marketplaces | ✅ | ✅ | | |
| Block user and project-defined permission `allow` / `ask` / `deny` | | ✅ | ✅ | |
| Block user and project-defined hooks | | ✅ | | |
| Deny web fetch and search tools | | ✅ | | |
| Bash tool requires approval | | ✅ | | |
| Bash tool must run inside of sandbox | | | ✅ | ✅ |
| Scrub credentials from subprocesses | | | | ✅ |
| PID namespace isolation (Linux) | | | | ✅ |
| Per-session script invocation limits | | | | ✅ |

## Subprocess Hardening (Linux)

In addition to the Bash sandbox, Claude Code offers subprocess-level hardening through environment variables. These controls are complementary to the sandbox and operate independently. See [`settings-subprocess-hardening.json`](./settings-subprocess-hardening.json) for an example configuration.

### `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`

Set to `1` to strip Anthropic and cloud provider credentials from subprocess environments (Bash tool, hooks, MCP stdio servers). This reduces exposure to prompt injection attacks that attempt to exfiltrate secrets via shell expansion.

On **Linux**, enabling this variable also runs Bash subprocesses in an **isolated PID namespace** so they cannot read host process environments via `/proc`. As a side effect, `ps`, `pgrep`, and `kill` inside the sandbox cannot see or signal host processes.

This variable is set automatically by `claude-code-action` when `allowed_non_write_users` is configured.

> [!NOTE]
> PID namespace isolation is Linux-only. On macOS and Windows/WSL, enabling this variable still scrubs credentials from subprocess environments but does not create a PID namespace.

### `CLAUDE_CODE_SCRIPT_CAPS`

Set to a JSON object to limit how many times specific scripts may be invoked per session. This only takes effect when `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is set.

Keys are substrings matched against the command text; values are integer call limits. For example:

```bash
export CLAUDE_CODE_SCRIPT_CAPS='{"deploy.sh": 2, "terraform apply": 1}'
```

This allows `deploy.sh` to be called at most twice and `terraform apply` at most once per session.

Matching is substring-based, so shell-expansion tricks like `./scripts/deploy.sh $(evil)` still count against the cap. Runtime fan-out via `xargs` or `find -exec` is not detected -- this is a defense-in-depth control, not a hard boundary.

### When to use these controls

- **Managed deployments** where subprocesses should not have access to API keys or cloud credentials
- **CI/CD pipelines** where you want to limit how many times destructive scripts (deploys, migrations) can run
- **Security-sensitive environments** where process isolation between the agent and host is important

## Tips
- Consider merging snippets of the above examples to reach your desired configuration
- Settings files must be valid JSON
- Before deploying configuration files to your organization, test them locally by applying to `managed-settings.json`, `settings.json` or `settings.local.json`
- The `sandbox` property only applies to the `Bash` tool; it does not apply to other tools (like Read, Write, WebSearch, WebFetch, MCPs), hooks, or internal commands

## Deploying via MDM

To distribute these settings as enterprise-managed policy through Jamf, Iru (Kandji), Intune, or Group Policy, see the deployment templates in [`../mdm`](../mdm).

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on all available managed settings.
