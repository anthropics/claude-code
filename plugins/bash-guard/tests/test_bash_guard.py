#!/usr/bin/env python3
"""
Tests for bash_guard.py — the compound-command permission bypass fix.

Run with:
    python3 -m pytest plugins/bash-guard/tests/test_bash_guard.py -v
or:
    python3 plugins/bash-guard/tests/test_bash_guard.py
"""

import sys
import os
import unittest

# Allow running from repo root or from this directory
_HOOK_DIR = os.path.join(os.path.dirname(__file__), "..", "hooks")
if _HOOK_DIR not in sys.path:
    sys.path.insert(0, _HOOK_DIR)

from bash_guard import split_compound_command, segment_matches_deny, _normalise_segment


# ---------------------------------------------------------------------------
# split_compound_command
# ---------------------------------------------------------------------------

class TestSplitCompoundCommand(unittest.TestCase):

    def test_simple_command_returns_single_segment(self):
        self.assertEqual(split_compound_command("git status"), ["git status"])

    def test_and_and_operator(self):
        self.assertEqual(
            split_compound_command("git status && rm -rf /tmp"),
            ["git status", "rm -rf /tmp"],
        )

    def test_or_or_operator(self):
        self.assertEqual(
            split_compound_command("make build || make install"),
            ["make build", "make install"],
        )

    def test_semicolon_operator(self):
        self.assertEqual(
            split_compound_command("cd /tmp; rm -rf ."),
            ["cd /tmp", "rm -rf ."],
        )

    def test_pipe_operator(self):
        self.assertEqual(
            split_compound_command("cat /etc/passwd | grep root"),
            ["cat /etc/passwd", "grep root"],
        )

    def test_multiple_operators(self):
        result = split_compound_command("a && b; c || d | e")
        self.assertEqual(result, ["a", "b", "c", "d", "e"])

    def test_no_split_inside_single_quotes(self):
        cmd = "echo 'hello && world'"
        self.assertEqual(split_compound_command(cmd), [cmd])

    def test_no_split_inside_double_quotes(self):
        cmd = 'echo "hello && world"'
        self.assertEqual(split_compound_command(cmd), [cmd])

    def test_no_split_inside_backticks(self):
        cmd = "echo `echo a && echo b`"
        self.assertEqual(split_compound_command(cmd), [cmd])

    def test_strips_whitespace_from_segments(self):
        self.assertEqual(
            split_compound_command("  git status  &&  rm -rf /tmp  "),
            ["git status", "rm -rf /tmp"],
        )

    def test_empty_command_returns_empty(self):
        self.assertEqual(split_compound_command(""), [])

    def test_or_or_not_confused_with_pipe(self):
        # "||" must produce two segments, not three
        result = split_compound_command("cmd1 || cmd2")
        self.assertEqual(result, ["cmd1", "cmd2"])

    def test_backslash_escape_not_split(self):
        # "echo hello\; world" — the ; is escaped, should not split
        cmd = r"echo hello\; world"
        result = split_compound_command(cmd)
        self.assertEqual(len(result), 1)

    def test_chained_three_commands(self):
        result = split_compound_command("git add . && git commit -m 'x' && git push --force origin")
        self.assertEqual(result, ["git add .", "git commit -m 'x'", "git push --force origin"])


# ---------------------------------------------------------------------------
# _normalise_segment
# ---------------------------------------------------------------------------

class TestNormaliseSegment(unittest.TestCase):

    def test_plain_command_unchanged(self):
        self.assertEqual(_normalise_segment("rm -rf /"), "rm -rf /")

    def test_strips_env_prefix(self):
        self.assertEqual(_normalise_segment("FOO=bar rm -rf /"), "rm -rf /")

    def test_strips_multiple_env_prefixes(self):
        self.assertEqual(_normalise_segment("A=1 B=2 rm -rf /"), "rm -rf /")

    def test_no_prefix_to_strip(self):
        self.assertEqual(_normalise_segment("git status"), "git status")


# ---------------------------------------------------------------------------
# segment_matches_deny
# ---------------------------------------------------------------------------

