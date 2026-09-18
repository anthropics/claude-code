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

### Stats cache `lastComputedDate` not advancing

If `/usage` or the stats dashboard shows stale data and
`~/.claude/stats-cache.json` has an old `lastComputedDate`, the
incremental recompute may be silently failing.

**Check**:
```bash
jq -r '.lastComputedDate' ~/.claude/stats-cache.json
```

**Fix** (force a full rebuild):
```bash
rm ~/.claude/stats-cache.json
# Restart Claude Code — cache will rebuild from all session files.
```

**Root cause**: three compounding bugs in the stats recompute pipeline:
1. Cache serialization fails on unknown model IDs (e.g. new models released after the cache froze) — `modelUsage` schema has no key for them
2. No error handling in incremental recompute — a single failure aborts the entire pass and `lastComputedDate` never advances
3. No staleness cap — once frozen, the cache stays frozen permanently with no forced full-rebuild fallback

**Proposed fix** (from community analysis, see [#61686](https://github.com/anthropics/claude-code/issues/61686)):
- Add a cache version field with auto-migration for schema changes
- Wrap per-session processing in try/catch — skip bad files, advance the cursor
- Force full rebuild if `lastComputedDate` is >30 days behind

## Full Documentation

See https://code.claude.com/docs/en/settings for complete documentation on all available managed settings.
