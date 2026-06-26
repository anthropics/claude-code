#!/usr/bin/env python3

import os
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from hookify.core.config_loader import Rule, extract_frontmatter, load_rules  # noqa: E402


def rule_for_enabled(value):
    frontmatter, message = extract_frontmatter(
        f"---\n"
        f"name: r\n"
        f"enabled: {value}\n"
        f"event: bash\n"
        f"pattern: rm -rf\n"
        f"---\n"
        f"msg\n"
    )
    return frontmatter, Rule.from_dict(frontmatter, message)


class ConfigLoaderEnabledTest(unittest.TestCase):
    def test_disabled_boolean_spellings_parse_false(self):
        disabled_values = [
            "no", "No", "NO",
            "false", "False", "FALSE",
            "off", "Off", "OFF",
            "0",
        ]

        for value in disabled_values:
            with self.subTest(value=value):
                frontmatter, rule = rule_for_enabled(value)

                self.assertIs(frontmatter["enabled"], False)
                self.assertIs(rule.enabled, False)

    def test_enabled_boolean_spellings_parse_true(self):
        enabled_values = [
            "yes", "Yes", "YES",
            "true", "True", "TRUE",
            "on", "On", "ON",
            "1",
        ]

        for value in enabled_values:
            with self.subTest(value=value):
                frontmatter, rule = rule_for_enabled(value)

                self.assertIs(frontmatter["enabled"], True)
                self.assertIs(rule.enabled, True)

    def test_inline_comment_is_ignored_for_enabled(self):
        frontmatter, rule = rule_for_enabled("no # disabled for now")

        self.assertIs(frontmatter["enabled"], False)
        self.assertIs(rule.enabled, False)

    def test_invalid_enabled_value_is_rejected(self):
        with self.assertRaises(ValueError):
            rule_for_enabled("maybe")

    def test_load_rules_omits_enabled_no_rule(self):
        previous_cwd = os.getcwd()
        with tempfile.TemporaryDirectory() as temp_dir:
            rule_dir = Path(temp_dir) / ".claude"
            rule_dir.mkdir()
            (rule_dir / "hookify.disabled.local.md").write_text(
                "---\n"
                "name: disabled\n"
                "enabled: no\n"
                "event: bash\n"
                "pattern: rm -rf\n"
                "---\n"
                "msg\n"
            )

            try:
                os.chdir(temp_dir)
                self.assertEqual(load_rules(event="bash"), [])
            finally:
                os.chdir(previous_cwd)


if __name__ == "__main__":
    unittest.main()
