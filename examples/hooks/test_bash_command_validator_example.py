#!/usr/bin/env python3
"""Tests for the Bash command validator example hook."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

import bash_command_validator_example as validator


HOOK = Path(__file__).with_name("bash_command_validator_example.py")


def run_hook(command: str) -> subprocess.CompletedProcess:
    payload = json.dumps(
        {"tool_name": "Bash", "tool_input": {"command": command}}
    )
    return subprocess.run(
        [sys.executable, str(HOOK)],
        input=payload,
        text=True,
        capture_output=True,
        check=False,
    )


class BashCommandValidatorTests(unittest.TestCase):
    def assert_allowed(self, command: str) -> None:
        result = run_hook(command)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def assert_denied(self, command: str, construct: str) -> None:
        result = run_hook(command)
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertIn(construct, result.stderr)
        self.assertIn("separate Bash calls", result.stderr)

    def test_simple_command_passes(self) -> None:
        self.assert_allowed("git status --short")

    def test_semicolon_chaining_is_denied(self) -> None:
        self.assert_denied(
            "git add README.md; git commit -m 'Update README'", "semicolon chaining"
        )

    def test_and_chaining_is_denied(self) -> None:
        self.assert_denied("git add README.md && git commit -m docs", "&& chaining")

    def test_or_chaining_is_denied(self) -> None:
        self.assert_denied("test -f config || touch config", "|| chaining")

    def test_newline_chaining_is_denied(self) -> None:
        self.assert_denied(
            "git add x\ngit commit -m y", "newline chaining"
        )

    def test_pipe_is_denied(self) -> None:
        self.assert_denied("printf '%s\\n' item | sed 's/item/new/'", "pipe")

    def test_dollar_command_substitution_is_denied(self) -> None:
        self.assert_denied("echo $(git rev-parse HEAD)", "command substitution")

    def test_backtick_command_substitution_is_denied(self) -> None:
        self.assert_denied("echo `git rev-parse HEAD`", "backtick substitution")

    def test_find_exec_is_denied(self) -> None:
        self.assert_denied("find . -type f -exec chmod 600 {} \\;", "find -exec")

    def test_xargs_is_denied(self) -> None:
        self.assert_denied("xargs rm -f", "xargs")

    def test_output_redirect_is_denied(self) -> None:
        self.assert_denied("printf ready > status.txt", "> redirection")

    def test_append_redirect_is_denied(self) -> None:
        self.assert_denied("printf ready >> status.txt", ">> redirection")

    def test_stderr_file_redirects_pass(self) -> None:
        for command in (
            "ls 2>/dev/null",
            "cat log 2>>err.log",
        ):
            with self.subTest(command=command):
                self.assert_allowed(command)

    def test_fd_duplication_redirects_pass(self) -> None:
        for command in (
            "make 2>&1",
            "cmd &>/dev/null",
            "cmd >&2",
        ):
            with self.subTest(command=command):
                self.assert_allowed(command)

    def test_file_redirect_ignores_trailing_fd_duplication_in_steer(self) -> None:
        result = run_hook("python3 script.py > out.log 2>&1")
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("out.log", result.stderr)
        self.assertNotIn("`2`", result.stderr)
        self.assertNotIn("&1", result.stderr)

    def test_tee_is_denied(self) -> None:
        self.assert_denied("tee status.txt", "tee")

    def test_quoted_compound_characters_pass(self) -> None:
        result = run_hook("printf '%s\\n' 'a && b || c; x | y > z $(noop) `noop`'")
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_heredoc_body_is_not_scanned(self) -> None:
        command = "cat <<'EOF'\na && b || c; x | sed > out\n$(noop) `noop`\nEOF"
        self.assert_allowed(command)

    def test_newline_separated_commands_in_heredoc_body_pass(self) -> None:
        command = "cat <<'EOF'\ngit add x\ngit commit -m y\nEOF"
        self.assert_allowed(command)

    def test_allowlisted_read_only_pipe_passes_when_enabled(self) -> None:
        issues = validator._validate_command(
            "printf '%s\\n' item | head -n 1", allow_read_only_pipes=True
        )
        self.assertEqual(issues, [])


if __name__ == "__main__":
    unittest.main()
