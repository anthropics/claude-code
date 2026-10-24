"""Regression tests for documentation path filters on substring rules."""

import sys
import unittest
from pathlib import Path


HOOKS_DIR = Path(__file__).resolve().parents[1] / "hooks"
sys.path.insert(0, str(HOOKS_DIR))

from patterns import _DOC_EXTS  # noqa: E402
from security_reminder_hook import check_patterns  # noqa: E402


XSS_FAMILY_CASES = (
    ("new_function_injection", "const fn = new Function(body);", "app.js"),
    (
        "react_dangerously_set_html",
        "return <div dangerouslySetInnerHTML={{ __html: content }} />;",
        "Component.jsx",
    ),
    ("document_write_xss", "document.write(userInput);", "legacy.ts"),
    ("innerHTML_xss", "element.innerHTML = userInput;", "render.tsx"),
)


def matched_rule_names(path, content):
    return {rule_name for rule_name, _ in check_patterns(path, content)}


class DocumentationPathFilterTests(unittest.TestCase):
    def test_xss_family_rules_ignore_all_documentation_extensions(self):
        for rule_name, content, _ in XSS_FAMILY_CASES:
            for extension in _DOC_EXTS:
                with self.subTest(rule=rule_name, extension=extension):
                    matches = matched_rule_names(f"docs/security-guide{extension}", content)
                    self.assertNotIn(rule_name, matches)

    def test_xss_family_rules_still_match_executable_source(self):
        for rule_name, content, source_path in XSS_FAMILY_CASES:
            with self.subTest(rule=rule_name, path=source_path):
                self.assertIn(rule_name, matched_rule_names(source_path, content))

    def test_only_a_terminal_documentation_extension_is_filtered(self):
        for rule_name, content, _ in XSS_FAMILY_CASES:
            with self.subTest(rule=rule_name):
                self.assertNotIn(
                    rule_name, matched_rule_names("example.js.md", content)
                )
                self.assertIn(
                    rule_name, matched_rule_names("example.md.js", content)
                )

    def test_existing_eval_filter_remains_the_control(self):
        self.assertNotIn(
            "eval_injection", matched_rule_names("guide.md", "eval(input)")
        )
        self.assertIn(
            "eval_injection", matched_rule_names("app.js", "eval(input)")
        )


if __name__ == "__main__":
    unittest.main()
