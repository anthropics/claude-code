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
├── ledger.db          # SQLite database (unified storage)
├── preferences.json   # Your settings
├── sessions/          # Session state files (legacy)
├── audit/             # Audit records (legacy)
└── r6/                # R6 workflow logs
```

The SQLite ledger uses WAL mode for concurrent access, allowing multiple
parallel sessions to write simultaneously without conflicts.

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

### Heartbeat Tracking

Every tool call records a timing heartbeat:

```json
{
  "sequence": 47,
  "timestamp": "2026-01-24T06:30:00Z",
  "status": "on_time",
  "delta_seconds": 45.2,
  "tool_name": "Edit",
  "entry_hash": "a1b2c3d4..."
}
```

**Timing status:**
- `on_time` - Normal interval (30-90 seconds)
- `early` - Faster than expected
- `late` - Slower than expected
- `gap` - Long pause (>3 minutes)

**Timing coherence** score (0.0-1.0) indicates session regularity. Irregular patterns may indicate interruptions or context switches.

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
├── ledger.db            # SQLite database (primary storage)
│   ├── identities       # Soft LCT tokens
│   ├── sessions         # Session tracking, ATP accounting
│   ├── session_sequence # Atomic session numbering per project
│   ├── heartbeats       # Timing coherence records
│   ├── audit_trail      # Tool use records
│   └── work_products    # Files, commits registered
├── preferences.json     # User preferences
├── sessions/            # Session state (legacy JSON)
├── audit/               # Audit records (legacy JSONL)
└── r6/                  # R6 request logs
```

The SQLite ledger provides:
- **Unified storage** - All data in one file
- **Concurrent access** - WAL mode for parallel sessions
- **Atomic operations** - No duplicate session numbers
- **Cross-table queries** - Join heartbeat + audit data

## Why R6?

The R6 framework provides:

1. **Structured Intent** - Every action has documented purpose
2. **Audit Foundation** - Machine-readable action history
3. **Context Preservation** - Reference links maintain history
4. **Trust Basis** - Verifiable record for trust evaluation
5. **Policy Hook** - Rules component enables future enforcement

R6 is observational by default - it records, doesn't block. This makes it safe to deploy without disrupting workflows.

## Governance Module

The plugin includes a Python governance module (`governance/`):

```python
from governance import Ledger, SoftLCT, SessionManager

# Start a session with automatic numbering
sm = SessionManager()
session = sm.start_session(project='my-project', atp_budget=100)
print(f"Session #{session['session_number']}")

# Record actions
sm.record_action('Edit', target='src/main.py', status='success')

# Register work products
sm.register_work_product('file', path='output.md')

# Get session summary
print(sm.get_session_summary())
```

**ATP Accounting**: Each session has an action budget (default 100). Actions consume ATP, enabling cost tracking.

## Web4 Ecosystem

This plugin implements a subset of the [Web4 trust infrastructure](https://github.com/dp-web4/web4):

| Concept | This Plugin | Full Web4 |
|---------|-------------|-----------|
| Identity | Software token (Soft LCT) | LCT (hardware-bound) |
| Workflow | R6 framework | R6 + Policy enforcement |
| Audit | SQLite ledger | Distributed ledger |
| Timing | Heartbeat coherence | Grounding lifecycle |
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
