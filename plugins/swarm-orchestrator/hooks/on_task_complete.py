#!/usr/bin/env python3
"""
swarm-orchestrator: on-task-complete hook

Fires after every TaskUpdate. If the update set status=completed (or merged), we:

  1. Re-evaluate the DAG frontier — find tasks whose blockedBy is now satisfied
     and emit a hint via stdout (the orchestrator session reads this and dispatches).
  2. Optionally trigger the merge cascade (`/swarm-merge` programmatically) if
     the project config has `merge.auto_on_complete: true`.
  3. Optionally GC worktrees whose branch is now merged.

This hook is intentionally read-mostly — it does not mutate task state itself.
It writes a structured event to ~/.claude/teams/<team>/cascade-events.jsonl so
the orchestrator session can pick it up on its next poll.

Exit codes:
  0  — handled (or not applicable; e.g. update was not a status change)
  1  — fatal error (logged but does not block the TaskUpdate)

Reads JSON from stdin per Claude Code's hook protocol.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import pathlib
import sys
from typing import Any

TEAMS_ROOT = pathlib.Path(os.path.expanduser("~/.claude/teams"))
LOG_PATH = pathlib.Path(os.path.expanduser("~/.claude/swarm-orchestrator-hook.log"))


def _log(msg: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a") as fh:
        fh.write(f"{_dt.datetime.utcnow().isoformat()}Z on_task_complete {msg}\n")


def _atomic_append_jsonl(path: pathlib.Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    line = json.dumps(record, ensure_ascii=False) + "\n"
    with path.open("a") as fh:
        fh.write(line)


def _read_dag(team: str) -> dict[str, Any] | None:
    path = TEAMS_ROOT / team / "swarm-dag.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        _log(f"failed to read DAG for {team}: {e}")
        return None


def _unblocked_after(dag: dict[str, Any]) -> list[str]:
    """Return task ids whose blockedBy entries are all in {completed, merged}."""
    tasks = dag.get("tasks", {})
    done = {t_id for t_id, t in tasks.items() if t.get("status") in {"completed", "merged"}}
    out = []
    for t_id, task in tasks.items():
        if task.get("status") not in {"pending", "blocked"}:
            continue
        blockers = task.get("blockedBy", [])
        if all(b in done for b in blockers):
            out.append(t_id)
    return out


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError) as e:
        _log(f"could not parse stdin: {e}")
        return 0  # don't block the user's TaskUpdate

    tool = payload.get("tool_name") or payload.get("tool", "")
    if tool != "TaskUpdate":
        return 0

    tool_input = payload.get("tool_input") or payload.get("input", {})
    new_status = (tool_input.get("status") or "").lower()
    if new_status not in {"completed", "merged"}:
        return 0

    task_id = tool_input.get("task_id") or tool_input.get("id")
    team = tool_input.get("team") or payload.get("team_name")
    if not (task_id and team):
        _log(f"missing task_id or team in TaskUpdate payload: {payload!r}")
        return 0

    dag = _read_dag(team)
    if dag is None:
        _log(f"no DAG found for team {team}; skipping cascade")
        return 0

    newly_unblocked = _unblocked_after(dag)

    event = {
        "ts": _dt.datetime.utcnow().isoformat() + "Z",
        "kind": "task_complete",
        "team": team,
        "task_id": task_id,
        "new_status": new_status,
        "newly_unblocked": newly_unblocked,
    }
    _atomic_append_jsonl(TEAMS_ROOT / team / "cascade-events.jsonl", event)

    # Surface the cascade to the orchestrator's chat so it's visible.
    if newly_unblocked:
        print(
            f"[swarm-orchestrator] task {task_id} {new_status}; "
            f"newly unblocked: {', '.join(newly_unblocked)}"
        )

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001  # never block a TaskUpdate
        _log(f"fatal: {exc!r}")
        sys.exit(0)
