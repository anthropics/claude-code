# Mythos Runtime Integration

This repository now includes a Python-native Mythos runtime layer for local discipline around AI-assisted changes.

## Included capabilities

- **Strict Write Discipline (SWD)**: verifies claimed file writes against actual filesystem state.
- **Memory ledger**: appends verified write events and runtime events to `MEMORY.md`.
- **Drift detection**: compares current files against the last verified hashes stored in memory.
- **Budget meter**: lightweight token/turn guard for future agent loops.
- **CLI**: `python -m ethos_aegis.mythos_runtime.cli verify` and `dream`.

## How it is wired into Veriflow

`VeriflowImmuneSystem` now uses the Mythos runtime for host-state persistence.
When the system saves its CKAN host cache, it writes through SWD and records the verified write in `MEMORY.md`.
Resource refreshes are also logged as runtime events.

## Example

```python
from ethos_aegis.veriflow import CKANClient, VeriflowImmuneSystem

ckan = CKANClient("https://demo.ckan.org")
immune = VeriflowImmuneSystem(ckan, probe_on_startup=False)
```

## CLI examples

```bash
python -m ethos_aegis.mythos_runtime.cli --root . verify --json
python -m ethos_aegis.mythos_runtime.cli --root . dream --dry-run
```
