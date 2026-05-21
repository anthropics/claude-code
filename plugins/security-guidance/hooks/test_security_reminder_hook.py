import importlib.util
import pathlib
import unittest


HOOK_PATH = pathlib.Path(__file__).with_name("security_reminder_hook.py")
SPEC = importlib.util.spec_from_file_location("security_reminder_hook", HOOK_PATH)
HOOK = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(HOOK)


class SecurityReminderHookPatternTests(unittest.TestCase):
    def test_doc_files_skip_exec_false_positive(self):
        rule_name, reminder = HOOK.check_patterns(
            "docs/sqlite-usage.md", "Use db.exec(schema) to initialize the database."
        )

        self.assertIsNone(rule_name)
        self.assertIsNone(reminder)

    def test_doc_files_skip_other_code_keyword_false_positives(self):
        rule_name, reminder = HOOK.check_patterns(
            "docs/rendering.mdx",
            "Use dangerouslySetInnerHTML only after sanitizing trusted HTML.",
        )

        self.assertIsNone(rule_name)
        self.assertIsNone(reminder)

    def test_source_files_still_trigger_exec_warning(self):
        rule_name, _ = HOOK.check_patterns(
            "src/runner.js", "const child = exec(userInput);"
        )

        self.assertEqual(rule_name, "child_process_exec")

    def test_path_based_workflow_warning_still_runs(self):
        rule_name, _ = HOOK.check_patterns(".github/workflows/ci.yml", "name: CI")

        self.assertEqual(rule_name, "github_actions_workflow")


if __name__ == "__main__":
    unittest.main()
