---
name: protect-mcp
description: >
  Cryptographic receipt signing and Cedar policy enforcement for AI agent
  tool calls. Every tool invocation produces an Ed25519-signed receipt
  verifiable offline by anyone, without trusting the issuer.
version: 0.7.1
trigger: when the user mentions security, audit, receipts, compliance, governance, or verification for tool calls
allowed-tools:
  - Bash
  - Read
---

# protect-mcp — Agent Governance with Cryptographic Receipts

## What This Does

Adds two layers to every tool call:

1. **Cedar policy enforcement** — evaluate allow/deny decisions using the same
   authorization engine AWS uses for IAM. Policies are declarative `.cedar` files.
2. **Ed25519 receipt signing** — each tool call produces a tamper-evident receipt.
   If the record is modified after signing, the signature breaks. Anyone can
   verify offline without trusting the issuer.

## Setup

```bash
# One-time: configure Claude Code hooks
npx protect-mcp@0.7.0 init-hooks

# Start the hook server (runs on port 9377)
npx protect-mcp@0.7.0 serve --enforce
```

This configures Claude Code to POST every tool call event to protect-mcp for
policy evaluation and receipt signing. First run auto-generates permissive
Cedar policies that you can tighten.

## Usage

Once running, protect-mcp operates silently. Every tool call:
- Is evaluated against Cedar policies (allow/deny/ask)
- Produces a signed receipt in `.protect-mcp-log.jsonl`
- Decision is returned to Claude Code within ~1ms

## Verify Receipts

```bash
# Verify all receipts in the log
npx @veritasacta/verify .protect-mcp-log.jsonl

# Verify a single receipt
npx @veritasacta/verify receipt.json
```

## What a Receipt Looks Like

```json
{
  "type": "protectmcp:decision",
  "tool_name": "Bash",
  "decision": "allow",
  "policy_digest": "sha256:a3f8...",
  "issued_at": "2026-04-04T12:00:00Z",
  "signature": { "alg": "EdDSA", "sig": "..." }
}
```

## Cedar Policy Example

```cedar
// Block destructive commands
forbid (
  principal,
  action == Action::"tool_call",
  resource == Tool::"Bash"
) when {
  context.input.command like "rm -rf *"
};
```

## Links

- npm: https://npmjs.com/package/protect-mcp
- Source: https://github.com/scopeblind/scopeblind-gateway
- IETF Draft: https://datatracker.ietf.org/doc/draft-farley-acta-signed-receipts/
- Merged into Microsoft Agent Governance Toolkit (PR #667)
