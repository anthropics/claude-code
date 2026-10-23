import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PLUGIN_ROOT.parent))

from hookify.core.config_loader import Condition, Rule  # noqa: E402
from hookify.core.rule_engine import RuleEngine  # noqa: E402


class HookifyEventFilteringTests(unittest.TestCase):
    def _run_hook(self, script_name: str, payload: dict, rules: dict[str, str]) -> dict:
        with tempfile.TemporaryDirectory() as temp_dir:
            claude_dir = Path(temp_dir) / ".claude"
            claude_dir.mkdir()

            for file_name, content in rules.items():
                (claude_dir / file_name).write_text(
                    textwrap.dedent(content).lstrip(),
                    encoding="utf-8",
                )

            env = os.environ.copy()
            env["CLAUDE_PLUGIN_ROOT"] = str(PLUGIN_ROOT)

            result = subprocess.run(
                [sys.executable, str(PLUGIN_ROOT / "hooks" / script_name)],
                cwd=temp_dir,
                input=json.dumps(payload),
                text=True,
                capture_output=True,
                env=env,
                check=True,
            )

            return json.loads(result.stdout.strip() or "{}")

    def test_reason_field_is_unavailable_outside_stop_events(self):
        rule = Rule(
            name="all-reason-check",
            enabled=True,
            event="all",
            conditions=[
                Condition(
                    field="reason",
                    operator="not_contains",
                    pattern="NEVER_MATCHES",
                )
            ],
            action="block",
            message="should not trigger",
        )

        result = RuleEngine().evaluate_rules(
            [rule],
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "README.md"},
            },
        )

        self.assertEqual(result, {})

    def test_unmapped_pre_post_tools_do_not_load_stop_rules(self):
        payload = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "README.md"},
        }
        stop_rule = {
            "hookify.stop.local.md": """
            ---
            name: stop-only
            enabled: true
            event: stop
            action: block
            conditions:
              - field: reason
                operator: not_contains
                pattern: NEVER_MATCHES
            ---

            Stop rules should not run here.
            """
        }

        for script_name in ("pretooluse.py", "posttooluse.py"):
            with self.subTest(script=script_name):
                hook_payload = payload.copy()
                hook_payload["hook_event_name"] = (
                    "PreToolUse" if script_name == "pretooluse.py" else "PostToolUse"
                )
                result = self._run_hook(script_name, hook_payload, stop_rule)
                self.assertEqual(result, {})

    def test_unmapped_pretooluse_tools_still_honor_all_rules(self):
        result = self._run_hook(
            "pretooluse.py",
            {
                "hook_event_name": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "README.md"},
            },
            {
                "hookify.all.local.md": """
                ---
                name: all-read-guard
                enabled: true
                event: all
                action: warn
                conditions:
                  - field: file_path
                    operator: regex_match
                    pattern: README\\.md
                ---

                All-event rules should still run for unmapped tools.
                """
            },
        )

        self.assertEqual(
            result,
            {
                "systemMessage": (
                    "**[all-read-guard]**\n"
                    "All-event rules should still run for unmapped tools."
                )
            },
        )


if __name__ == "__main__":
    unittest.main()
