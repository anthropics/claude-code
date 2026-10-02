#!/usr/bin/env python3
"""Regression tests for Hookify warning context output."""

import sys
import unittest
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT.parent))

from hookify.core.config_loader import Condition, Rule
from hookify.core.rule_engine import RuleEngine


class WarningContextTest(unittest.TestCase):
    def test_warning_adds_context_without_auto_approving_pre_tool_use(self):
        rule = Rule(
            name="warn-publish",
            enabled=True,
            event="bash",
            conditions=[
                Condition(field="command", operator="contains", pattern="npm publish")
            ],
            action="warn",
            message="Publishing packages requires release approval.",
        )

        result = RuleEngine().evaluate_rules(
            [rule],
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": "npm publish"},
            },
        )

        self.assertIn("Publishing packages", result["systemMessage"])
        self.assertEqual(
            result["systemMessage"],
            result["hookSpecificOutput"]["additionalContext"],
        )
        self.assertEqual("PreToolUse", result["hookSpecificOutput"]["hookEventName"])
        self.assertNotIn("permissionDecision", result["hookSpecificOutput"])

    def test_warning_adds_context_for_user_prompt_submit(self):
        rule = Rule(
            name="warn-prod",
            enabled=True,
            event="prompt",
            conditions=[
                Condition(field="prompt", operator="contains", pattern="production")
            ],
            action="warn",
            message="Production changes need extra care.",
        )

        result = RuleEngine().evaluate_rules(
            [rule],
            {
                "hook_event_name": "UserPromptSubmit",
                "prompt": "deploy this to production",
            },
        )

        self.assertIn("Production changes", result["systemMessage"])
        self.assertEqual(
            result["systemMessage"],
            result["hookSpecificOutput"]["additionalContext"],
        )
        self.assertEqual("UserPromptSubmit", result["hookSpecificOutput"]["hookEventName"])

    def test_warning_omits_context_for_stop_events(self):
        rule = Rule(
            name="warn-stop",
            enabled=True,
            event="stop",
            conditions=[Condition(field="reason", operator="equals", pattern="done")],
            action="warn",
            message="Stop warning.",
        )

        result = RuleEngine().evaluate_rules(
            [rule],
            {
                "hook_event_name": "Stop",
                "reason": "done",
            },
        )

        self.assertEqual("**[warn-stop]**\nStop warning.", result["systemMessage"])
        self.assertNotIn("hookSpecificOutput", result)


if __name__ == "__main__":
    unittest.main()
