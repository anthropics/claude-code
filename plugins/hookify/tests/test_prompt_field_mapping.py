#!/usr/bin/env python3
"""Regression tests for Hookify UserPromptSubmit prompt field handling."""

import sys
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT.parent))

from hookify.core.config_loader import Rule
from hookify.core.rule_engine import RuleEngine


class PromptFieldMappingTest(unittest.TestCase):
    def test_legacy_prompt_pattern_matches_current_prompt_payload(self):
        rule = Rule.from_dict(
            {
                "name": "catch prompt keyword",
                "event": "prompt",
                "pattern": "deploy",
            },
            "Prompt rule fired",
        )

        result = RuleEngine().evaluate_rules(
            [rule],
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt": "please deploy the preview",
            },
        )

        self.assertIn("Prompt rule fired", result["systemMessage"])

    def test_user_prompt_alias_still_matches_prompt_payload(self):
        rule = Rule.from_dict(
            {
                "name": "explicit legacy prompt field",
                "event": "prompt",
                "conditions": [
                    {
                        "field": "user_prompt",
                        "operator": "contains",
                        "pattern": "deploy",
                    }
                ],
            },
            "Legacy alias fired",
        )

        result = RuleEngine().evaluate_rules(
            [rule],
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt": "please deploy the preview",
            },
        )

        self.assertIn("Legacy alias fired", result["systemMessage"])


if __name__ == "__main__":
    unittest.main()
