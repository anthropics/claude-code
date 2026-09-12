"""Post-run assertion harness — the same code judges every binding.

Each assertion failure raises :class:`AssertionFailure`, the runner
catches and prints; non-zero exit code propagates to CI.
"""
from __future__ import annotations

import dataclasses
import json
import subprocess
from pathlib import Path
from typing import Any, Mapping

from .stub import RunResult, Scenario


class AssertionFailure(AssertionError):
    """Raised by :func:`evaluate` for any expectation mismatch."""


@dataclasses.dataclass
class AssertionReport:
    scenario: str
    binding: str
    passed: list[str] = dataclasses.field(default_factory=list)
    failed: list[str] = dataclasses.field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.failed

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario": self.scenario,
            "binding": self.binding,
            "passed": list(self.passed),
            "failed": list(self.failed),
            "ok": self.ok,
        }


def evaluate(scenario: Scenario, result: RunResult, workspace: Path) -> AssertionReport:
    rep = AssertionReport(scenario=scenario.name, binding=result.binding)
    expected: Mapping[str, Any] = scenario.expected

    def check(label: str, ok: bool, detail: str = "") -> None:
        if ok:
            rep.passed.append(label)
        else:
            rep.failed.append(f"{label} :: {detail}")

    if "tasks_completed" in expected:
        want = int(expected["tasks_completed"])
        check(
            "tasks_completed",
            result.tasks_completed == want,
            f"got {result.tasks_completed} want {want}",
        )

    if "tasks_failed" in expected:
        want = int(expected["tasks_failed"])
        check(
            "tasks_failed",
            result.tasks_failed == want,
            f"got {result.tasks_failed} want {want}",
        )

    if "tasks_aborted" in expected:
        want = int(expected["tasks_aborted"])
        check(
            "tasks_aborted",
            result.tasks_aborted == want,
            f"got {result.tasks_aborted} want {want}",
        )

    if "merge_conflicts" in expected:
        want = int(expected["merge_conflicts"])
        check(
            "merge_conflicts",
            result.merge_conflicts == want,
            f"got {result.merge_conflicts} want {want}",
        )

    if "branches_in_master" in expected:
        want_branches = list(expected["branches_in_master"])
        merged = _git_branches_merged(workspace)
        for b in want_branches:
            check(
                f"branch_in_master:{b}",
                b in result.branches_in_master or b in merged,
                f"branch {b!r} not merged",
            )

    if "files_present" in expected:
        for rel in expected["files_present"]:
            p = workspace / rel
            check(f"file_present:{rel}", p.exists(), f"missing {p}")

    if "files_absent" in expected:
        for rel in expected["files_absent"]:
            p = workspace / rel
            check(f"file_absent:{rel}", not p.exists(), f"unexpected {p}")

    for entry in expected.get("file_contains", []):
        p = workspace / entry["path"]
        sub = entry["substring"]
        ok = p.exists() and sub in p.read_text(encoding="utf-8")
        check(f"file_contains:{entry['path']}:{sub!r}", ok, f"{p} missing {sub!r}")

    for entry in expected.get("file_absent_substring", []):
        p = workspace / entry["path"]
        sub = entry["substring"]
        ok = p.exists() and sub not in p.read_text(encoding="utf-8")
        check(
            f"file_absent_substring:{entry['path']}:{sub!r}",
            ok,
            f"{p} still contains {sub!r}",
        )

    for want_msg in expected.get("messages_routed", []):
        ok = any(
            r.get("from") == want_msg["from"] and r.get("to") == want_msg["to"]
            and (
                "team" not in want_msg or r.get("team") == want_msg.get("team")
            )
            for r in result.messages_routed
        )
        check(
            f"message_routed:{want_msg['from']}->{want_msg['to']}",
            ok,
            f"messages={result.messages_routed!r}",
        )

    if "abort_wip_commit_present" in expected:
        want = bool(expected["abort_wip_commit_present"])
        ok = result.abort_wip_commit_present == want
        if want:
            # Cross-check git log
            log = _git_log(workspace, max_count=5)
            ok = ok and any("WIP" in line for line in log)
        check("abort_wip_commit_present", ok, f"git log: {_git_log(workspace, 3)!r}")

    if "respawn_count_min" in expected:
        want = int(expected["respawn_count_min"])
        check(
            "respawn_count_min",
            result.respawn_count >= want,
            f"got {result.respawn_count} want >= {want}",
        )

    return rep


def _git_branches_merged(workspace: Path) -> list[str]:
    try:
        out = subprocess.run(
            ["git", "branch", "--merged", "master"],
            cwd=str(workspace),
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    return [
        line.strip().lstrip("*").strip()
        for line in out.stdout.splitlines()
        if line.strip()
    ]


def _git_log(workspace: Path, max_count: int = 10) -> list[str]:
    try:
        out = subprocess.run(
            ["git", "log", f"-{max_count}", "--pretty=%s"],
            cwd=str(workspace),
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    return [line for line in out.stdout.splitlines() if line.strip()]


__all__ = [
    "AssertionFailure",
    "AssertionReport",
    "evaluate",
]
