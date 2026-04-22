"""Tests for the deny-with-reason PreToolUse hook."""

import json
import subprocess
import sys
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

# Add the hooks directory to the path so we can import the module
HOOKS_DIR = Path(__file__).parent.parent / "hooks"
sys.path.insert(0, str(HOOKS_DIR))

import pretooluse  # noqa: E402


# ---------------------------------------------------------------------------
# Pattern parsing
# ---------------------------------------------------------------------------


class TestParsePattern:
    def test_tool_with_glob(self) -> None:
        assert pretooluse.parse_pattern("Bash(pnpm *)") == ("Bash", "pnpm *")

    def test_tool_with_file_glob(self) -> None:
        assert pretooluse.parse_pattern("Edit(*.env)") == ("Edit", "*.env")

    def test_tool_only(self) -> None:
        assert pretooluse.parse_pattern("Bash") == ("Bash", "*")

    def test_tool_with_path_glob(self) -> None:
        assert pretooluse.parse_pattern("Read(/etc/*)") == ("Read", "/etc/*")

    def test_whitespace_handling(self) -> None:
        assert pretooluse.parse_pattern("  Bash  ") == ("Bash", "*")
        assert pretooluse.parse_pattern("Bash( pnpm * )") == ("Bash", "pnpm *")

    def test_nested_parens_in_glob(self) -> None:
        # Edge case: glob contains parens — only outer parens should split
        tool, glob = pretooluse.parse_pattern("Bash(echo (hello))")
        assert tool == "Bash"
        # Takes everything between first ( and last )
        assert glob == "echo (hello)"

    def test_empty_glob(self) -> None:
        assert pretooluse.parse_pattern("Bash()") == ("Bash", "")


# ---------------------------------------------------------------------------
# Primary argument extraction
# ---------------------------------------------------------------------------


class TestGetPrimaryArg:
    def test_bash_command(self) -> None:
        assert pretooluse.get_primary_arg("Bash", {"command": "npm install"}) == "npm install"

    def test_edit_file_path(self) -> None:
        assert pretooluse.get_primary_arg("Edit", {"file_path": "/app/.env"}) == "/app/.env"

    def test_write_file_path(self) -> None:
        assert pretooluse.get_primary_arg("Write", {"file_path": "/app/main.py"}) == "/app/main.py"

    def test_webfetch_url(self) -> None:
        assert pretooluse.get_primary_arg("WebFetch", {"url": "https://example.com"}) == "https://example.com"

    def test_unknown_tool_with_command(self) -> None:
        assert pretooluse.get_primary_arg("CustomTool", {"command": "foo"}) == "foo"

    def test_unknown_tool_no_known_keys(self) -> None:
        assert pretooluse.get_primary_arg("CustomTool", {"something": "else"}) == ""

    def test_missing_field(self) -> None:
        assert pretooluse.get_primary_arg("Bash", {}) == ""


# ---------------------------------------------------------------------------
# Rule matching
# ---------------------------------------------------------------------------


class TestFindMatchingRule:
    def test_match_bash_pattern(self) -> None:
        rules = [{"pattern": "Bash(pnpm *)", "reason": "Use npm"}]
        result = pretooluse.find_matching_rule(rules, "Bash", "pnpm install lodash")
        assert result is not None
        assert result["reason"] == "Use npm"

    def test_no_match_different_command(self) -> None:
        rules = [{"pattern": "Bash(pnpm *)", "reason": "Use npm"}]
        result = pretooluse.find_matching_rule(rules, "Bash", "npm install lodash")
        assert result is None

    def test_no_match_different_tool(self) -> None:
        rules = [{"pattern": "Bash(pnpm *)", "reason": "Use npm"}]
        result = pretooluse.find_matching_rule(rules, "Edit", "pnpm install")
        assert result is None

    def test_match_file_pattern(self) -> None:
        rules = [{"pattern": "Edit(*.env)", "reason": "Don't edit env files"}]
        result = pretooluse.find_matching_rule(rules, "Edit", "/app/.env")
        assert result is not None
        assert result["reason"] == "Don't edit env files"

    def test_match_case_insensitive_fallback(self) -> None:
        rules = [{"pattern": "Edit(*.ENV)", "reason": "No env files"}]
        result = pretooluse.find_matching_rule(rules, "Edit", "/app/.env")
        assert result is not None

    def test_first_match_wins(self) -> None:
        rules = [
            {"pattern": "Bash(pnpm *)", "reason": "First reason"},
            {"pattern": "Bash(pnpm install*)", "reason": "Second reason"},
        ]
        result = pretooluse.find_matching_rule(rules, "Bash", "pnpm install foo")
        assert result is not None
        assert result["reason"] == "First reason"

    def test_wildcard_tool_match(self) -> None:
        rules = [{"pattern": "Bash", "reason": "No bash allowed"}]
        result = pretooluse.find_matching_rule(rules, "Bash", "anything at all")
        assert result is not None

    def test_skip_rules_without_pattern(self) -> None:
        rules = [{"reason": "No pattern here"}]
        result = pretooluse.find_matching_rule(rules, "Bash", "anything")
        assert result is None

    def test_empty_rules(self) -> None:
        result = pretooluse.find_matching_rule([], "Bash", "anything")
        assert result is None


# ---------------------------------------------------------------------------
# Deny response format
# ---------------------------------------------------------------------------


class TestDenyResponse:
    def test_response_structure(self) -> None:
        response = pretooluse.deny_response("Use npm instead")
        assert response == {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
            },
            "systemMessage": "Use npm instead",
        }

    def test_response_is_json_serializable(self) -> None:
        response = pretooluse.deny_response("reason with 'quotes' and \"doubles\"")
        serialized = json.dumps(response)
        deserialized = json.loads(serialized)
        assert deserialized["systemMessage"] == "reason with 'quotes' and \"doubles\""


