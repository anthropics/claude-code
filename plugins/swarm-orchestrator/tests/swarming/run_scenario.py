#!/usr/bin/env python3
"""Scenario runner — exercises a scenario against the configured engine.

By default this uses the binding-agnostic in-process reference engine
shipped in :mod:`tests.swarming.runner.stub`. To run against a different
engine (e.g. an Anthropic Teams binding or the standalone ``claude_swarm``
library), replace ``ENGINE_FACTORY`` below.

Usage::

    python tests/swarming/run_scenario.py multi-file-rename
    python tests/swarming/run_scenario.py --all
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

THIS_DIR = Path(__file__).resolve().parent
# Allow running as a script: put this dir's parent on sys.path so
# ``runner`` resolves either as ``tests.swarming.runner`` (package
# import) OR as a sibling import path. We prefer importing via the
# local path to keep the scenario runner self-contained.
sys.path.insert(0, str(THIS_DIR))
sys.path.insert(0, str(THIS_DIR.parent.parent))  # repo root

from runner.harness import run_all, run_scenario  # noqa: E402
from runner.stub import InProcessScenarioEngine  # noqa: E402


def _make_engine():
    """Return the engine for this binding.

    When the internal swarm exposes its own engine adapter, swap here.
    Until then, use the canonical reference implementation — keeps the
    substrate runnable + the scenarios green during development.
    """
    try:
        # Optional adapter — present once claude_swarm exposes it.
        from claude_swarm import scenario_engine as _eng  # type: ignore[import-not-found]
        return _eng.StandaloneScenarioEngine()
    except Exception:  # noqa: BLE001 — adapter absence is expected today
        return InProcessScenarioEngine()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("scenario", nargs="?", help="scenario name (matches scenarios/<name>.json)")
    p.add_argument("--all", action="store_true", help="run every scenario in scenarios/")
    p.add_argument("--scenarios-dir", default=str(THIS_DIR / "scenarios"))
    p.add_argument("--keep-workspace", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    engine = _make_engine()
    if args.all:
        reports = run_all(args.scenarios_dir, engine=engine, verbose=args.verbose)
    else:
        if not args.scenario:
            p.error("scenario name required (or --all)")
        candidate = Path(args.scenarios_dir) / f"{args.scenario}.json"
        if not candidate.exists():
            print(f"scenario not found: {candidate}", file=sys.stderr)
            return 2
        reports = [
            run_scenario(
                candidate,
                engine=engine,
                keep_workspace=args.keep_workspace,
                verbose=args.verbose,
            )
        ]

    if args.json:
        print(json.dumps([r.to_dict() for r in reports], indent=2))
    else:
        for r in reports:
            head = "PASS" if r.ok else "FAIL"
            print(f"[{head}] {r.scenario} (binding={r.binding}) passed={len(r.passed)} failed={len(r.failed)}")
            for x in r.failed:
                print(f"    - {x}")
    return 0 if all(r.ok for r in reports) else 1


if __name__ == "__main__":
    raise SystemExit(main())
