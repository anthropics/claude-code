"""Harness — drives fixtures + engine + assertions for one scenario.

The harness is the same code regardless of binding. Per-binding runners
just supply a different :class:`ScenarioEngine` instance.

Usage (programmatic)::

    from tests.swarming.runner.harness import run_scenario
    from tests.swarming.runner.stub import InProcessScenarioEngine

    report = run_scenario(
        "tests/swarming/scenarios/multi-file-rename.json",
        engine=InProcessScenarioEngine(),
    )
    assert report.ok, report.failed
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Sequence

from .assertions import AssertionReport, evaluate
from .stub import InProcessScenarioEngine, RunResult, Scenario, ScenarioEngine


REPO_GIT_USER = "swarm-test-substrate"
REPO_GIT_EMAIL = "swarm-test-substrate@example.invalid"


def materialize_fixtures(scenario: Scenario, workspace: Path) -> None:
    """Copy ``setup.fixtures`` into ``workspace``; init git if asked."""
    fixtures_rel = scenario.setup.get("fixtures")
    if not fixtures_rel:
        workspace.mkdir(parents=True, exist_ok=True)
        return
    src = (scenario.source_path.parent / fixtures_rel).resolve()
    if not src.exists():
        raise FileNotFoundError(
            f"scenario {scenario.name!r} references fixtures dir "
            f"{src} which does not exist"
        )
    if workspace.exists():
        shutil.rmtree(workspace)
    shutil.copytree(src, workspace)
    if scenario.setup.get("git_init", True):
        _git_init(workspace)


def _git_init(workspace: Path) -> None:
    env = os.environ.copy()
    env.update(
        {
            "GIT_AUTHOR_NAME": REPO_GIT_USER,
            "GIT_COMMITTER_NAME": REPO_GIT_USER,
            "GIT_AUTHOR_EMAIL": REPO_GIT_EMAIL,
            "GIT_COMMITTER_EMAIL": REPO_GIT_EMAIL,
        }
    )
    subprocess.run(
        ["git", "init", "-q", "-b", "master"],
        cwd=str(workspace),
        check=True,
        env=env,
    )
    subprocess.run(
        ["git", "config", "user.name", REPO_GIT_USER],
        cwd=str(workspace),
        check=True,
        env=env,
    )
    subprocess.run(
        ["git", "config", "user.email", REPO_GIT_EMAIL],
        cwd=str(workspace),
        check=True,
        env=env,
    )
    subprocess.run(
        ["git", "config", "commit.gpgsign", "false"],
        cwd=str(workspace),
        check=True,
        env=env,
    )
    subprocess.run(
        ["git", "add", "-A"],
        cwd=str(workspace),
        check=True,
        env=env,
    )
    # Allow empty initial commit if fixtures dir is empty (rare).
    subprocess.run(
        ["git", "commit", "--allow-empty", "-q", "-m", "fixture: initial"],
        cwd=str(workspace),
        check=True,
        env=env,
    )


def run_scenario(
    scenario_path: str | os.PathLike[str],
    *,
    engine: ScenarioEngine | None = None,
    workspace: Path | None = None,
    keep_workspace: bool = False,
    verbose: bool = False,
) -> AssertionReport:
    scenario = Scenario.load(scenario_path)
    if engine is None:
        engine = InProcessScenarioEngine()
    cleanup = False
    if workspace is None:
        workspace = Path(tempfile.mkdtemp(prefix=f"swarm-{scenario.name}-"))
        cleanup = not keep_workspace

    if verbose:
        print(f"[harness] scenario={scenario.name} binding={engine.binding_name}", file=sys.stderr)
        print(f"[harness] workspace={workspace}", file=sys.stderr)

    try:
        materialize_fixtures(scenario, workspace)
        deadline = scenario.max_duration_minutes * 60.0
        t0 = time.monotonic()
        result = engine.run(scenario, workspace)
        elapsed = time.monotonic() - t0
        if elapsed > deadline:
            result.notes.append(
                f"[harness] elapsed {elapsed:.2f}s exceeded max {deadline:.2f}s"
            )
        report = evaluate(scenario, result, workspace)
        if verbose:
            print(f"[harness] passed={len(report.passed)} failed={len(report.failed)}", file=sys.stderr)
            for f in report.failed:
                print(f"  FAIL {f}", file=sys.stderr)
        return report
    finally:
        if cleanup and workspace.exists():
            shutil.rmtree(workspace, ignore_errors=True)


def run_all(
    scenarios_dir: str | os.PathLike[str],
    *,
    engine: ScenarioEngine | None = None,
    only: Sequence[str] | None = None,
    verbose: bool = False,
) -> list[AssertionReport]:
    base = Path(scenarios_dir)
    paths = sorted(base.glob("*.json"))
    reports: list[AssertionReport] = []
    for p in paths:
        if only and p.stem not in only:
            continue
        rep = run_scenario(p, engine=engine, verbose=verbose)
        reports.append(rep)
    return reports


def _cli(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a swarm scenario via the in-process reference engine.")
    parser.add_argument("scenario", help="Path to scenario JSON OR scenario name (looked up under --scenarios-dir)")
    parser.add_argument(
        "--scenarios-dir",
        default=str(Path(__file__).resolve().parent.parent / "scenarios"),
    )
    parser.add_argument("--keep-workspace", action="store_true")
    parser.add_argument("--json", action="store_true", help="Emit JSON report on stdout")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    p = Path(args.scenario)
    if not p.exists():
        candidate = Path(args.scenarios_dir) / f"{args.scenario}.json"
        if candidate.exists():
            p = candidate
        else:
            print(f"scenario not found: {args.scenario}", file=sys.stderr)
            return 2

    rep = run_scenario(p, keep_workspace=args.keep_workspace, verbose=args.verbose)
    if args.json:
        print(json.dumps(rep.to_dict(), indent=2))
    else:
        print(f"scenario={rep.scenario} binding={rep.binding}")
        print(f"  passed: {len(rep.passed)}")
        for x in rep.passed:
            print(f"    + {x}")
        print(f"  failed: {len(rep.failed)}")
        for x in rep.failed:
            print(f"    - {x}")
    return 0 if rep.ok else 1


if __name__ == "__main__":
    raise SystemExit(_cli())
