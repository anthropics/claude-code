"""Regression tests for simple hookify rule field inference."""

import sys
from pathlib import Path
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from hookify.core.config_loader import Rule
from hookify.core.rule_engine import RuleEngine


class SimpleRuleFieldInferenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def test_file_pattern_matches_write_content(self):
        rule = Rule.from_dict(
            {"name": "warn-console-log", "event": "file", "pattern": r"console\.log\("},
            "Console logging detected.",
        )

        result = self.engine.evaluate_rules(
            [rule],
            {"tool_name": "Write", "tool_input": {"content": "console.log('debug')"}},
        )

        self.assertIn("Console logging detected.", result["systemMessage"])

    def test_file_pattern_continues_to_match_edit_new_string(self):
        rule = Rule.from_dict(
            {"name": "warn-console-log", "event": "file", "pattern": r"console\.log\("},
            "Console logging detected.",
        )

        result = self.engine.evaluate_rules(
            [rule],
            {"tool_name": "Edit", "tool_input": {"new_string": "console.log('debug')"}},
        )

        self.assertIn("Console logging detected.", result["systemMessage"])

    def test_prompt_pattern_matches_current_hook_payload(self):
        rule = Rule.from_dict(
            {"name": "warn-deploy", "event": "prompt", "pattern": "deploy"},
            "Deployment requested.",
        )

        result = self.engine.evaluate_rules(
            [rule],
            {"hook_event_name": "UserPromptSubmit", "prompt": "Please deploy this service."},
        )

        self.assertIn("Deployment requested.", result["systemMessage"])

    def test_legacy_prompt_field_matches_current_hook_payload(self):
        rule = Rule.from_dict(
            {
                "name": "warn-deploy",
                "event": "prompt",
                "conditions": [
                    {"field": "user_prompt", "operator": "contains", "pattern": "deploy"}
                ],
            },
            "Deployment requested.",
        )

        result = self.engine.evaluate_rules(
            [rule],
            {"hook_event_name": "UserPromptSubmit", "prompt": "Please deploy this service."},
        )

        self.assertIn("Deployment requested.", result["systemMessage"])


if __name__ == "__main__":
    unittest.main()
