# Zero-Trust Security Library

Enterprise-grade security framework with Byzantine fault tolerance for AI systems.

## Overview

This library provides zero-trust security patterns extracted from proven implementations in Claude Code and CrewAI. It combines client-side secret detection, Byzantine fault tolerance with cryptographic commitments, and tamper-proof audit trails.

## Key Features

- **🔒 Client-Side Secret Detection** - Detect 12+ types of secrets before transmission
- **🏛️ Byzantine Fault Tolerance** - Cryptographic consensus with quorum validation
- **🔗 Tamper-Proof Audit Trails** - Hash-linked audit chain with integrity verification
- **⚙️ Configurable Security Models** - Fail-safe vs fail-secure enforcement
- **🔌 Ready-to-Use Integrations** - Drop-in components for Claude Code and CrewAI
- **🧪 Production-Tested** - Extracted from systems handling real security threats

## Quick Start

```python
from zero_trust_security import SecretDetector, ByzantineValidator

# Basic secret detection (fail-safe mode)
detector = SecretDetector()
result = detector.analyze_data({"command": "export API_KEY=..."})
print(f"Secrets found: {len(result.secrets_found)}")

# Byzantine fault tolerance (zero-trust mode)
validator = ByzantineValidator()
commitment, validation = validator.validate_and_commit(data)
if validation == ValidationResult.VALIDATED:
    # Proceed with cryptographic proof of safety
    pass
```

## Installation

```bash
# Install from source
pip install -e .

# Or copy the zero_trust_security/ directory to your project
```

## Components

### Core Components

- **`SecretDetector`** - Universal secret pattern detection engine
- **`ByzantineValidator`** - Cryptographic commitments with consensus validation
- **`AuditChain`** - Hash-linked tamper-proof audit trail

### Integrations

- **`ClaudeCodeHook`** - Drop-in security hook for Claude Code
- **`CrewAIAccountabilityAgent`** - Byzantine fault tolerance agent for CrewAI

## Claude Code Integration

```python
from zero_trust_security import ClaudeCodeHook
from zero_trust_security.core.secret_detector import SecurityLevel

# Create zero-trust security hook
hook = ClaudeCodeHook(security_level=SecurityLevel.FAIL_SECURE)

# Analyze tool calls
should_block, analysis = hook.analyze_tool_call(tool_call_data)

if should_block:
    print("🔒 SECURITY ALERT: Secrets detected!")
    print(f"Commitment: {analysis['commitment'].commitment_id}")
    print(f"Audit entry: {analysis['audit_entry_id']}")
```

### Generate Claude Code Hook Script

```python
from zero_trust_security.integrations.claude_code import create_hook_script

# Generate standalone hook script
hook_file = create_hook_script(
    security_level=SecurityLevel.FAIL_SECURE,
    output_file="claude_security_hook.py"
)

# Add to Claude Code settings.json
{
  "preToolUseHooks": [
    {"path": "./claude_security_hook.py"}
  ]
}
```

## CrewAI Integration

```python
from zero_trust_security import CrewAIAccountabilityAgent

# Create accountability agent
agent = CrewAIAccountabilityAgent(agent_role="Security Validator")

# Validate agent actions
is_valid, result = agent.validate_agent_action(action_data)

# Generate accountability report
actions = [action1, action2, action3]
report = agent.create_accountability_report(actions)
print(f"Success rate: {report['success_rate']:.2%}")
```

## Security Models

### Fail-Safe Mode (User-Friendly)
- Warns about secrets but allows execution
- Graceful degradation on errors
- Suitable for development environments

```python
detector = SecretDetector(security_level=SecurityLevel.FAIL_SAFE)
```

### Fail-Secure Mode (Zero-Trust)
- Blocks any execution containing secrets
- Fails secure on any error or anomaly
- Cryptographic validation required
- Suitable for production environments

```python
hook = ClaudeCodeHook(security_level=SecurityLevel.FAIL_SECURE)
```

