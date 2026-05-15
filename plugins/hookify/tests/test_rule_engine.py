#!/usr/bin/env python3
"""Tests for Hookify rule engine output shaping."""

import sys
import unittest
from pathlib import Path

PLUGIN_PARENT = Path(__file__).resolve().parents[2]
if str(PLUGIN_PARENT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_PARENT))

from hookify.core.config_loader import Condition, Rule
from hookify.core.rule_engine import RuleEngine


class RuleEngineWarningOutputTest(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def _bash_rule(self, action="warn"):
        return Rule(
            name="warn-rm",
            enabled=True,
            event="bash",
            conditions=[
                Condition(
                    field="command",
                    operator="regex_match",
                    pattern=r"rm\s+-rf"
                )
            ],
            action=action,
            message="Dangerous command detected"
        )

    def _bash_input(self, hook_event_name):
        return {
            "hook_event_name": hook_event_name,
            "tool_name": "Bash",
            "tool_input": {
                "command": "rm -rf /tmp/example"
            }
        }

    def test_pre_tool_use_warning_includes_hook_specific_output(self):
        result = self.engine.evaluate_rules(
            [self._bash_rule()],
            self._bash_input("PreToolUse")
        )

        hook_output = result["hookSpecificOutput"]
        self.assertEqual("PreToolUse", hook_output["hookEventName"])
        self.assertEqual("allow", hook_output["permissionDecision"])
        self.assertEqual(result["systemMessage"], hook_output["additionalContext"])
        self.assertIn("Dangerous command detected", hook_output["additionalContext"])

    def test_post_tool_use_warning_includes_additional_context(self):
        result = self.engine.evaluate_rules(
            [self._bash_rule()],
            self._bash_input("PostToolUse")
        )

        hook_output = result["hookSpecificOutput"]
        self.assertEqual("PostToolUse", hook_output["hookEventName"])
        self.assertNotIn("permissionDecision", hook_output)
        self.assertEqual(result["systemMessage"], hook_output["additionalContext"])
        self.assertIn("Dangerous command detected", hook_output["additionalContext"])

    def test_non_tool_warning_keeps_system_message_only(self):
        rule = Rule(
            name="prompt-warning",
            enabled=True,
            event="all",
            conditions=[
                Condition(
                    field="user_prompt",
                    operator="contains",
                    pattern="deploy"
                )
            ],
            action="warn",
            message="Review deployment steps first"
        )

        result = self.engine.evaluate_rules(
            [rule],
            {
                "hook_event_name": "UserPromptSubmit",
                "tool_name": "",
                "tool_input": {},
                "user_prompt": "deploy this app"
            }
        )

        self.assertEqual(
            {"systemMessage": "**[prompt-warning]**\nReview deployment steps first"},
            result
        )

    def test_pre_tool_use_block_still_denies_tool_call(self):
        result = self.engine.evaluate_rules(
            [self._bash_rule(action="block")],
            self._bash_input("PreToolUse")
        )

        hook_output = result["hookSpecificOutput"]
        self.assertEqual("PreToolUse", hook_output["hookEventName"])
        self.assertEqual("deny", hook_output["permissionDecision"])
        self.assertIn("Dangerous command detected", result["systemMessage"])


if __name__ == "__main__":
    unittest.main()
