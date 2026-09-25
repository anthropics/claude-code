# /audit

View the Web4 audit trail for the current session.

## Usage

```
/audit [options]
```

## Options

- `/audit` - Show summary of current session
- `/audit last N` - Show last N actions (default: 10)
- `/audit verify` - Verify provenance chain integrity
- `/audit export` - Export audit log as JSON

## Behavior

### Summary (`/audit`)

Display session governance status:

```
[Web4 Audit Summary]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session:  a1b2c3d4 (software-bound)
Started:  2025-01-23T10:30:00Z
Actions:  47 recorded
Chain:    47 links, verified ✓

By Category:
  file_read:   23 (49%)
  file_write:  12 (26%)
  command:      8 (17%)
  network:      4 (8%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Recent Actions (`/audit last N`)

Show the last N actions with R6 details:

```
[Recent Actions]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#47 [10:45:23] file_write → src/main.rs
    R6: r6:f8e9a1b2  Status: success

#46 [10:45:01] command → cargo
    R6: r6:c7d8e9f0  Status: success

#45 [10:44:45] file_read → Cargo.toml
    R6: r6:a1b2c3d4  Status: success
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Verify Chain (`/audit verify`)

Verify the provenance chain integrity:

```
[Chain Verification]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Checking 47 records...

✓ All record hashes valid
✓ Chain links unbroken
✓ Timestamps monotonic

Chain Integrity: VERIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Files

Audit data is stored in `~/.web4/`:
- `sessions/{session_id}.json` - Session state
- `audit/{session_id}.jsonl` - Audit records
- `r6/{date}.jsonl` - R6 request log

## R6 Framework

Every action is recorded using the R6 workflow:

1. **Rules** - Constraints and preferences
2. **Role** - Session identity and context
3. **Request** - Tool, category, target
4. **Reference** - History and chain position
5. **Resource** - Cost/budget (optional)
6. **Result** - Outcome and output hash

This creates a verifiable record of intent → action → result.

## Learn More

- [Web4 Specification](https://github.com/dp-web4/web4)
- [R6 Framework](https://github.com/dp-web4/web4/blob/main/web4-standard/core-spec/r6-framework.md)
