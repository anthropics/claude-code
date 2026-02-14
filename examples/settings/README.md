# Settings Examples

Example Claude Code settings files, primarily intended for organization-wide deployments. Use these are starting points — adjust them to fit your needs.

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

### AWS Bedrock Guardrails

[`settings-bedrock-guardrails.json`](./settings-bedrock-guardrails.json) — Configures Claude Code to use AWS Bedrock with [Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html). Set `BEDROCK_GUARDRAIL_IDENTIFIER` to your guardrail ID or ARN and `BEDROCK_GUARDRAIL_VERSION` to the version (e.g. `"1"` or `"DRAFT"`). Requires `@anthropic-ai/bedrock-sdk` with guardrail support (see [anthropic-sdk-typescript](https://github.com/anthropics/anthropic-sdk-typescript/tree/main/packages/bedrock-sdk)).

## Tips
- Consider merging snippets of the above examples to reach your desired configuration
- Settings files must be valid JSON
- Before deploying configuration files to your organization, test them locally by applying to `managed-settings.json`, `settings.json` or `settings.local.json`
- The `sandbox` property only applies to the `Bash` tool; it does not apply to other tools (like Read, Write, WebSearch, WebFetch, MCPs), hooks, or internal commands

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on all available managed settings.
