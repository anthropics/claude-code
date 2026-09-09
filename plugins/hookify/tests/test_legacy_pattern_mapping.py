#!/usr/bin/env python3
"""Regression tests for hookify legacy `pattern:` field mapping."""

import sys
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT.parent))

from hookify.core.config_loader import Rule
from hookify.core.rule_engine import RuleEngine


class LegacyPatternMappingTest(unittest.TestCase):
    def test_prompt_pattern_matches_user_prompt_submit_payload(self):
        rule = Rule.from_dict(
            {
                "name": "catch prompt keyword",
                "event": "prompt",
                "pattern": "deploy",
            },
            "Prompt rule fired",
        )

        engine = RuleEngine()
        result = engine.evaluate_rules(
            [rule],
            {
                "hook_event_name": "UserPromptSubmit",
                "user_prompt": "please deploy the preview",
            },
        )

        self.assertIn("Prompt rule fired", result["systemMessage"])

    def test_explicit_prompt_condition_still_matches_user_prompt(self):
        rule = Rule.from_dict(
            {
                "name": "explicit prompt condition",
                "event": "prompt",
                "conditions": [
                    {
                        "field": "user_prompt",
                        "operator": "contains",
                        "pattern": "deploy",
                    }
                ],
            },
            "Explicit condition fired",
        )

        engine = RuleEngine()
        result = engine.evaluate_rules(
            [rule],
            {
                "hook_event_name": "UserPromptSubmit",
                "user_prompt": "please deploy the preview",
            },
        )

        self.assertIn("Explicit condition fired", result["systemMessage"])


if __name__ == "__main__":
    unittest.main()
