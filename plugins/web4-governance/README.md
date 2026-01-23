# Web4 Governance Plugin for Claude Code

Lightweight AI governance with R6 workflow formalism and audit trails.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This plugin adds structured governance to Claude Code sessions:

- **R6 Workflow** - Every tool call follows a formal intent→action→result flow
- **Audit Trail** - Verifiable chain of actions with provenance
- **Session Identity** - Software-bound tokens for session tracking

No external dependencies. No network calls. Just structured, auditable AI actions.

## Installation

### Option 1: Plugin Marketplace (Recommended)

```
/plugin install web4-governance
```

### Option 2: Manual Setup

For standalone installation or development:

```bash
# Run the deployment script
./deploy.sh

# Then add hooks to your project's .claude/settings.local.json
# (The script will display the configuration)
```

### First Run Setup

The plugin creates `~/.web4/` on first session:

```bash
~/.web4/
├── preferences.json   # Your settings
├── sessions/          # Session state files
├── audit/             # Audit records
└── r6/                # R6 workflow logs
```

## What It Does

### Every Tool Call Gets an R6 Record

The R6 framework captures structured intent:

```
R6 = Rules + Role + Request + Reference + Resource → Result
```

| Component | What It Captures |
|-----------|------------------|
| **Rules** | Preferences and constraints |
| **Role** | Session identity, action index |
| **Request** | Tool name, category, target |
| **Reference** | Chain position, previous R6 |
| **Resource** | (Optional) Estimated cost |
| **Result** | Status, output hash |

### Audit Trail with Provenance

Each action creates an audit record linked to its R6 request:

```json
{
  "record_id": "audit:f8e9a1b2",
  "r6_request_id": "r6:f8e9a1b2",
  "tool": "Edit",
  "category": "file_write",
  "target": "src/main.rs",
  "result": {
    "status": "success",
    "output_hash": "a1b2c3d4..."
  },
  "provenance": {
    "session_id": "abc123",
    "action_index": 47,
    "prev_record_hash": "..."
  }
}
```

Records form a hash-linked chain, enabling verification.

### Session Identity

Sessions get a software-bound token:

```
web4:session:a1b2c3d4
```

This is **not** hardware-bound (no TPM/Secure Enclave). Trust interpretation is up to the relying party. For hardware-bound identity, see [Hardbound](https://github.com/dp-web4/hardbound).

## Commands

| Command | Description |
|---------|-------------|
| `/audit` | Show session audit summary |
| `/audit last 10` | Show last 10 actions |
| `/audit verify` | Verify chain integrity |
| `/audit export` | Export audit log |

## Configuration

Create `~/.web4/preferences.json`:

```json
{
  "audit_level": "standard",
  "show_r6_status": true,
  "action_budget": null
}
```

**audit_level**:
- `minimal` - Just record, no output
- `standard` - Session start message
- `verbose` - Show each R6 request

## Files

```
~/.web4/
├── preferences.json     # User preferences
├── sessions/            # Session state
│   └── {session_id}.json
├── audit/               # Audit records
│   └── {session_id}.jsonl
└── r6/                  # R6 request logs
    └── {date}.jsonl
```

## Why R6?

The R6 framework provides:

1. **Structured Intent** - Every action has documented purpose
2. **Audit Foundation** - Machine-readable action history
3. **Context Preservation** - Reference links maintain history
4. **Trust Basis** - Verifiable record for trust evaluation
5. **Policy Hook** - Rules component enables future enforcement

R6 is observational by default - it records, doesn't block. This makes it safe to deploy without disrupting workflows.

## Web4 Ecosystem

This plugin implements a subset of the [Web4 trust infrastructure](https://github.com/dp-web4/web4):

| Concept | This Plugin | Full Web4 |
|---------|-------------|-----------|
| Identity | Software token | LCT (hardware-bound) |
| Workflow | R6 framework | R6 + Policy enforcement |
| Audit | Hash-linked chain | Distributed ledger |
| Trust | (Relying party decides) | T3 Trust Tensor |

For enterprise features (hardware binding, team governance, policy enforcement), see [Hardbound](https://github.com/dp-web4/hardbound).

## Contributing

Contributions welcome! This plugin is MIT licensed.

Areas for contribution:
- Additional audit visualizations
- R6 analytics and insights
- Integration with external audit systems
- Performance optimizations

## License

MIT License - see [LICENSE](LICENSE)

## Links

- [Web4 Specification](https://github.com/dp-web4/web4)
- [R6 Framework Spec](https://github.com/dp-web4/web4/blob/main/web4-standard/core-spec/r6-framework.md)
- [Hardbound (Enterprise)](https://github.com/dp-web4/hardbound)