# ---------------------------------------------------------------------------
# Config loading
# ---------------------------------------------------------------------------


class TestLoadConfig:
    def test_load_json_config(self, tmp_path: Path) -> None:
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        config_file = config_dir / "deny-reasons.json"
        config_file.write_text(json.dumps({
            "rules": [{"pattern": "Bash(pnpm *)", "reason": "Use npm"}]
        }))
        result = pretooluse.load_config(tmp_path)
        assert result is not None
        assert len(result["rules"]) == 1

    def test_load_yaml_config(self, tmp_path: Path) -> None:
        yaml = pytest.importorskip("yaml")
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        config_file = config_dir / "deny-reasons.yaml"
        config_file.write_text(
            "rules:\n"
            '  - pattern: "Bash(pnpm *)"\n'
            '    reason: "Use npm"\n'
        )
        result = pretooluse.load_config(tmp_path)
        assert result is not None
        assert len(result["rules"]) == 1

    def test_no_config_returns_none(self, tmp_path: Path) -> None:
        result = pretooluse.load_config(tmp_path)
        assert result is None

    def test_invalid_json_returns_none(self, tmp_path: Path) -> None:
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        config_file = config_dir / "deny-reasons.json"
        config_file.write_text("not valid json {{{")
        result = pretooluse.load_config(tmp_path)
        assert result is None

    def test_yaml_preferred_over_json(self, tmp_path: Path) -> None:
        yaml = pytest.importorskip("yaml")
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        # Write both YAML and JSON
        (config_dir / "deny-reasons.yaml").write_text(
            "rules:\n"
            '  - pattern: "Bash(yarn *)"\n'
            '    reason: "from yaml"\n'
        )
        (config_dir / "deny-reasons.json").write_text(json.dumps({
            "rules": [{"pattern": "Bash(yarn *)", "reason": "from json"}]
        }))
        result = pretooluse.load_config(tmp_path)
        assert result is not None
        assert result["rules"][0]["reason"] == "from yaml"


# ---------------------------------------------------------------------------
# Integration: end-to-end subprocess tests
# ---------------------------------------------------------------------------


class TestEndToEnd:
    """Run pretooluse.py as a subprocess, matching how Claude Code invokes it."""

    HOOK_SCRIPT = str(HOOKS_DIR / "pretooluse.py")

    def _run_hook(self, input_data: dict[str, Any], cwd: str = "/tmp") -> tuple[str, int]:
        """Run the hook script with JSON input, return (stdout, exit_code)."""
        result = subprocess.run(
            [sys.executable, self.HOOK_SCRIPT],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
        )
        return result.stdout.strip(), result.returncode

    def test_deny_with_json_config(self, tmp_path: Path) -> None:
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        (config_dir / "deny-reasons.json").write_text(json.dumps({
            "rules": [{"pattern": "Bash(pnpm *)", "reason": "Use npm instead"}]
        }))

        stdout, code = self._run_hook(
            {
                "tool_name": "Bash",
                "tool_input": {"command": "pnpm install lodash"},
                "cwd": str(tmp_path),
            }
        )
        assert code == 0
        response = json.loads(stdout)
        assert response["hookSpecificOutput"]["permissionDecision"] == "deny"
        assert response["systemMessage"] == "Use npm instead"

    def test_no_match_produces_no_output(self, tmp_path: Path) -> None:
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        (config_dir / "deny-reasons.json").write_text(json.dumps({
            "rules": [{"pattern": "Bash(pnpm *)", "reason": "Use npm"}]
        }))

        stdout, code = self._run_hook(
            {
                "tool_name": "Bash",
                "tool_input": {"command": "npm install lodash"},
                "cwd": str(tmp_path),
            }
        )
        assert code == 0
        assert stdout == ""

    def test_no_config_passes_silently(self) -> None:
        stdout, code = self._run_hook(
            {
                "tool_name": "Bash",
                "tool_input": {"command": "pnpm install"},
                "cwd": "/tmp/nonexistent-dir-12345",
            }
        )
        assert code == 0
        assert stdout == ""

    def test_invalid_json_input_exits_cleanly(self) -> None:
        result = subprocess.run(
            [sys.executable, self.HOOK_SCRIPT],
            input="not json at all",
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert result.stdout.strip() == ""

    def test_edit_env_denied(self, tmp_path: Path) -> None:
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        (config_dir / "deny-reasons.json").write_text(json.dumps({
            "rules": [{"pattern": "Edit(*.env)", "reason": "Use .env.example"}]
        }))

        stdout, code = self._run_hook(
            {
                "tool_name": "Edit",
                "tool_input": {"file_path": "/app/.env", "old_string": "x", "new_string": "y"},
                "cwd": str(tmp_path),
            }
        )
        assert code == 0
        response = json.loads(stdout)
        assert response["hookSpecificOutput"]["permissionDecision"] == "deny"
        assert response["systemMessage"] == "Use .env.example"

    def test_default_reason_when_missing(self, tmp_path: Path) -> None:
        config_dir = tmp_path / ".claude"
        config_dir.mkdir()
        (config_dir / "deny-reasons.json").write_text(json.dumps({
            "rules": [{"pattern": "Bash(rm -rf *)"}]
        }))

        stdout, code = self._run_hook(
            {
                "tool_name": "Bash",
                "tool_input": {"command": "rm -rf /tmp/foo"},
                "cwd": str(tmp_path),
            }
        )
        assert code == 0
        response = json.loads(stdout)
        assert response["systemMessage"] == "This tool call was denied by project configuration."