class TestSegmentMatchesDeny(unittest.TestCase):

    DENY = [
        "rm -rf /",
        "rm -rf /*",
        "rm -rf ~",
        "rm -rf ~/*",
        "git push --force *",
        "git reset --hard *",
        "dd if=*",
        "mkfs *",
    ]

    def test_exact_match(self):
        self.assertIsNotNone(segment_matches_deny("rm -rf /", self.DENY))

    def test_glob_wildcard_matches_suffix(self):
        self.assertIsNotNone(segment_matches_deny("rm -rf /home/user", self.DENY))
        self.assertIsNotNone(segment_matches_deny("rm -rf /tmp", self.DENY))

    def test_glob_tilde_matches(self):
        self.assertIsNotNone(segment_matches_deny("rm -rf ~/Documents", self.DENY))

    def test_dd_glob(self):
        self.assertIsNotNone(segment_matches_deny("dd if=/dev/zero of=/dev/sda", self.DENY))

    def test_safe_command_not_matched(self):
        self.assertIsNone(segment_matches_deny("git status", self.DENY))
        self.assertIsNone(segment_matches_deny("ls -la", self.DENY))
        self.assertIsNone(segment_matches_deny("echo hello", self.DENY))

    def test_env_prefix_bypass_blocked(self):
        # "X=1 rm -rf /" should still be caught after normalisation
        self.assertIsNotNone(segment_matches_deny("X=1 rm -rf /", self.DENY))

    def test_no_deny_rules_returns_none(self):
        self.assertIsNone(segment_matches_deny("rm -rf /", []))

    def test_git_push_force_exact(self):
        self.assertIsNotNone(segment_matches_deny("git push --force origin main", self.DENY))

    def test_git_push_safe(self):
        # "git push" without --force should NOT match "git push --force *"
        self.assertIsNone(segment_matches_deny("git push origin main", self.DENY))

    def test_prefix_match_without_glob(self):
        # "rm -rf /" (no glob) should match "rm -rf / " or "rm -rf /" itself
        self.assertIsNotNone(segment_matches_deny("rm -rf /", self.DENY))


# ---------------------------------------------------------------------------
# Integration: the core bypass scenario from issue #36637
# ---------------------------------------------------------------------------

class TestBypassScenario(unittest.TestCase):
    """
    Reproduce the exact bypass described in issue #36637:

        A compound command like "git status && rm -rf /important/dir"
        would previously bypass deny rules because the matcher saw
        "git status" as the command prefix (matching an allow rule),
        without ever checking the "rm -rf /important/dir" segment.

    With bash-guard:
        split_compound_command() extracts both segments.
        The "rm -rf /important/dir" segment is checked against deny rules
        and matched, so the whole command is blocked.
    """

    DENY = [
        "rm -rf /",
        "rm -rf /*",
    ]

    def test_bypass_compound_and_and(self):
        cmd = "git status && rm -rf /important/dir"
        segments = split_compound_command(cmd)
        self.assertEqual(len(segments), 2)
        # First segment is safe
        self.assertIsNone(segment_matches_deny(segments[0], self.DENY))
        # Second segment is denied
        self.assertIsNotNone(segment_matches_deny(segments[1], self.DENY))

    def test_bypass_compound_semicolon(self):
        cmd = "echo hello; rm -rf /home/user"
        segments = split_compound_command(cmd)
        denied = [s for s in segments if segment_matches_deny(s, self.DENY)]
        self.assertEqual(len(denied), 1)
        self.assertIn("rm -rf /home/user", denied)

    def test_bypass_compound_or_or(self):
        cmd = "false || rm -rf ~"
        segments = split_compound_command(cmd)
        # The deny rule "rm -rf ~" should match
        deny_with_tilde = ["rm -rf ~", "rm -rf ~/*"]
        denied = [s for s in segments if segment_matches_deny(s, deny_with_tilde)]
        self.assertGreater(len(denied), 0)

    def test_safe_compound_not_blocked(self):
        cmd = "git fetch origin && git status"
        segments = split_compound_command(cmd)
        denied = [s for s in segments if segment_matches_deny(s, self.DENY)]
        self.assertEqual(len(denied), 0)

    def test_three_segment_middle_denied(self):
        cmd = "git status && rm -rf /tmp && echo done"
        segments = split_compound_command(cmd)
        denied = [s for s in segments if segment_matches_deny(s, self.DENY)]
        self.assertEqual(len(denied), 1)

    def test_piped_command_with_deny_segment(self):
        # "cat /etc/passwd | dd if=/dev/urandom of=/dev/sda"  — contrived but
        # the dd segment should be caught
        deny = ["dd if=*"]
        cmd = "cat /etc/passwd | dd if=/dev/urandom of=/dev/sda"
        segments = split_compound_command(cmd)
        denied = [s for s in segments if segment_matches_deny(s, deny)]
        self.assertGreater(len(denied), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