## Secret Detection Patterns

The library detects 12+ types of secrets out of the box:

- OpenAI API Keys (`sk-...`)
- Anthropic API Keys (`sk-ant-...`) 
- GitHub Tokens (`ghp_...`, `github_pat_...`)
- AWS Access Keys (`AKIA...`)
- AWS Secret Keys (base64-encoded)
- Slack Bot Tokens (`xoxb-...`)
- Database URLs (PostgreSQL, MySQL, MongoDB, Redis)
- JWT Tokens (`eyJ...`)
- Generic high-entropy secrets
- Sensitive environment variable references

### Custom Patterns

```python
from zero_trust_security.core.secret_detector import SecretPattern

custom_pattern = SecretPattern(
    name="CUSTOM_API_KEY",
    pattern=r"myapi_[A-Za-z0-9]{32}",
    description="Custom API key format"
)

detector.add_custom_pattern("CUSTOM_API_KEY", custom_pattern)
```

## Byzantine Fault Tolerance

The library implements true Byzantine fault tolerance with:

- **Cryptographic Commitments** - SHA256-based tamper detection
- **Consensus Validation** - Configurable quorum requirements  
- **Validator Chains** - Multiple validators for agreement
- **Commitment Words** - Human-readable validation tokens

```python
validator = ByzantineValidator(byzantine_quorum=3)

# Create cryptographic commitment
commitment = validator.create_commitment(data)
print(f"Commitment: {commitment.commitment_id}")
print(f"Validators: {len(commitment.validator_chain)}")

# Validate with consensus
result = validator.validate_commitment(commitment, data)
assert result == ValidationResult.VALIDATED
```

## Audit Chain

Tamper-proof audit logging with hash-linked entries:

```python
from zero_trust_security.core.audit_chain import AuditChain

chain = AuditChain()

# Add entries with automatic hash linking
entry = chain.add_entry(
    commitment=commitment,
    validation_proof=proof_data
)

# Verify chain integrity
is_valid, errors = chain.verify_chain_integrity()
assert is_valid, f"Chain compromised: {errors}"
```

## Testing

```bash
# Run comprehensive test suite
python zero_trust_security/tests/test_library.py

# Test results: 15/15 passed
# 🏆 ALL LIBRARY TESTS PASSED! Zero-trust implementation validated.
```

## Examples

See the `examples/` directory for complete usage demonstrations:

- `claude_code_example.py` - Claude Code integration patterns
- `crewai_example.py` - CrewAI accountability and recursive validation

```bash
# Run examples
python zero_trust_security/examples/claude_code_example.py
python zero_trust_security/examples/crewai_example.py
```

## Architecture

### Core Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  SecretDetector │    │ ByzantineValidator│    │   AuditChain    │
│                 │    │                  │    │                 │
│ • Pattern match │    │ • Commitments    │    │ • Hash linking  │
│ • Risk scoring  │    │ • Consensus      │    │ • Integrity     │
│ • Audit logging │    │ • Crypto proof   │    │ • Verification  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │     Integration Layer       │
                    │                            │
                    │  ClaudeCodeHook           │
                    │  CrewAIAccountabilityAgent │
                    └────────────────────────────┘
```

### Security Flow
1. **Input Analysis** - Secret detection with pattern matching
2. **Cryptographic Commitment** - Byzantine consensus validation
3. **Audit Recording** - Tamper-proof trail with hash chaining
4. **Decision Enforcement** - Fail-safe vs fail-secure modes

## License

This library extracts and generalizes security patterns from open source implementations. Use responsibly in accordance with your organization's security policies.

## Contributing

This library is extracted from production implementations. Contributions should focus on:

1. Additional secret detection patterns
2. New system integrations
3. Enhanced Byzantine consensus algorithms
4. Improved audit trail features

Ensure all contributions maintain the zero-trust security model and include comprehensive tests.