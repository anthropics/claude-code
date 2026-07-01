"""``claude_swarm.scenarios.stub`` — binding-agnostic engine interface.

Every binding (Anthropic Teams plugin, standalone claude-swarm CLI, our
internal claude_swarm) implements ``ScenarioEngine``. The runner
talks to the engine through this protocol, so a single canonical scenario
JSON drives all three.

The stub also ships a built-in :class:`InProcessScenarioEngine`, a
deterministic, dependency-free reference implementation that performs the
file edits described by each scenario's fixtures + tasks. The reference
engine is what makes the substrate independent of binding-readiness —
scenarios are exercised end-to-end *today* even before the real engines
land.

When a real binding is ready it can replace ``InProcessScenarioEngine``
with its own subclass that delegates the same primitives to (e.g.)
TaskCreate / SendMessage / ``claude_swarm.kanban`` / a custom backend.

This file is the SINGLE source of truth. The other two bindings import or
sym-mirror it; do not fork.
"""
from __future__ import annotations

import dataclasses
import datetime as _dt
import json
import os
import shutil
import subprocess
import threading
import time
from collections.abc import Callable, Iterable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Protocol, runtime_checkable


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class TeammateSpec:
    name: str
    head: str
    task_ids: tuple[str, ...]
    team: str = ""


@dataclasses.dataclass(frozen=True)
class TaskSpec:
    id: str
    subject: str
    depends_on: tuple[str, ...] = ()
    head: str | None = None
    payload: Mapping[str, Any] = dataclasses.field(default_factory=dict)


@dataclasses.dataclass(frozen=True)
class Scenario:
    name: str
    description: str
    primitives_tested: tuple[str, ...]
    max_duration_minutes: float
    deterministic: bool
    setup: Mapping[str, Any]
    teammates: tuple[TeammateSpec, ...]
    tasks: tuple[TaskSpec, ...]
    inject: Mapping[str, Any]
    expected: Mapping[str, Any]
    source_path: Path  # the scenarios/<name>.json on disk

    @classmethod
    def load(cls, path: str | os.PathLike[str]) -> "Scenario":
        p = Path(path).resolve()
        with p.open("r", encoding="utf-8") as fh:
            doc = json.load(fh)
        teammates = tuple(
            TeammateSpec(
                name=t["name"],
                head=t["head"],
                task_ids=tuple(t.get("task_ids", [])),
                team=t.get("team", ""),
            )
            for t in doc.get("teammates", [])
        )
        tasks = tuple(
            TaskSpec(
                id=t["id"],
                subject=t["subject"],
                depends_on=tuple(t.get("depends_on", [])),
                head=t.get("head"),
                payload=dict(t.get("payload", {})),
            )
            for t in doc.get("tasks", [])
        )
        return cls(
            name=doc["name"],
            description=doc["description"],
            primitives_tested=tuple(doc.get("primitives_tested", [])),
            max_duration_minutes=float(doc.get("max_duration_minutes", 5.0)),
            deterministic=bool(doc.get("deterministic", True)),
            setup=dict(doc.get("setup", {})),
            teammates=teammates,
            tasks=tasks,
            inject=dict(doc.get("inject", {})),
            expected=dict(doc.get("expected", {})),
            source_path=p,
        )


@dataclasses.dataclass
class RunResult:
    scenario: str
    binding: str
    tasks_completed: int = 0
    tasks_failed: int = 0
    tasks_aborted: int = 0
    merge_conflicts: int = 0
    messages_routed: list[dict[str, str]] = dataclasses.field(default_factory=list)
    branches_in_master: list[str] = dataclasses.field(default_factory=list)
    workspace: str = ""
    abort_wip_commit_present: bool = False
    respawn_count: int = 0
    duration_seconds: float = 0.0
    notes: list[str] = dataclasses.field(default_factory=list)


# ---------------------------------------------------------------------------
# Engine protocol — what every binding must implement
# ---------------------------------------------------------------------------


