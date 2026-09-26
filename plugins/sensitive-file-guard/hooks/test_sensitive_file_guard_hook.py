#!/usr/bin/env python3
"""Focused regression tests for the sensitive file guard hook."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


HOOK_SCRIPT = Path(__file__).with_name("sensitive_file_guard_hook.py")
WRAPPER_SCRIPT = Path(__file__).with_name("run_sensitive_file_guard.sh")


def normalize_expected_path(base_dir, file_path):
    """Mirror the hook's normalization rules for assertions."""
    return os.path.normcase(
        os.path.abspath(os.path.join(str(base_dir), file_path))
    ).replace("\\", "/")


def run_hook(payload, home_dir):
    """Execute the hook script with a temporary HOME for isolated state."""
    env = os.environ.copy()
    env["HOME"] = str(home_dir)
    env["PYTHONIOENCODING"] = "utf-8"

    return subprocess.run(
        [sys.executable, str(HOOK_SCRIPT)],
        input=json.dumps(payload),
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )


def load_state(home_dir, session_id):
    """Load session state from the temp HOME, if it exists."""
    state_file = (
        Path(home_dir)
        / ".claude"
        / f"sensitive_file_guard_state_{session_id}.json"
    )
    if not state_file.exists():
        return None
    return json.loads(state_file.read_text(encoding="utf-8"))


