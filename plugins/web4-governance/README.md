# Web4 Governance Plugin for Claude Code

Lightweight AI governance with R6 workflow formalism, agent trust accumulation, and audit trails.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This plugin adds structured governance to Claude Code sessions:

- **R6 Workflow** - Every tool call follows a formal intent→action→result flow
- **Agent Trust** - T3/V3 tensors accumulate per agent role based on outcomes
- **Persistent References** - Agents learn patterns that persist across sessions
- **Heartbeat Coherence** - Timing-based session health tracking
- **Audit Trail** - Verifiable chain of actions with provenance

No external dependencies. No network calls. Just structured, auditable AI actions.

## What's New in v0.2

- **Agent Governance** - Claude Code agents map to Web4 role entities
- **Trust Tensors** - Each agent accumulates trust independently (T3/V3)
- **Reference Store** - Learned patterns persist across sessions
- **Capability Modulation** - Higher trust = more permissions
- **SQLite Ledger** - Unified storage with WAL mode for concurrent access
- **Heartbeat Ledger** - Timing coherence tracking

## Tier 1.5 Features (NEW)

Four new features harmonized with the [moltbot implementation](https://github.com/dp-web4/moltbot):

### Policy Presets

Built-in rule sets for common governance postures:

```python
from governance import resolve_preset, list_presets

# List available presets
for p in list_presets():
    print(f"{p.name}: {p.description}")

# Use a preset with overrides
config = resolve_preset("safety", enforce=False)
```

| Preset | Default | Enforce | Description |
|--------|---------|---------|-------------|
| `permissive` | allow | false | Pure observation, no rules |
| `safety` | allow | true | Deny destructive bash, deny secrets, warn on network |
| `strict` | deny | true | Only allow Read, Glob, Grep, TodoWrite |
| `audit-only` | allow | false | Same as safety but dry-run mode |

### Rate Limiting

Sliding window counters for policy enforcement:

```python
from governance import RateLimiter

limiter = RateLimiter()

# Check if under limit (5 actions per 60 seconds)
result = limiter.check("ratelimit:bash:tool", max_count=5, window_ms=60000)
if result.allowed:
    # Proceed and record
    limiter.record("ratelimit:bash:tool")
```

### Audit Query

Filter audit records by tool, category, status, target, and time:

```python
# Query with filters
results = ledger.query_audit(
    session_id="sess1",
    tool="Bash",
    status="error",
    since="1h",  # or ISO date: "2026-01-27T10:00:00Z"
    limit=50
)

# Get aggregated stats
stats = ledger.get_audit_stats(session_id="sess1")
# Returns: {total, tool_counts, status_counts, category_counts}
```

### Audit Reporter

Generate aggregated reports from audit data:

```python
from governance import AuditReporter

records = ledger.query_audit(session_id="sess1")
reporter = AuditReporter(records)

# Text output
print(reporter.format_text())

# JSON-serializable dict
data = reporter.to_dict()
```

Report sections:
- **Tool Stats** — Invocations, success rate, avg duration per tool
- **Category Breakdown** — Counts and percentages per category
- **Policy Stats** — Allow/deny distribution, block rate
- **Errors** — Count by tool, top error messages
- **Timeline** — Actions per minute

### Policy Entity (NEW)

Policy is a first-class participant in the trust network — not just configuration, but "society's law" with identity, witnessing, and hash-tracking:

```python
from governance import PolicyEntity, PolicyRegistry

# Register a policy (creates hash-identified entity)
registry = PolicyRegistry()
entity = registry.register_policy("my-policy", preset="safety")

# Entity ID follows: policy:<name>:<version>:<hash>
print(entity.entity_id)  # policy:my-policy:20260128...:a1b2c3d4...

# Evaluate a tool call against policy
result = entity.evaluate("Bash", "command", "rm -rf /")
print(result.decision)  # "deny"
print(result.reason)    # "Destructive command blocked by safety preset"

# Session witnesses operating under policy
registry.witness_session(entity.entity_id, session_id)

# Policy witnesses decisions
registry.witness_decision(entity.entity_id, session_id, "Read", "allow", success=True)
```

**Why Policy as Entity?**

- **Immutable**: Once registered, the policy can't change (new version = new entity)
- **Hash-tracked**: Content hash in entity ID ensures integrity
- **Witnessable**: Sessions witness policy, policy witnesses decisions
- **Auditable**: R6 records reference `policy_entity_id` in rules field
- **Trust-integrated**: T3/V3 tensors track policy usage patterns

**Hook Integration**:

The PreToolUse hook automatically:
1. Loads policy entity from session state
2. Evaluates tool calls against policy rules
3. Blocks denied actions (if `enforce=true`)
4. Witnesses decisions in the trust network

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
├── ledger.db                 # SQLite database (unified storage)
├── preferences.json          # Your settings
├── sessions/                 # Session state files
├── audit/                    # Audit records (JSONL)
├── r6/                       # R6 workflow logs
├── heartbeat/                # Timing coherence ledgers
└── governance/
    ├── roles/                # Per-agent trust tensors
    ├── references/           # Persistent learned context
    └── sessions/             # Governed session state
```

The SQLite ledger uses WAL mode for concurrent access, allowing multiple
parallel sessions to write simultaneously without conflicts.

## Agent Governance

### How It Works

```
Agent Spawn (Task tool)     Agent Complete
        │                          │
        ▼                          ▼
┌───────────────┐          ┌───────────────┐
│ on_agent_spawn│          │on_agent_complete
│ - Load trust  │          │ - Update trust │
│ - Load refs   │          │ - Record outcome
│ - Check caps  │          └───────────────┘
└───────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│           Agent Runs                   │
│  (with prior context injected)        │
└───────────────────────────────────────┘
```

### Trust Accumulation

Each agent role (e.g., `code-reviewer`, `test-generator`) accumulates trust independently:

**T3 Trust Tensor (6 dimensions):**
| Dimension | What It Measures |
|-----------|------------------|
| competence | Can they do it? |
| reliability | Will they do it consistently? |
| consistency | Same quality over time? |
| witnesses | Corroborated by others? |
| lineage | Track record length |
| alignment | Values match context? |

**Trust Updates:**
- Success: +5% (diminishing returns near 1.0)
- Failure: -10% (asymmetric - trust is hard to earn, easy to lose)

### Persistent References

Agents accumulate learned patterns:

```python
# After code review
gov.extract_reference(
    role_id="code-reviewer",
    content="Pattern: Always check null before array access",
    source="review of auth.py",
    ref_type="pattern"
)
```

On next invocation, the agent receives prior context automatically.

### Capability Derivation

Trust level determines capabilities:

| Trust Level | can_write | can_execute | can_delegate | max_atp |
|-------------|-----------|-------------|--------------|---------|
| < 0.3       | ❌        | ❌          | ❌           | 37      |
| 0.3-0.4     | ✅        | ❌          | ❌           | 46      |
| 0.4-0.6     | ✅        | ✅          | ❌           | 64      |
| 0.6+        | ✅        | ✅          | ✅           | 82+     |

## R6 Workflow

Every tool call gets an R6 record:

```
R6 = Rules + Role + Request + Reference + Resource → Result
```

| Component | What It Captures |
|-----------|------------------|
| **Rules** | Preferences and constraints |
| **Role** | Session identity, action index, active agent |
| **Request** | Tool name, category, target |
| **Reference** | Chain position, previous R6 |
| **Resource** | ATP cost |
| **Result** | Status, output hash, trust update |

## Heartbeat Coherence

The plugin tracks timing between tool calls:

- **on_time**: Within expected interval (good)
- **early**: Faster than expected (slight penalty)
- **late**: Slower but acceptable
- **gap**: Long pause detected

Coherence score (0.0-1.0) indicates session health and can modulate trust application.

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
- `verbose` - Show each R6 request with coherence indicator

## Testing

```bash
# Test heartbeat system
python3 test_heartbeat.py

# Test agent governance flow
python3 test_agent_flow.py

# Test entity trust and witnessing
python3 test_entity_trust.py

# Test Tier 1.5 features (presets, rate limiting, audit query, reporter)
python3 -m pytest test_tier1_5.py -v
```

Run all tests:
```bash
python3 -m pytest test_*.py -v
# 50 tests passing
```

## Governance Module

The plugin includes a Python governance module (`governance/`):

```python
from governance import Ledger, SoftLCT, SessionManager, AgentGovernance

# Start a session with automatic numbering
sm = SessionManager()
session = sm.start_session(project='my-project', atp_budget=100)
print(f"Session #{session['session_number']}")

# Record actions
sm.record_action('Edit', target='src/main.py', status='success')

# Agent governance
gov = AgentGovernance()
ctx = gov.on_agent_spawn(session_id, "code-reviewer")
result = gov.on_agent_complete(session_id, "code-reviewer", success=True)

# Get session summary
print(sm.get_session_summary())
```

**ATP Accounting**: Each session has an action budget (default 100). Actions consume ATP, enabling cost tracking.

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
├── sessions/            # Session state (JSON)
├── audit/               # Audit records (JSONL)
├── r6/                  # R6 request logs
├── heartbeat/           # Timing coherence ledgers
└── governance/
    ├── roles/           # Trust tensors per agent
    └── references/      # Learned context per agent
```

The SQLite ledger provides:
- **Unified storage** - All data in one file
- **Concurrent access** - WAL mode for parallel sessions
- **Atomic operations** - No duplicate session numbers
- **Cross-table queries** - Join heartbeat + audit data

## Web4 Ecosystem

This plugin implements Web4 governance concepts:

| Concept | This Plugin | Full Web4 |
|---------|-------------|-----------|
| Identity | Soft LCT (software) | LCT (hardware-bound) |
| Workflow | R6 framework | R6 + Policy enforcement |
| Audit | SQLite + hash-linked chain | Distributed ledger |
| Timing | Heartbeat coherence | Grounding lifecycle |
| Trust | T3/V3 tensors per role | Full tensor calculus |
| Agent | Role trust + references | MRH + Witnessing |

For enterprise features (hardware binding, TPM attestation, cross-machine verification), contact dp@metalinxx.io.

## Contributing

Contributions welcome! This plugin is MIT licensed.

Areas for contribution:
- Additional audit visualizations
- R6 analytics and insights
- Trust visualization
- Reference search improvements
- Cross-session analytics

## License

MIT License - see [LICENSE](LICENSE)

## Links

- [Web4 Specification](https://github.com/dp-web4/web4)
- [R6 Framework Spec](https://github.com/dp-web4/web4/blob/main/web4-standard/core-spec/r6-framework.md)
- [Trust Tensors Spec](https://github.com/dp-web4/web4/blob/main/web4-standard/core-spec/t3-v3-tensors.md)
- Enterprise inquiries: dp@metalinxx.io
