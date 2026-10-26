# protect-mcp

A fail-closed policy gate and signed receipts for Claude Code tool calls.

`security-guidance` warns about risky patterns. This plugin goes one step further: it **blocks** a tool call that breaks your policy before it runs, and **signs** an offline-verifiable receipt of every decision. It is powered by [`protect-mcp`](https://www.npmjs.com/package/protect-mcp) (MIT), which runs locally and sends no telemetry.

## What it does

- **PreToolUse gate.** Every `Bash`, `Write`, `Edit`, `MultiEdit`, and `NotebookEdit` call is evaluated against a [Cedar](https://www.cedarpolicy.com/) policy (the same language AWS uses for IAM). If the policy denies it, the hook exits non-zero and Claude Code blocks the call. The gate **fails closed**: on any policy error or a missing engine it denies, it never silently allows.
- **PostToolUse receipts.** Each decision is signed into an Ed25519 receipt that anyone can verify offline with [`@veritasacta/verify`](https://www.npmjs.com/package/@veritasacta/verify), with no vendor in the loop.
- **An MCP server too.** `.mcp.json` also registers protect-mcp as a `serve --enforce` MCP server, so MCP-routed tools are covered as well.

## Requirements

Node.js 18+ (the hooks call `npx -y protect-mcp`, which auto-fetches the package; nothing to install by hand).

## Try it

The bundled `policies/protect.cedar` blocks obviously destructive shell commands and allows everything else. With the plugin enabled:

- Ask Claude to run `ls -la` -> allowed, and a receipt is recorded.
- Ask Claude to run `rm -rf` on something -> blocked before it runs, with the policy reason.

## Customize the policy

Edit `policies/protect.cedar`, or point the hook at your own directory by changing the `--cedar` path in `hooks/hooks.json`. Use `["a","b"].contains(context.x)` for set membership and `context.x like "..."` for globs. Do **not** write `context.x in ["a","b"]`: `in` is Cedar's entity-hierarchy operator, it type-errors on a string, and Cedar silently discards the rule (the fail-open class of bug this gate exists to prevent, see GHSA-hm46-7j72-rpv9).

## Turn on real signatures

Out of the box the `sign` hook records an honest **unsigned** line when no key is present, so it never blocks a tool. To produce verifiable signatures, generate a keypair once in your project:

```bash
npx protect-mcp@latest init    # writes ./keys/gateway.json
```

Then verify the receipt chain offline at any time:

```bash
npx @veritasacta/verify ./receipts/receipts.jsonl --format jsonl
```

## Notes

- Receipt wire format: [draft-farley-acta-signed-receipts](https://datatracker.ietf.org/doc/draft-farley-acta-signed-receipts/) (IETF Internet-Draft).
- Authorship: contributed by the author of the open-source `protect-mcp` and `@veritasacta/verify` packages (MIT and Apache-2.0). The plugin depends on those public npm packages and nothing proprietary.
