#!/usr/bin/env python3
"""
swarm-orchestrator: reviewer-checkpoint hook

Fires on Stop. If the session is a swarm Builder AND the turn count crosses a
configured threshold (default: every Nth turn after turn `floor`), this hook
prints a lightweight self-review prompt to stdout, which Claude Code injects
into the Builder's next system message.

The actual deep review is delegated to the Reviewer subagent on demand — this
hook is a cheap, deterministic nudge.

Configuration: project's .claude/swarm-orchestrator.json:
  {
    "reviewer_checkpoint": {
      "enabled": true,
      "every_n_turns": 3,
      "floor": 6
    }
  }

If the file is missing or `enabled` is false, the hook is a no-op.

Reads JSON from stdin per Claude Code's hook protocol.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import pathlib
import sys
from typing import Any

LOG_PATH = pathlib.Path(os.path.expanduser("~/.claude/swarm-orchestrator-hook.log"))


def _log(msg: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a") as fh:
        fh.write(f"{_dt.datetime.utcnow().isoformat()}Z reviewer_checkpoint {msg}\n")


def _load_config(cwd: pathlib.Path) -> dict[str, Any]:
    candidate = cwd / ".claude" / "swarm-orchestrator.json"
    if not candidate.exists():
        return {}
    try:
        return json.loads(candidate.read_text())
    except (OSError, json.JSONDecodeError) as e:
        _log(f"could not parse config at {candidate}: {e}")
        return {}


def _is_swarm_builder(payload: dict[str, Any]) -> bool:
    """Heuristic: this is a swarm Builder session if the agent identity hints so."""
    agent = (payload.get("agent_type") or payload.get("subagent_type") or "").lower()
    if agent == "builder":
        return True
    # Fall back: check the working directory for a swarm worktree marker.
    cwd = payload.get("cwd") or os.getcwd()
    return "/.claude/worktrees/" in cwd or "/swarm-" in cwd


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, OSError) as e:
        _log(f"could not parse stdin: {e}")
        return 0

    if not _is_swarm_builder(payload):
        return 0

    cwd = pathlib.Path(payload.get("cwd") or os.getcwd())
    config = _load_config(cwd).get("reviewer_checkpoint", {})
    if not config.get("enabled", True):
        return 0

    every_n = int(config.get("every_n_turns", 3))
    floor = int(config.get("floor", 6))

    turn = int(payload.get("turn") or payload.get("turn_count") or 0)
    if turn < floor:
        return 0
    if (turn - floor) % every_n != 0:
        return 0

    print(
        "[swarm-orchestrator reviewer-checkpoint]\n"
        f"You are at turn {turn}. Before continuing, do a quick self-review:\n"
        "  1. DAG status: is your task still in_progress as expected?\n"
        "  2. Commits: how many since you started? Are they small + focused?\n"
        "  3. TodoWrite: how many items done vs. remaining?\n"
        "  4. Tractability: any sign of thrash (same file edited > 5x with no commit; "
        "repeated test failures with no diagnostic between them)?\n"
        "If you spot drift, course-correct now. If you're stuck, write the abort "
        "marker and surface to the operator."
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        _log(f"fatal: {exc!r}")
        sys.exit(0)
