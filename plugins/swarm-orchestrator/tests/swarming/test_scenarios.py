"""pytest wrapper — every scenario JSON is a parametrized test.

Designed to drop into the plugin's existing test job; failures bisect
cleanly to the offending commit.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

THIS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(THIS_DIR))

from runner.harness import run_scenario  # noqa: E402
from runner.stub import InProcessScenarioEngine  # noqa: E402


SCENARIOS = sorted((THIS_DIR / "scenarios").glob("*.json"))


@pytest.mark.parametrize("scenario_path", SCENARIOS, ids=[p.stem for p in SCENARIOS])
def test_scenario_passes(scenario_path: Path) -> None:
    rep = run_scenario(scenario_path, engine=InProcessScenarioEngine())
    assert rep.ok, "FAILED: " + " | ".join(rep.failed)
