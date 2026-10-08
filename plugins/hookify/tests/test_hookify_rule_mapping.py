#!/usr/bin/env python3
"""Regression tests for Hookify simple event-pattern mappings."""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from hookify.core.config_loader import Rule
from hookify.core.rule_engine import RuleEngine


class HookifyRuleMappingTests(unittest.TestCase):
    """Covers simple pattern event mappings and regression behavior."""

    def setUp(self) -> None:
        self.engine = RuleEngine()

    def test_simple_bash_pattern_maps_to_command_and_matches(self) -> None:
        rule = Rule.from_dict(
            {"name": "warn-dangerous-rm", "enabled": True, "event": "bash", "pattern": r"rm\s+-rf"},
            "Dangerous command detected.",
        )

        self.assertEqual(rule.conditions[0].field, "command")
        result = self.engine.evaluate_rules(
            [rule],
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": "rm -rf /tmp/test"},
            },
        )

        self.assertIn("systemMessage", result)

    def test_simple_file_pattern_maps_to_new_text_and_matches(self) -> None:
        rule = Rule.from_dict(
            {"name": "warn-console-log", "enabled": True, "event": "file", "pattern": r"console\.log\("},
            "Console logging detected.",
        )

        self.assertEqual(rule.conditions[0].field, "new_text")
        result = self.engine.evaluate_rules(
            [rule],
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Edit",
                "tool_input": {
                    "file_path": "src/app.ts",
                    "old_string": "",
                    "new_string": "console.log('debug')",
                },
            },
        )

        self.assertIn("systemMessage", result)

    def test_simple_stop_pattern_maps_to_reason_and_matches(self) -> None:
        rule = Rule.from_dict(
            {"name": "require-verification", "enabled": True, "event": "stop", "pattern": "done"},
            "Verify before stopping.",
        )

        self.assertEqual(rule.conditions[0].field, "reason")
        result = self.engine.evaluate_rules(
            [rule],
            {"hook_event_name": "Stop", "reason": "done"},
        )

        self.assertIn("systemMessage", result)

    def test_simple_prompt_pattern_maps_to_user_prompt_and_matches(self) -> None:
        rule = Rule.from_dict(
            {"name": "warn-deploy", "enabled": True, "event": "prompt", "pattern": "deploy"},
            "Deployment prompt detected.",
        )

        self.assertEqual(rule.conditions[0].field, "user_prompt")
        result = self.engine.evaluate_rules(
            [rule],
            {"hook_event_name": "UserPromptSubmit", "user_prompt": "please deploy to production"},
        )

        self.assertIn("systemMessage", result)

    def test_simple_stop_pattern_non_match_returns_empty(self) -> None:
        rule = Rule.from_dict(
            {"name": "require-verification", "enabled": True, "event": "stop", "pattern": "done"},
            "Verify before stopping.",
        )

        result = self.engine.evaluate_rules(
            [rule],
            {"hook_event_name": "Stop", "reason": "still working"},
        )

        self.assertEqual(result, {})

    def test_simple_prompt_pattern_non_match_returns_empty(self) -> None:
        rule = Rule.from_dict(
            {"name": "warn-deploy", "enabled": True, "event": "prompt", "pattern": "deploy"},
            "Deployment prompt detected.",
        )

        result = self.engine.evaluate_rules(
            [rule],
            {"hook_event_name": "UserPromptSubmit", "user_prompt": "please summarize the diff"},
        )

        self.assertEqual(result, {})

    def test_advanced_conditions_still_work_for_stop_rules(self) -> None:
        rule = Rule.from_dict(
            {
                "name": "require-tests-run",
                "enabled": True,
                "event": "stop",
                "conditions": [
                    {"field": "transcript", "operator": "contains", "pattern": "npm test"},
                ],
            },
            "Tests detected.",
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            transcript_path = Path(tmpdir) / "transcript.txt"
            transcript_path.write_text("npm test\nall green\n", encoding="utf-8")

            result = self.engine.evaluate_rules(
                [rule],
                {"hook_event_name": "Stop", "transcript_path": str(transcript_path)},
            )

        self.assertIn("systemMessage", result)


if __name__ == "__main__":
    unittest.main()
