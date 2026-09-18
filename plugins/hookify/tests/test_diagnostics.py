import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from hookify.core.diagnostics import diagnose_rule_files, test_rule_file


class HookifyDiagnosticsTests(unittest.TestCase):
    def test_doctor_reports_invalid_regex_and_duplicate_names(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            rules_dir = Path(tmpdir) / ".claude"
            rules_dir.mkdir()

            (rules_dir / "hookify.invalid.local.md").write_text(
                """---
name: duplicate-name
enabled: true
event: bash
pattern: (
action: warn
---

Invalid regex rule.
""",
                encoding="utf-8",
            )
            (rules_dir / "hookify.duplicate.local.md").write_text(
                """---
name: duplicate-name
enabled: true
event: bash
pattern: rm\\s+-rf
action: warn
---

Duplicate name rule.
""",
                encoding="utf-8",
            )

            reports = diagnose_rule_files(rules_dir)

            self.assertEqual(len(reports), 2)
            invalid_report = next(
                report for report in reports if report.path.name == "hookify.invalid.local.md"
            )
            duplicate_report = next(
                report
                for report in reports
                if report.path.name == "hookify.duplicate.local.md"
            )

            self.assertTrue(
                any(diagnostic.code == "invalid_regex" for diagnostic in invalid_report.diagnostics)
            )
            self.assertTrue(
                any(diagnostic.code == "duplicate_rule_name" for diagnostic in invalid_report.diagnostics)
            )
            self.assertTrue(
                any(diagnostic.code == "duplicate_rule_name" for diagnostic in duplicate_report.diagnostics)
            )

    def test_rule_test_matches_bash_rule(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            rule_path = Path(tmpdir) / "hookify.warn-rm.local.md"
            rule_path.write_text(
                """---
name: warn-dangerous-rm
enabled: true
event: bash
pattern: rm\\s+-rf
action: block
---

Dangerous command detected.
""",
                encoding="utf-8",
            )

            report = test_rule_file(rule_path, {"command": "rm -rf /tmp/test"})

            self.assertTrue(report.matched)
            self.assertEqual(report.rule.name, "warn-dangerous-rm")
            self.assertTrue(report.explanation["conditions"][0]["matched"])

    def test_rule_test_supports_inline_stop_transcript(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            rule_path = Path(tmpdir) / "hookify.require-tests.local.md"
            rule_path.write_text(
                """---
name: require-tests
enabled: true
event: stop
action: block
conditions:
  - field: transcript
    operator: contains
    pattern: npm test
---

Tests must be run before stopping.
""",
                encoding="utf-8",
            )

            report = test_rule_file(rule_path, {"transcript": "build ok\\nnpm test\\nall green"})

            self.assertTrue(report.matched)
            self.assertEqual(report.explanation["conditions"][0]["field"], "transcript")
            self.assertEqual(report.explanation["conditions"][0]["value"], "build ok\\nnpm test\\nall green")


if __name__ == "__main__":
    unittest.main()
