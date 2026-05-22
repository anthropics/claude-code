"""Unit tests for security_reminder_hook.

Run with: python3 -m unittest plugins/security-guidance/hooks/test_security_reminder_hook.py
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from security_reminder_hook import (  # noqa: E402
    _exclude_covers_all_matches,
    check_patterns,
)


class ExcludeCoverageTests(unittest.TestCase):
    def test_no_excludes_returns_false(self):
        self.assertFalse(_exclude_covers_all_matches("eval(x)", "eval(", []))

    def test_single_match_inside_exclude(self):
        self.assertTrue(
            _exclude_covers_all_matches(
                "ast.literal_eval(s)", "eval(", ["ast.literal_eval("]
            )
        )

    def test_match_outside_exclude_returns_false(self):
        self.assertFalse(
            _exclude_covers_all_matches(
                "ast.literal_eval(s); eval(bad)", "eval(", ["ast.literal_eval("]
            )
        )

    def test_multiple_matches_all_covered(self):
        content = "a = ast.literal_eval(x)\nb = ast.literal_eval(y)"
        self.assertTrue(
            _exclude_covers_all_matches(content, "eval(", ["ast.literal_eval("])
        )

    def test_no_trigger_returns_true(self):
        # No occurrences of substring at all → vacuously covered.
        self.assertTrue(_exclude_covers_all_matches("nothing here", "eval(", ["foo"]))


class EvalInjectionRuleTests(unittest.TestCase):
    def test_ast_literal_eval_not_flagged(self):
        rule, _ = check_patterns("script.py", "value = ast.literal_eval(raw)\n")
        self.assertIsNone(rule)

    def test_bare_literal_eval_not_flagged(self):
        rule, _ = check_patterns(
            "script.py", "from ast import literal_eval\nx = literal_eval(s)\n"
        )
        self.assertIsNone(rule)

    def test_real_eval_still_flagged(self):
        rule, _ = check_patterns("script.py", "result = eval(user_input)\n")
        self.assertEqual(rule, "eval_injection")

    def test_real_eval_alongside_literal_eval_still_flagged(self):
        content = "safe = ast.literal_eval(a)\nbad = eval(b)\n"
        rule, _ = check_patterns("script.py", content)
        self.assertEqual(rule, "eval_injection")


class ChildProcessExecRuleTests(unittest.TestCase):
    def test_db_exec_not_flagged(self):
        rule, _ = check_patterns(
            "db.ts", "db.exec(schema);\nstmt.exec(params);\n"
        )
        self.assertIsNone(rule)

    def test_child_process_exec_still_flagged(self):
        rule, _ = check_patterns(
            "runner.js",
            "const { exec } = require('child_process');\nchild_process.exec(cmd);\n",
        )
        self.assertEqual(rule, "child_process_exec")

    def test_exec_in_markdown_code_fence_not_flagged(self):
        content = "Example: `exec(query)` runs the prepared statement.\n"
        rule, _ = check_patterns("README.md", content)
        self.assertIsNone(rule)

    def test_execsync_still_flagged(self):
        rule, _ = check_patterns(
            "script.js", "const out = execSync('ls');\n"
        )
        self.assertEqual(rule, "child_process_exec")

    def test_regex_dot_exec_not_flagged(self):
        rule, _ = check_patterns(
            "parse.js", "const m = re.exec(/^foo/);\n"
        )
        self.assertIsNone(rule)


class NewFunctionRuleTests(unittest.TestCase):
    def test_new_functionality_not_flagged(self):
        rule, _ = check_patterns(
            "notes.md", "We added new Functionality for users.\n"
        )
        self.assertIsNone(rule)

    def test_new_function_constructor_still_flagged(self):
        rule, _ = check_patterns(
            "evil.js", "const f = new Function('return ' + userCode);\n"
        )
        self.assertEqual(rule, "new_function_injection")


class PickleRuleTests(unittest.TestCase):
    def test_pickled_identifier_not_flagged(self):
        rule, _ = check_patterns(
            "data.py", "pickled = True\nreturn pickled\n"
        )
        self.assertIsNone(rule)

    def test_pickle_load_still_flagged(self):
        rule, _ = check_patterns(
            "loader.py", "import pickle\nobj = pickle.load(f)\n"
        )
        self.assertEqual(rule, "pickle_deserialization")

    def test_pickle_dump_alone_not_flagged(self):
        rule, _ = check_patterns(
            "saver.py", "import pickle\npickle.dump(obj, f)\n"
        )
        self.assertIsNone(rule)


class PathBasedRuleTests(unittest.TestCase):
    def test_github_workflow_path_flagged(self):
        rule, _ = check_patterns(
            ".github/workflows/ci.yml", "name: CI\non: push\n"
        )
        self.assertEqual(rule, "github_actions_workflow")

    def test_non_workflow_yml_not_flagged(self):
        rule, _ = check_patterns("config.yml", "name: CI\non: push\n")
        self.assertIsNone(rule)


class UnchangedRulesTests(unittest.TestCase):
    def test_dangerously_set_inner_html_still_flagged(self):
        rule, _ = check_patterns(
            "App.tsx", "<div dangerouslySetInnerHTML={{__html: x}} />\n"
        )
        self.assertEqual(rule, "react_dangerously_set_html")

    def test_document_write_still_flagged(self):
        rule, _ = check_patterns("page.js", "document.write('hi');\n")
        self.assertEqual(rule, "document_write_xss")

    def test_inner_html_still_flagged(self):
        rule, _ = check_patterns("page.js", "el.innerHTML = userInput;\n")
        self.assertEqual(rule, "innerHTML_xss")

    def test_os_system_still_flagged(self):
        rule, _ = check_patterns(
            "deploy.py", "import os\nos.system('rm -rf /')\n"
        )
        self.assertEqual(rule, "os_system_injection")


if __name__ == "__main__":
    unittest.main()
