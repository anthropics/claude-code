# Mythos Runtime Repair Plan

This patch set is intended to repair the Mythos runtime surface without touching unrelated plugin lint debt.

## Scope
- `ethos_aegis/mythos_runtime/`
- `ethos_aegis/veriflow/`
- `tests/test_mythos_runtime.py`
- `.github/workflows/python-package.yml`

## Required fixes
1. Remove `slots=True` from new dataclasses for Python 3.9 compatibility.
2. Remove unused `Mapping` imports.
3. Wrap long lines in the new package surface.
4. Reduce `DriftDetector.scan` complexity by extracting helper methods.
5. Update `actions/setup-python` from `@v3` to `@v5`.
6. Scope flake8 to the Mythos runtime surface only.
7. Run `pytest tests/test_mythos_runtime.py -q` instead of full-repo `pytest` in this workflow.

## Files to modify
- `ethos_aegis/mythos_runtime/budget.py`
- `ethos_aegis/mythos_runtime/cli.py`
- `ethos_aegis/mythos_runtime/drift.py`
- `ethos_aegis/mythos_runtime/memory.py`
- `ethos_aegis/mythos_runtime/swd.py`
- `ethos_aegis/veriflow/ckan_adapter.py`
- `ethos_aegis/veriflow/immune_system.py`
- `tests/test_mythos_runtime.py`
- `.github/workflows/python-package.yml`

## PR intent
Fix Python 3.9 compatibility and isolate CI to the new Mythos runtime package surface so unrelated plugin lint debt does not block validation.