class SensitiveFileGuardHookTests(unittest.TestCase):
    def test_wrapper_supports_quoted_paths(self):
        with tempfile.TemporaryDirectory() as home_dir, tempfile.TemporaryDirectory() as temp_root:
            wrapper_root = Path(temp_root) / "guard with spaces"
            wrapper_root.mkdir(parents=True, exist_ok=True)
            wrapper_copy = wrapper_root / "run_sensitive_file_guard.sh"
            hook_copy = wrapper_root / "sensitive_file_guard_hook.py"
            shutil.copy2(WRAPPER_SCRIPT, wrapper_copy)
            shutil.copy2(HOOK_SCRIPT, hook_copy)

            payload = {
                "hook_event_name": "PreToolUse",
                "session_id": "quoted-wrapper",
                "cwd": temp_root,
                "tool_use_id": "wrapper-1",
                "tool_name": "Edit",
                "tool_input": {"file_path": "Dockerfile"},
            }

            env = os.environ.copy()
            env["HOME"] = str(home_dir)
            env["PYTHONIOENCODING"] = "utf-8"
            result = subprocess.run(
                ["bash", str(wrapper_copy)],
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                env=env,
                check=False,
            )

            self.assertEqual(result.returncode, 0)
            self.assertEqual(
                json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"],
                "ask",
            )

    def test_env_file_is_denied_without_allowlisting(self):
        with tempfile.TemporaryDirectory() as home_dir, tempfile.TemporaryDirectory() as project_dir:
            payload = {
                "hook_event_name": "PreToolUse",
                "session_id": "deny-env",
                "cwd": project_dir,
                "tool_use_id": "deny-env-1",
                "tool_name": "Edit",
                "tool_input": {"file_path": ".env"},
            }

            result = run_hook(payload, home_dir)

            self.assertEqual(result.returncode, 0)
            output = json.loads(result.stdout)
            self.assertEqual(
                output["hookSpecificOutput"]["permissionDecision"],
                "deny",
            )
            self.assertIsNone(load_state(home_dir, "deny-env"))

    def test_medium_risk_file_is_allowlisted_only_after_post_tool_use(self):
        with tempfile.TemporaryDirectory() as home_dir, tempfile.TemporaryDirectory() as project_dir:
            session_id = "dockerfile-session"
            file_path = "Dockerfile"

            pretool_payload = {
                "hook_event_name": "PreToolUse",
                "session_id": session_id,
                "cwd": project_dir,
                "tool_use_id": "dockerfile-1",
                "tool_name": "Write",
                "tool_input": {"file_path": file_path, "content": "FROM alpine:3.20\n"},
            }

            first_result = run_hook(pretool_payload, home_dir)
            self.assertEqual(first_result.returncode, 0)
            first_output = json.loads(first_result.stdout)
            self.assertEqual(
                first_output["hookSpecificOutput"]["permissionDecision"],
                "ask",
            )
            pending_state = load_state(home_dir, session_id)
            self.assertIsNotNone(pending_state)
            self.assertIn("dockerfile-1", pending_state["pending_requests"])

            posttool_payload = {
                "hook_event_name": "PostToolUse",
                "session_id": session_id,
                "cwd": project_dir,
                "tool_use_id": "dockerfile-1",
                "tool_name": "Write",
                "tool_input": {"file_path": file_path, "content": "FROM alpine:3.20\n"},
                "tool_result": "Write completed successfully",
            }

            post_result = run_hook(posttool_payload, home_dir)
            self.assertEqual(post_result.returncode, 0)
            self.assertEqual(post_result.stdout, "")

            state = load_state(home_dir, session_id)
            self.assertIsNotNone(state)
            allowed_files = state["allowed_files"]
            expected_path = normalize_expected_path(project_dir, file_path)
            self.assertIn(expected_path, allowed_files)
            self.assertEqual(state["pending_requests"], {})

            second_result = run_hook(pretool_payload, home_dir)
            second_output = json.loads(second_result.stdout)
            self.assertEqual(
                second_output["hookSpecificOutput"]["permissionDecision"],
                "allow",
            )

    def test_post_tool_use_without_matching_pending_request_does_not_allowlist(self):
        with tempfile.TemporaryDirectory() as home_dir, tempfile.TemporaryDirectory() as project_dir:
            session_id = "missing-pending"
            payload = {
                "hook_event_name": "PostToolUse",
                "session_id": session_id,
                "cwd": project_dir,
                "tool_use_id": "orphan-call",
                "tool_name": "Edit",
                "tool_input": {"file_path": "Dockerfile"},
                "tool_result": "Edit completed successfully",
            }

            result = run_hook(payload, home_dir)

            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout, "")
            state = load_state(home_dir, session_id)
            self.assertIsNotNone(state)
            self.assertEqual(state["allowed_files"], [])
            self.assertEqual(state["pending_requests"], {})

    def test_post_tool_use_failure_clears_pending_request(self):
        with tempfile.TemporaryDirectory() as home_dir, tempfile.TemporaryDirectory() as project_dir:
            session_id = "failure-path"
            pretool_payload = {
                "hook_event_name": "PreToolUse",
                "session_id": session_id,
                "cwd": project_dir,
                "tool_use_id": "fail-1",
                "tool_name": "Edit",
                "tool_input": {"file_path": "Dockerfile"},
            }
            failure_payload = {
                "hook_event_name": "PostToolUseFailure",
                "session_id": session_id,
                "cwd": project_dir,
                "tool_use_id": "fail-1",
                "tool_name": "Edit",
                "tool_input": {"file_path": "Dockerfile"},
                "tool_response": {"success": False, "error": "write failed"},
            }

            first_result = run_hook(pretool_payload, home_dir)
            self.assertEqual(
                json.loads(first_result.stdout)["hookSpecificOutput"]["permissionDecision"],
                "ask",
            )
            state_before = load_state(home_dir, session_id)
            self.assertIn("fail-1", state_before["pending_requests"])

            failure_result = run_hook(failure_payload, home_dir)
            self.assertEqual(failure_result.returncode, 0)
            self.assertEqual(failure_result.stdout, "")

            state_after = load_state(home_dir, session_id)
            self.assertEqual(state_after["pending_requests"], {})
            self.assertEqual(state_after["allowed_files"], [])

    def test_infrastructure_code_asks_while_tfstate_denies(self):
        with tempfile.TemporaryDirectory() as home_dir, tempfile.TemporaryDirectory() as project_dir:
            ask_payload = {
                "hook_event_name": "PreToolUse",
                "session_id": "terraform-ask",
                "cwd": project_dir,
                "tool_use_id": "terraform-ask-1",
                "tool_name": "Edit",
                "tool_input": {"file_path": "terraform/main.tf"},
            }
            deny_payload = {
                "hook_event_name": "PreToolUse",
                "session_id": "terraform-deny",
                "cwd": project_dir,
                "tool_use_id": "terraform-deny-1",
                "tool_name": "Edit",
                "tool_input": {"file_path": "terraform.tfstate"},
            }

            ask_result = run_hook(ask_payload, home_dir)
            deny_result = run_hook(deny_payload, home_dir)

            self.assertEqual(
                json.loads(ask_result.stdout)["hookSpecificOutput"]["permissionDecision"],
                "ask",
            )
            self.assertEqual(
                json.loads(deny_result.stdout)["hookSpecificOutput"]["permissionDecision"],
                "deny",
            )

    def test_legacy_warning_state_is_not_treated_as_confirmation(self):
        with tempfile.TemporaryDirectory() as home_dir, tempfile.TemporaryDirectory() as project_dir:
            session_id = "legacy-state"
            state_dir = Path(home_dir) / ".claude"
            state_dir.mkdir(parents=True, exist_ok=True)
            legacy_state_file = state_dir / f"sensitive_file_guard_state_{session_id}.json"
            legacy_state_file.write_text(
                json.dumps([normalize_expected_path(project_dir, "Dockerfile")]),
                encoding="utf-8",
            )

            payload = {
                "hook_event_name": "PreToolUse",
                "session_id": session_id,
                "cwd": project_dir,
                "tool_use_id": "legacy-state-1",
                "tool_name": "Edit",
                "tool_input": {"file_path": "Dockerfile"},
            }

            result = run_hook(payload, home_dir)

            self.assertEqual(result.returncode, 0)
            self.assertEqual(
                json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"],
                "ask",
            )


if __name__ == "__main__":
    unittest.main()
