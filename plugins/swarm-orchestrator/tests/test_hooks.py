"""
Tests for the swarm-orchestrator plugin hooks.

These tests are stdlib-only so they run anywhere Python 3.11+ is available.
Each test invokes the hook script as a subprocess with a synthetic Claude Code
hook payload on stdin and asserts behavior on stdout / state files.
"""

from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

PLUGIN_ROOT = pathlib.Path(__file__).resolve().parent.parent
HOOKS = PLUGIN_ROOT / "hooks"


def _run_hook(script: pathlib.Path, payload: dict, env_overrides: dict | None = None) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, str(script)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env=env,
        timeout=20,
    )


class TestOnTaskCompleteHook(unittest.TestCase):
    """on_task_complete.py: cascades on TaskUpdate(status=completed/merged)."""

    def setUp(self) -> None:
        self.tmp_home = tempfile.mkdtemp()
        self.fake_home = pathlib.Path(self.tmp_home)
        self.teams_root = self.fake_home / ".claude" / "teams"
        self.teams_root.mkdir(parents=True, exist_ok=True)

    def _write_dag(self, team: str, dag: dict) -> None:
        team_dir = self.teams_root / team
        team_dir.mkdir(parents=True, exist_ok=True)
        (team_dir / "swarm-dag.json").write_text(json.dumps(dag))

    def test_no_op_for_non_taskupdate(self) -> None:
        result = _run_hook(
            HOOKS / "on_task_complete.py",
            {"tool_name": "Edit", "tool_input": {}},
            env_overrides={"HOME": str(self.fake_home)},
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_no_op_for_non_terminal_status(self) -> None:
        result = _run_hook(
            HOOKS / "on_task_complete.py",
            {
                "tool_name": "TaskUpdate",
                "tool_input": {"task_id": "t1", "team": "demo", "status": "in_progress"},
            },
            env_overrides={"HOME": str(self.fake_home)},
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_cascade_unblocks_dependent_task(self) -> None:
        self._write_dag(
            "demo",
            {
                "tasks": {
                    "t1": {"status": "completed", "blockedBy": []},
                    "t2": {"status": "blocked", "blockedBy": ["t1"]},
                    "t3": {"status": "blocked", "blockedBy": ["t2"]},
                }
            },
        )

        result = _run_hook(
            HOOKS / "on_task_complete.py",
            {
                "tool_name": "TaskUpdate",
                "tool_input": {"task_id": "t1", "team": "demo", "status": "completed"},
            },
            env_overrides={"HOME": str(self.fake_home)},
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("newly unblocked: t2", result.stdout)
        # t3 should NOT be unblocked yet — t2 is still blocked.
        self.assertNotIn("t3", result.stdout)

        # Cascade event was logged.
        events_path = self.teams_root / "demo" / "cascade-events.jsonl"
        self.assertTrue(events_path.exists())
        lines = events_path.read_text().strip().splitlines()
        self.assertEqual(len(lines), 1)
        event = json.loads(lines[0])
        self.assertEqual(event["task_id"], "t1")
        self.assertEqual(event["new_status"], "completed")
        self.assertEqual(event["newly_unblocked"], ["t2"])

    def test_cascade_no_unblock_when_other_blocker_still_open(self) -> None:
        self._write_dag(
            "demo",
            {
                "tasks": {
                    "t1": {"status": "completed", "blockedBy": []},
                    "t2": {"status": "in_progress", "blockedBy": []},
                    "t3": {"status": "blocked", "blockedBy": ["t1", "t2"]},
                }
            },
        )

        result = _run_hook(
            HOOKS / "on_task_complete.py",
            {
                "tool_name": "TaskUpdate",
                "tool_input": {"task_id": "t1", "team": "demo", "status": "completed"},
            },
            env_overrides={"HOME": str(self.fake_home)},
        )
        self.assertEqual(result.returncode, 0)
        self.assertNotIn("t3", result.stdout)

    def test_handles_missing_dag_gracefully(self) -> None:
        result = _run_hook(
            HOOKS / "on_task_complete.py",
            {
                "tool_name": "TaskUpdate",
                "tool_input": {"task_id": "t1", "team": "no-such-team", "status": "completed"},
            },
            env_overrides={"HOME": str(self.fake_home)},
        )
        # Hook is non-blocking — it logs and exits 0 even when the DAG is missing.
        self.assertEqual(result.returncode, 0)


class TestReviewerCheckpointHook(unittest.TestCase):
    """reviewer_checkpoint.py: emits a checkpoint prompt every Nth turn."""

    def test_no_op_for_non_builder(self) -> None:
        result = _run_hook(
            HOOKS / "reviewer_checkpoint.py",
            {"agent_type": "scanner", "turn": 12, "cwd": "/tmp/whatever"},
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_no_op_below_floor(self) -> None:
        result = _run_hook(
            HOOKS / "reviewer_checkpoint.py",
            {"agent_type": "builder", "turn": 3, "cwd": "/tmp/whatever"},
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_fires_at_floor(self) -> None:
        result = _run_hook(
            HOOKS / "reviewer_checkpoint.py",
            {"agent_type": "builder", "turn": 6, "cwd": "/tmp/whatever"},
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("reviewer-checkpoint", result.stdout)

    def test_fires_every_n_after_floor(self) -> None:
        # turn=9 (floor=6, every_n=3): (9-6) % 3 == 0 → fires.
        result = _run_hook(
            HOOKS / "reviewer_checkpoint.py",
            {"agent_type": "builder", "turn": 9, "cwd": "/tmp/whatever"},
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("reviewer-checkpoint", result.stdout)

    def test_no_op_off_cycle(self) -> None:
        # turn=8 (floor=6, every_n=3): (8-6) % 3 == 2 → no-op.
        result = _run_hook(
            HOOKS / "reviewer_checkpoint.py",
            {"agent_type": "builder", "turn": 8, "cwd": "/tmp/whatever"},
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.strip(), "")

    def test_respects_disabled_config(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = pathlib.Path(tmp)
            (cwd / ".claude").mkdir()
            (cwd / ".claude" / "swarm-orchestrator.json").write_text(
                json.dumps({"reviewer_checkpoint": {"enabled": False}})
            )
            result = _run_hook(
                HOOKS / "reviewer_checkpoint.py",
                {"agent_type": "builder", "turn": 12, "cwd": str(cwd)},
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout.strip(), "")

    def test_respects_custom_every_n(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cwd = pathlib.Path(tmp)
            (cwd / ".claude").mkdir()
            (cwd / ".claude" / "swarm-orchestrator.json").write_text(
                json.dumps({"reviewer_checkpoint": {"every_n_turns": 2, "floor": 4}})
            )
            # turn=4 → fires (at floor)
            r1 = _run_hook(
                HOOKS / "reviewer_checkpoint.py",
                {"agent_type": "builder", "turn": 4, "cwd": str(cwd)},
            )
            self.assertIn("reviewer-checkpoint", r1.stdout)
            # turn=5 → off-cycle
            r2 = _run_hook(
                HOOKS / "reviewer_checkpoint.py",
                {"agent_type": "builder", "turn": 5, "cwd": str(cwd)},
            )
            self.assertEqual(r2.stdout.strip(), "")
            # turn=6 → fires (every_n=2)
            r3 = _run_hook(
                HOOKS / "reviewer_checkpoint.py",
                {"agent_type": "builder", "turn": 6, "cwd": str(cwd)},
            )
            self.assertIn("reviewer-checkpoint", r3.stdout)


class TestPluginManifest(unittest.TestCase):
    """plugin.json should be valid + present."""

    def test_manifest_exists_and_parses(self) -> None:
        manifest = PLUGIN_ROOT / ".claude-plugin" / "plugin.json"
        self.assertTrue(manifest.exists(), f"missing manifest: {manifest}")
        data = json.loads(manifest.read_text())
        self.assertEqual(data["name"], "swarm-orchestrator")
        self.assertIn("version", data)
        self.assertIn("description", data)
        self.assertIn("author", data)

    def test_all_commands_have_frontmatter(self) -> None:
        commands_dir = PLUGIN_ROOT / "commands"
        for cmd in commands_dir.glob("*.md"):
            text = cmd.read_text()
            self.assertTrue(
                text.startswith("---\n"),
                f"{cmd.name}: missing YAML frontmatter",
            )
            # frontmatter must contain a description.
            head = text.split("---", 2)[1]
            self.assertIn("description:", head, f"{cmd.name}: missing description")

    def test_all_agents_have_frontmatter(self) -> None:
        agents_dir = PLUGIN_ROOT / "agents"
        for agent in agents_dir.glob("*.md"):
            text = agent.read_text()
            self.assertTrue(
                text.startswith("---\n"),
                f"{agent.name}: missing YAML frontmatter",
            )
            head = text.split("---", 2)[1]
            self.assertIn("name:", head, f"{agent.name}: missing name")
            self.assertIn("description:", head, f"{agent.name}: missing description")
            self.assertIn("tools:", head, f"{agent.name}: missing tools list")
            self.assertIn("model:", head, f"{agent.name}: missing model")


if __name__ == "__main__":
    unittest.main()