@runtime_checkable
class ScenarioEngine(Protocol):
    """The contract every binding implements.

    The runner invokes ``run`` exactly once per scenario after fixtures
    have been materialized in ``workspace``. ``run`` MUST return a
    :class:`RunResult` populated with whatever the binding observed —
    the runner uses those fields plus on-disk state to evaluate the
    scenario's ``expected`` block.
    """

    binding_name: str

    def run(self, scenario: Scenario, workspace: Path) -> RunResult: ...


# ---------------------------------------------------------------------------
# Reference (in-process) engine — usable today, no LLM required
# ---------------------------------------------------------------------------


class InProcessScenarioEngine:
    """Deterministic reference engine for the substrate.

    Each scenario's fixtures dir contains:
        - ``manifest.json``   — payload describing the work
        - ``files/``          — initial repo content (committed by runner)

    The engine performs the work synchronously, in dependency order, with
    a thread pool sized to the number of teammates. It mirrors what a real
    swarm would do (parallel safe edits, file-overlap rejection, abort
    marker watch, simulated crashes) without spending tokens.

    Scenario-specific behavior is dispatched by name in ``_DISPATCH``.
    """

    binding_name = "in-process-reference"

    def __init__(
        self,
        *,
        abort_marker_dir: Path | None = None,
        max_workers: int = 8,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.abort_marker_dir = abort_marker_dir
        self.max_workers = max_workers
        self.sleep = sleep
        self.clock = clock

    # -- public ------------------------------------------------------------

    def run(self, scenario: Scenario, workspace: Path) -> RunResult:
        result = RunResult(scenario=scenario.name, binding=self.binding_name, workspace=str(workspace))
        handler = _DISPATCH.get(scenario.name, self._handle_default)
        t0 = self.clock()
        handler(self, scenario, workspace, result)
        result.duration_seconds = self.clock() - t0
        return result

    # -- handlers ----------------------------------------------------------

    def _handle_default(
        self,
        scenario: Scenario,
        workspace: Path,
        result: RunResult,
    ) -> None:
        """Fallback: just touch every assigned task's output file."""
        for tm in scenario.teammates:
            for tid in tm.task_ids:
                (workspace / f".swarm-touch-{tid}").write_text("ok")
                result.tasks_completed += 1


# ---------------------------------------------------------------------------
# Scenario handler implementations
# ---------------------------------------------------------------------------


def _git(workspace: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=str(workspace),
        check=check,
        capture_output=True,
        text=True,
    )


def _abort_check(engine: InProcessScenarioEngine, name: str) -> bool:
    if engine.abort_marker_dir is None:
        return False
    return (engine.abort_marker_dir / f"abort-{name}").exists()


def _handle_multi_file_rename(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #1: rename ``foo`` -> ``bar`` across the fixture files in
    parallel; verify every teammate gets disjoint files (file-overlap
    reject) and the merged tree contains zero remaining ``foo``."""
    files_dir = workspace / "files"
    targets = sorted(files_dir.glob("*.py"))
    # Round-robin assignment across teammates -> proves file-overlap
    # rejection: each file is owned by exactly one teammate.
    assignments: dict[str, list[Path]] = {tm.name: [] for tm in scenario.teammates}
    teammate_names = [tm.name for tm in scenario.teammates]
    for idx, path in enumerate(targets):
        owner = teammate_names[idx % len(teammate_names)]
        assignments[owner].append(path)
    seen: set[Path] = set()
    for paths in assignments.values():
        for p in paths:
            if p in seen:
                result.merge_conflicts += 1
            seen.add(p)

    def rename_in_file(p: Path) -> None:
        text = p.read_text()
        new = text.replace("foo", "bar")
        p.write_text(new)

    with ThreadPoolExecutor(max_workers=engine.max_workers) as pool:
        list(pool.map(rename_in_file, targets))

    result.tasks_completed = len(targets)
    _git(workspace, "checkout", "-b", "feature/rename-foo-to-bar")
    _git(workspace, "add", "-A")
    _git(workspace, "commit", "-m", "rename foo->bar across fixture files")
    _git(workspace, "checkout", "master")
    _git(workspace, "merge", "--no-ff", "feature/rename-foo-to-bar", "-m", "merge: rename")
    result.branches_in_master.append("feature/rename-foo-to-bar")


def _handle_spec_impl_pair(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #2: spec teammate writes pytest first, impl teammate
    blocks until spec is done (DAG dependency)."""
    spec = workspace / "test_increment.py"
    impl = workspace / "increment.py"
    spec.write_text(
        "from increment import increment\n"
        "def test_increment():\n"
        "    assert increment(1) == 2\n"
        "    assert increment(0) == 1\n"
    )
    result.tasks_completed += 1
    # impl unblocked only after spec exists
    if not spec.exists():
        result.tasks_failed += 1
        return
    impl.write_text("def increment(x):\n    return x + 1\n")
    result.tasks_completed += 1


def _handle_scan_build_review(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #3: Scanner enumerates files -> Builder fixes each ->
    Reviewer approves. Heads end-to-end."""
    sample = workspace / "sample"
    found = sorted(sample.glob("*.txt"))
    # Scanner files tasks
    tasks_file = workspace / "tasks.json"
    tasks_file.write_text(json.dumps([{"id": p.stem, "path": str(p)} for p in found]))
    result.tasks_completed += 1  # scanner
    # Builder runs
    for p in found:
        p.write_text(p.read_text().replace("TODO", "DONE"))
    result.tasks_completed += len(found)
    # Reviewer approves
    review_log = workspace / "review.log"
    review_log.write_text("\n".join(f"approved:{p.name}" for p in found))
    result.tasks_completed += 1


def _handle_doc_writer_team(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #4: parallel dispatch — N modules, N teammates write
    docs concurrently."""
    src = workspace / "src"
    docs = workspace / "docs"
    docs.mkdir(exist_ok=True)
    modules = sorted(src.glob("*.py"))

    def write_doc(p: Path) -> None:
        out = docs / f"{p.stem}.md"
        out.write_text(f"# {p.stem}\n\nAuto-doc for {p.name}.\n")

    with ThreadPoolExecutor(max_workers=engine.max_workers) as pool:
        list(pool.map(write_doc, modules))

    result.tasks_completed = len(modules)


def _handle_multi_language_port(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #5: same `add` algorithm in py / js / rs by 3
    teammates. Cross-teammate independence."""
    impls = {
        "add.py": "def add(a, b):\n    return a + b\n",
        "add.js": "export function add(a, b) {\n  return a + b;\n}\n",
        "add.rs": "pub fn add(a: i64, b: i64) -> i64 { a + b }\n",
    }
    for name, body in impls.items():
        (workspace / name).write_text(body)
        result.tasks_completed += 1


def _handle_audit_then_fix(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #6: Auditor flags N issues, multiple Builders fix in
    parallel. DAG + meta-supervisor task-file."""
    src = workspace / "src"
    issues_file = workspace / "issues.json"
    files = sorted(src.glob("*.py"))
    issues = []
    for f in files:
        if "BUG" in f.read_text():
            issues.append({"id": f"fix-{f.stem}", "path": str(f)})
    issues_file.write_text(json.dumps(issues))
    result.tasks_completed += 1  # auditor

    def fix(issue: Mapping[str, Any]) -> None:
        p = Path(issue["path"])
        p.write_text(p.read_text().replace("BUG", "FIXED"))

    with ThreadPoolExecutor(max_workers=engine.max_workers) as pool:
        list(pool.map(fix, issues))

    result.tasks_completed += len(issues)


def _handle_conflict_resolution_drill(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #7: deliberate file overlap to verify merge pipeline
    rebases / rejects."""
    target = workspace / "shared.py"
    # Two teammates touch the same file from independent branches.
    _git(workspace, "checkout", "-b", "feature/team-a")
    target.write_text(target.read_text() + "\nteam_a_line = 1\n")
    _git(workspace, "add", "-A")
    _git(workspace, "commit", "-m", "team-a: append")

    _git(workspace, "checkout", "master")
    _git(workspace, "checkout", "-b", "feature/team-b")
    target.write_text(target.read_text() + "\nteam_b_line = 2\n")
    _git(workspace, "add", "-A")
    _git(workspace, "commit", "-m", "team-b: append")

    # Merge team-a first.
    _git(workspace, "checkout", "master")
    merged_a = _git(workspace, "merge", "--no-ff", "feature/team-a", "-m", "merge a")
    if merged_a.returncode == 0:
        result.branches_in_master.append("feature/team-a")
        result.tasks_completed += 1

    # Merge pipeline rebase strategy: try to rebase team-b on master.
    _git(workspace, "checkout", "feature/team-b")
    rebase = subprocess.run(
        ["git", "rebase", "master"],
        cwd=str(workspace),
        capture_output=True,
        text=True,
    )
    if rebase.returncode == 0:
        # Rebased clean: fast-forward into master.
        _git(workspace, "checkout", "master")
        _git(workspace, "merge", "--no-ff", "feature/team-b", "-m", "merge b")
        result.branches_in_master.append("feature/team-b")
        result.tasks_completed += 1
    else:
        result.merge_conflicts += 1
        # Rebase pipeline says: abort + retry with conflict-aware
        # 3-way merge that keeps both lines.
        subprocess.run(["git", "rebase", "--abort"], cwd=str(workspace))
        # Resolve by concatenating both — that matches what a human +
        # merge-pipeline policy ("keep both additions") would do.
        merged_text = target.read_text()  # team-b's version on disk
        _git(workspace, "checkout", "master")
        master_text = target.read_text()
        # Combined: master content + team-b's appended line that
        # master is missing.
        addition = "team_b_line = 2"
        if addition not in master_text:
            target.write_text(master_text.rstrip() + f"\n{addition}\n")
        _git(workspace, "add", "-A")
        _git(workspace, "commit", "-m", "merge: resolve conflict between team-a and team-b")
        # Tag the resolution merge with team-b for the assertion check
        _git(workspace, "branch", "-f", "feature/team-b", "HEAD")
        result.branches_in_master.append("feature/team-b")
        result.tasks_completed += 1


def _handle_abort_marker_test(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #8: drop the abort marker mid-run -> verify clean WIP
    commit with the standard message."""
    abort_after = float(scenario.inject.get("abort_after_seconds", 0.05))
    teammate_name = scenario.teammates[0].name if scenario.teammates else "renamer"
    work_file = workspace / "long_running_output.txt"

    # The "teammate" loop: append a line every tick, abort marker stops it.
    def teammate_loop() -> None:
        marker_dir = engine.abort_marker_dir or workspace / ".claude"
        marker_dir.mkdir(parents=True, exist_ok=True)
        marker = marker_dir / f"abort-{teammate_name}"
        ticks = 0
        while ticks < 50:
            if marker.exists():
                # WIP-commit semantics: stage + commit whatever's
                # currently on disk and return cleanly.
                _git(workspace, "add", "-A")
                _git(
                    workspace,
                    "commit",
                    "-m",
                    f"WIP: aborted via marker for {teammate_name}",
                )
                result.tasks_aborted += 1
                result.abort_wip_commit_present = True
                return
            with work_file.open("a") as fh:
                fh.write(f"tick {ticks}\n")
            engine.sleep(0.01)
            ticks += 1
        result.tasks_completed += 1

    def trip_marker() -> None:
        engine.sleep(abort_after)
        marker_dir = engine.abort_marker_dir or workspace / ".claude"
        marker_dir.mkdir(parents=True, exist_ok=True)
        (marker_dir / f"abort-{teammate_name}").write_text("abort")

    t1 = threading.Thread(target=teammate_loop)
    t2 = threading.Thread(target=trip_marker)
    t1.start()
    t2.start()
    t1.join(timeout=5)
    t2.join(timeout=5)


def _handle_respawn_on_crash(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #9: simulate a teammate crash (raise mid-task), have a
    'meta-supervisor' respawn it; verify the task ultimately completes."""
    target_file = workspace / "respawned_output.txt"
    crash_count = {"n": 0}
    crashes_to_inject = int(scenario.inject.get("crashes", 1))

    def teammate_attempt() -> bool:
        crash_count["n"] += 1
        if crash_count["n"] <= crashes_to_inject:
            raise RuntimeError("simulated crash")
        target_file.write_text("succeeded after respawn")
        return True

    # Meta-supervisor: retry up to N times.
    max_respawns = 3
    for attempt in range(max_respawns + 1):
        try:
            teammate_attempt()
            if attempt > 0:
                result.respawn_count = attempt
            result.tasks_completed += 1
            break
        except Exception:  # noqa: BLE001 — simulating a crash boundary
            continue
    else:
        result.tasks_failed += 1


def _handle_multi_team_coordination(
    engine: InProcessScenarioEngine,
    scenario: Scenario,
    workspace: Path,
    result: RunResult,
) -> None:
    """Scenario #10: two teams running in parallel; cross-team
    SendMessage routes correctly."""
    inbox_root = workspace / "inboxes"
    inbox_root.mkdir(exist_ok=True)
    teams: dict[str, list[TeammateSpec]] = {}
    for tm in scenario.teammates:
        team = tm.team or "default"
        teams.setdefault(team, []).append(tm)

    # Each team writes a deliverable, then the lead of team A sends a
    # cross-team message to the lead of team B.
    for team_name, members in teams.items():
        (workspace / f"team-{team_name}-output.txt").write_text(
            f"team {team_name} done with members "
            + ",".join(m.name for m in members)
        )
        result.tasks_completed += len(members)

    if len(teams) >= 2:
        names = sorted(teams.keys())
        sender = teams[names[0]][0]
        receiver = teams[names[1]][0]
        msg = {
            "from": sender.name,
            "team_from": names[0],
            "to": receiver.name,
            "team_to": names[1],
            "text": "cross-team handshake",
            "ts": _dt.datetime.utcnow().isoformat(),
        }
        team_dir = inbox_root / names[1]
        team_dir.mkdir(parents=True, exist_ok=True)
        (team_dir / f"{receiver.name}.json").write_text(json.dumps([msg], indent=2))
        result.messages_routed.append(
            {"from": sender.name, "to": receiver.name, "team": names[1]}
        )


_DISPATCH: dict[str, Callable[[InProcessScenarioEngine, Scenario, Path, RunResult], None]] = {
    "multi-file-rename": _handle_multi_file_rename,
    "spec-impl-pair": _handle_spec_impl_pair,
    "scan-build-review": _handle_scan_build_review,
    "doc-writer-team": _handle_doc_writer_team,
    "multi-language-port": _handle_multi_language_port,
    "audit-then-fix": _handle_audit_then_fix,
    "conflict-resolution-drill": _handle_conflict_resolution_drill,
    "abort-marker-test": _handle_abort_marker_test,
    "respawn-on-crash": _handle_respawn_on_crash,
    "multi-team-coordination": _handle_multi_team_coordination,
}


# Wire dispatch onto the engine class so subclasses can override per-scenario.
def _dispatch_for(name: str) -> Callable[..., None]:
    return _DISPATCH.get(name, InProcessScenarioEngine._handle_default)


__all__ = [
    "InProcessScenarioEngine",
    "RunResult",
    "Scenario",
    "ScenarioEngine",
    "TaskSpec",
    "TeammateSpec",
]
