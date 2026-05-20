import sys
import unittest
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
PLUGIN_PARENT = PLUGIN_ROOT.parent
if str(PLUGIN_PARENT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_PARENT))

from hookify.core.config_loader import Condition, Rule, normalize_action
from hookify.core.rule_engine import RuleEngine


def make_rule(*, name: str, action: str, pattern: str = r"systemctl\s+restart") -> Rule:
    return Rule(
        name=name,
        enabled=True,
        event="bash",
        conditions=[
            Condition(
                field="command",
                operator="regex_match",
                pattern=pattern,
            )
        ],
        action=action,
        message=f"{name} triggered",
    )


class RuleEngineAskActionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = RuleEngine()
        self.input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "systemctl restart nginx"},
        }

    def test_pretooluse_ask_returns_permission_prompt(self) -> None:
        result = self.engine.evaluate_rules([make_rule(name="confirm-systemctl", action="ask")], self.input_data)

        self.assertEqual(
            result,
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "ask",
                },
                "systemMessage": "**[confirm-systemctl]**\nconfirm-systemctl triggered",
            },
        )

    def test_block_still_overrides_ask(self) -> None:
        result = self.engine.evaluate_rules(
            [
                make_rule(name="confirm-systemctl", action="ask"),
                make_rule(name="block-systemctl", action="block"),
            ],
            self.input_data,
        )

        self.assertEqual(
            result,
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                },
                "systemMessage": "**[block-systemctl]**\nblock-systemctl triggered",
            },
        )

    def test_ask_falls_back_to_warning_for_non_pretool_events(self) -> None:
        result = self.engine.evaluate_rules(
            [make_rule(name="confirm-systemctl", action="ask")],
            {
                "hook_event_name": "PostToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": "systemctl restart nginx"},
            },
        )

        self.assertEqual(
            result,
            {"systemMessage": "**[confirm-systemctl]**\nconfirm-systemctl triggered"},
        )

    def test_confirm_alias_normalizes_to_ask(self) -> None:
        self.assertEqual(normalize_action("confirm"), "ask")


if __name__ == "__main__":
    unittest.main()
