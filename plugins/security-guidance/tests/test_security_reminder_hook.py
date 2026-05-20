#!/usr/bin/env python3
"""Unit tests for the security reminder hook."""

import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

# Add parent directory to path so we can import the hook module
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "..", "hooks")
)

import security_reminder_hook as hook


class TestCheckPatterns(unittest.TestCase):
    """Test check_patterns() for all 15 security patterns."""

    # --- Existing 9 patterns ---

    def test_github_actions_workflow_triggers(self):
        rule, reminder, severity = hook.check_patterns(
            ".github/workflows/ci.yml", ""
        )
        self.assertEqual(rule, "github_actions_workflow")
        self.assertEqual(severity, "block")

    def test_github_actions_workflow_yaml_extension(self):
        rule, _, severity = hook.check_patterns(
            ".github/workflows/deploy.yaml", ""
        )
        self.assertEqual(rule, "github_actions_workflow")
        self.assertEqual(severity, "block")

    def test_github_actions_workflow_no_trigger_on_other_yml(self):
        rule, _, _ = hook.check_patterns("config/settings.yml", "")
        self.assertIsNone(rule)

    def test_child_process_exec_triggers(self):
        rule, _, severity = hook.check_patterns(
            "app.js", "child_process.exec('ls')"
        )
        self.assertEqual(rule, "child_process_exec")
        self.assertEqual(severity, "warn")

    def test_child_process_execSync_triggers(self):
        rule, _, _ = hook.check_patterns("app.js", "execSync('ls')")
        self.assertEqual(rule, "child_process_exec")

    def test_new_function_injection_triggers(self):
        rule, _, severity = hook.check_patterns(
            "app.js", "const fn = new Function('return 1')"
        )
        self.assertEqual(rule, "new_function_injection")
        self.assertEqual(severity, "warn")

    def test_eval_injection_triggers(self):
        rule, _, severity = hook.check_patterns(
            "app.js", "eval(userInput)"
        )
        self.assertEqual(rule, "eval_injection")
        self.assertEqual(severity, "block")

    def test_react_dangerously_set_html_triggers(self):
        rule, _, severity = hook.check_patterns(
            "App.tsx", '<div dangerouslySetInnerHTML={{__html: content}} />'
        )
        self.assertEqual(rule, "react_dangerously_set_html")
        self.assertEqual(severity, "warn")

    def test_document_write_triggers(self):
        rule, _, severity = hook.check_patterns(
            "app.js", "document.write('<h1>hello</h1>')"
        )
        self.assertEqual(rule, "document_write_xss")
        self.assertEqual(severity, "warn")

    def test_innerHTML_triggers(self):
        rule, _, severity = hook.check_patterns(
            "app.js", "el.innerHTML = userContent"
        )
        self.assertEqual(rule, "innerHTML_xss")
        self.assertEqual(severity, "warn")

    def test_innerHTML_no_space_triggers(self):
        rule, _, _ = hook.check_patterns(
            "app.js", "el.innerHTML=userContent"
        )
        self.assertEqual(rule, "innerHTML_xss")

    def test_pickle_triggers(self):
        rule, _, severity = hook.check_patterns(
            "app.py", "import pickle"
        )
        self.assertEqual(rule, "pickle_deserialization")
        self.assertEqual(severity, "warn")

    def test_os_system_triggers(self):
        rule, _, severity = hook.check_patterns(
            "app.py", "os.system('rm -rf /')"
        )
        self.assertEqual(rule, "os_system_injection")
        self.assertEqual(severity, "warn")

    def test_os_system_import_triggers(self):
        rule, _, _ = hook.check_patterns(
            "app.py", "from os import system"
        )
        self.assertEqual(rule, "os_system_injection")

    # --- New 6 patterns ---

    # sql_injection (block)
    def test_sql_injection_concat_double_quote(self):
        rule, _, severity = hook.check_patterns(
            "db.py", 'query = "SELECT " + user_input'
        )
        self.assertEqual(rule, "sql_injection")
        self.assertEqual(severity, "block")

    def test_sql_injection_concat_single_quote(self):
        rule, _, severity = hook.check_patterns(
            "db.py", "query = 'SELECT ' + user_input"
        )
        self.assertEqual(rule, "sql_injection")
        self.assertEqual(severity, "block")

    def test_sql_injection_fstring_insert(self):
        rule, _, _ = hook.check_patterns(
            "db.py", 'f"INSERT INTO users VALUES ({name})"'
        )
        self.assertEqual(rule, "sql_injection")

    def test_sql_injection_fstring_update(self):
        rule, _, _ = hook.check_patterns(
            "db.py", "f'UPDATE users SET name = {name}'"
        )
        self.assertEqual(rule, "sql_injection")

    def test_sql_injection_fstring_delete(self):
        rule, _, _ = hook.check_patterns(
            "db.py", 'f"DELETE FROM users WHERE id = {uid}"'
        )
        self.assertEqual(rule, "sql_injection")

    def test_sql_injection_no_trigger_static_query(self):
        """Static SQL string without concatenation should not trigger."""
        rule, _, _ = hook.check_patterns(
            "db.py", 'query = "SELECT * FROM users"'
        )
        self.assertIsNone(rule)

    def test_sql_injection_no_trigger_parameterized(self):
        """Parameterized query should not trigger."""
        rule, _, _ = hook.check_patterns(
            "db.py", "cursor.execute('SELECT * FROM users WHERE id = ?', (uid,))"
        )
        self.assertIsNone(rule)

    # hardcoded_secrets (block)
    def test_hardcoded_aws_secret_key(self):
        rule, _, severity = hook.check_patterns(
            "config.py", 'AWS_SECRET_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"'
        )
        self.assertEqual(rule, "hardcoded_secrets")
        self.assertEqual(severity, "block")

    def test_hardcoded_api_key_snake_case(self):
        rule, _, _ = hook.check_patterns(
            "config.py", "api_key = 'sk-1234567890'"
        )
        self.assertEqual(rule, "hardcoded_secrets")

    def test_hardcoded_api_key_camel_case(self):
        rule, _, _ = hook.check_patterns(
            "config.js", 'const apiKey = "sk-1234567890"'
        )
        self.assertEqual(rule, "hardcoded_secrets")

    def test_hardcoded_password(self):
        rule, _, _ = hook.check_patterns(
            "config.py", "password = 'hunter2'"
        )
        self.assertEqual(rule, "hardcoded_secrets")

    def test_hardcoded_pem_key(self):
        rule, _, _ = hook.check_patterns(
            "cert.pem", "-----BEGIN RSA PRIVATE KEY-----"
        )
        self.assertEqual(rule, "hardcoded_secrets")

    def test_hardcoded_ec_key(self):
        rule, _, _ = hook.check_patterns(
            "key.pem", "-----BEGIN EC PRIVATE KEY-----"
        )
        self.assertEqual(rule, "hardcoded_secrets")

    def test_hardcoded_secrets_no_trigger_env_var(self):
        """Using environment variables should not trigger."""
        rule, _, _ = hook.check_patterns(
            "config.js", "const apiKey = process.env.API_KEY"
        )
        self.assertIsNone(rule)

    def test_hardcoded_secrets_no_trigger_env_python(self):
        """Python os.environ should not trigger."""
        rule, _, _ = hook.check_patterns(
            "config.py", "api_key = os.environ['API_KEY']"
        )
        self.assertIsNone(rule)

    # path_traversal (warn)
    def test_path_traversal_join_req(self):
        rule, _, severity = hook.check_patterns(
            "server.js", "const fp = path.join(req.params.file)"
        )
        self.assertEqual(rule, "path_traversal")
        self.assertEqual(severity, "warn")

    def test_path_traversal_readFile_request(self):
        rule, _, _ = hook.check_patterns(
            "server.js", "fs.readFile(request.query.path)"
        )
        self.assertEqual(rule, "path_traversal")

    def test_path_traversal_createReadStream(self):
        rule, _, _ = hook.check_patterns(
            "server.js", "fs.createReadStream(req.body.filename)"
        )
        self.assertEqual(rule, "path_traversal")

    def test_path_traversal_no_trigger_relative_import(self):
        """Relative imports with ../ should not trigger path_traversal."""
        rule, _, _ = hook.check_patterns(
            "app.js", "import { x } from '../../utils'"
        )
        self.assertIsNone(rule)

    def test_path_traversal_no_trigger_static_path(self):
        """Static path.join without request input should not trigger."""
        rule, _, _ = hook.check_patterns(
            "app.js", "const p = path.join(__dirname, 'public', 'index.html')"
        )
        self.assertIsNone(rule)

    # insecure_deserialization (warn)
    def test_insecure_deserialization_yaml_load(self):
        rule, _, severity = hook.check_patterns(
            "app.py", "data = yaml.load(user_input)"
        )
        self.assertEqual(rule, "insecure_deserialization")
        self.assertEqual(severity, "warn")

    def test_insecure_deserialization_yaml_unsafe_load(self):
        rule, _, _ = hook.check_patterns(
            "app.py", "data = yaml.unsafe_load(content)"
        )
        self.assertEqual(rule, "insecure_deserialization")

    def test_insecure_deserialization_node_serialize(self):
        rule, _, _ = hook.check_patterns(
            "app.js", "const serialize = require('node-serialize')"
        )
        self.assertEqual(rule, "insecure_deserialization")

    def test_insecure_deserialization_java_readObject(self):
        rule, _, _ = hook.check_patterns(
            "App.java", "Object obj = ois.readObject()"
        )
        self.assertEqual(rule, "insecure_deserialization")

    def test_insecure_deserialization_ObjectInputStream(self):
        rule, _, _ = hook.check_patterns(
            "App.java", "ObjectInputStream ois = new ObjectInputStream(in)"
        )
        self.assertEqual(rule, "insecure_deserialization")

    # unsafe_deprecated_apis (warn)
    def test_unsafe_md5_single_quote(self):
        rule, _, severity = hook.check_patterns(
            "app.js", "crypto.createHash('md5')"
        )
        self.assertEqual(rule, "unsafe_deprecated_apis")
        self.assertEqual(severity, "warn")

    def test_unsafe_md5_double_quote(self):
        rule, _, _ = hook.check_patterns(
            "app.js", 'crypto.createHash("md5")'
        )
        self.assertEqual(rule, "unsafe_deprecated_apis")

    def test_unsafe_sha1(self):
        rule, _, _ = hook.check_patterns(
            "app.js", "crypto.createHash('sha1')"
        )
        self.assertEqual(rule, "unsafe_deprecated_apis")

    def test_unsafe_new_buffer(self):
        rule, _, _ = hook.check_patterns(
            "app.js", "const buf = new Buffer(input)"
        )
        self.assertEqual(rule, "unsafe_deprecated_apis")

    def test_unsafe_no_trigger_sha256(self):
        """SHA-256 should not trigger."""
        rule, _, _ = hook.check_patterns(
            "app.js", "crypto.createHash('sha256')"
        )
        self.assertIsNone(rule)

    def test_unsafe_no_trigger_buffer_from(self):
        """Buffer.from() should not trigger."""
        rule, _, _ = hook.check_patterns(
            "app.js", "const buf = Buffer.from(input)"
        )
        self.assertIsNone(rule)

    # --- General no-match ---

    def test_no_match_returns_none_tuple(self):
        rule, reminder, severity = hook.check_patterns(
            "app.js", "console.log('hello')"
        )
        self.assertIsNone(rule)
        self.assertIsNone(reminder)
        self.assertIsNone(severity)

    def test_empty_content_no_match(self):
        rule, _, _ = hook.check_patterns("app.js", "")
        self.assertIsNone(rule)

    def test_path_normalization(self):
        """Leading slashes should be stripped for path matching."""
        rule, _, _ = hook.check_patterns(
            "/.github/workflows/ci.yml", ""
        )
        self.assertEqual(rule, "github_actions_workflow")


class TestSeverityBehavior(unittest.TestCase):
    """Test that block/warn severity produces correct exit behavior."""

    def _make_hook_input(self, file_path, content):
        """Create a valid hook input JSON string."""
        return json.dumps({
            "session_id": "test-session-severity",
            "tool_name": "Write",
            "tool_input": {
                "file_path": file_path,
                "content": content,
            },
        })

    def _run_main_with_input(self, stdin_data):
        """Run main() with given stdin and capture output/exit code."""
        import io
        from contextlib import redirect_stdout, redirect_stderr

        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()

        with patch("sys.stdin", io.StringIO(stdin_data)):
            with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
                try:
                    hook.main()
                except SystemExit as e:
                    exit_code = e.code
                else:
                    exit_code = 0

        return exit_code, stdout_buf.getvalue(), stderr_buf.getvalue()

    def setUp(self):
        """Clear state file before each test."""
        state_file = hook.get_state_file("test-session-severity")
        if os.path.exists(state_file):
            os.remove(state_file)

    def tearDown(self):
        """Clean up state file after each test."""
        state_file = hook.get_state_file("test-session-severity")
        if os.path.exists(state_file):
            os.remove(state_file)

    def test_block_severity_exits_2_with_stderr(self):
        """Block patterns should exit with code 2 and output to stderr."""
        input_data = self._make_hook_input("app.js", "eval(userInput)")
        exit_code, stdout, stderr = self._run_main_with_input(input_data)

        self.assertEqual(exit_code, 2)
        self.assertIn("Security Warning", stderr)
        self.assertEqual(stdout, "")

    def test_warn_severity_exits_0_with_json_stdout(self):
        """Warn patterns should exit with code 0 and output JSON to stdout."""
        input_data = self._make_hook_input(
            "app.js", "el.innerHTML = content"
        )
        exit_code, stdout, stderr = self._run_main_with_input(input_data)

        self.assertEqual(exit_code, 0)
        self.assertEqual(stderr, "")
        result = json.loads(stdout)
        self.assertIn("systemMessage", result)
        self.assertTrue(result["suppressOutput"])

    def test_no_match_exits_0_no_output(self):
        """Non-matching content should exit 0 with no output."""
        input_data = self._make_hook_input(
            "app.js", "console.log('safe code')"
        )
        exit_code, stdout, stderr = self._run_main_with_input(input_data)

        self.assertEqual(exit_code, 0)
        self.assertEqual(stdout, "")
        self.assertEqual(stderr, "")


class TestStateManagement(unittest.TestCase):
    """Test session-scoped warning deduplication."""

    def setUp(self):
        self.session_id = "test-session-state"
        state_file = hook.get_state_file(self.session_id)
        if os.path.exists(state_file):
            os.remove(state_file)

    def tearDown(self):
        state_file = hook.get_state_file(self.session_id)
        if os.path.exists(state_file):
            os.remove(state_file)

    def test_load_empty_state(self):
        state = hook.load_state(self.session_id)
        self.assertEqual(state, set())

    def test_save_and_load_state(self):
        warnings = {"file.js-eval_injection", "app.py-pickle_deserialization"}
        hook.save_state(self.session_id, warnings)
        loaded = hook.load_state(self.session_id)
        self.assertEqual(loaded, warnings)

    def test_duplicate_warning_not_shown_twice(self):
        """Same file+rule combination should only trigger once per session."""
        import io
        from contextlib import redirect_stdout, redirect_stderr

        input_data = json.dumps({
            "session_id": self.session_id,
            "tool_name": "Write",
            "tool_input": {
                "file_path": "app.js",
                "content": "eval(code)",
            },
        })

        # First call: should block
        with patch("sys.stdin", io.StringIO(input_data)):
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                try:
                    hook.main()
                except SystemExit as e:
                    self.assertEqual(e.code, 2)

        # Second call with same file+rule: should pass through
        with patch("sys.stdin", io.StringIO(input_data)):
            stdout_buf = io.StringIO()
            stderr_buf = io.StringIO()
            with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
                try:
                    hook.main()
                except SystemExit as e:
                    self.assertEqual(e.code, 0)

            self.assertEqual(stdout_buf.getvalue(), "")
            self.assertEqual(stderr_buf.getvalue(), "")


class TestContentExtraction(unittest.TestCase):
    """Test extract_content_from_input for different tool types."""

    def test_write_tool(self):
        content = hook.extract_content_from_input(
            "Write", {"content": "eval(x)", "file_path": "a.js"}
        )
        self.assertEqual(content, "eval(x)")

    def test_edit_tool(self):
        content = hook.extract_content_from_input(
            "Edit", {"new_string": "eval(x)", "old_string": "safe()"}
        )
        self.assertEqual(content, "eval(x)")

    def test_multi_edit_tool(self):
        content = hook.extract_content_from_input(
            "MultiEdit",
            {
                "edits": [
                    {"new_string": "eval(x)"},
                    {"new_string": "os.system('ls')"},
                ]
            },
        )
        self.assertIn("eval(x)", content)
        self.assertIn("os.system('ls')", content)

    def test_unknown_tool(self):
        content = hook.extract_content_from_input("Bash", {"command": "ls"})
        self.assertEqual(content, "")

    def test_write_empty_content(self):
        content = hook.extract_content_from_input("Write", {})
        self.assertEqual(content, "")

    def test_multi_edit_empty_edits(self):
        content = hook.extract_content_from_input("MultiEdit", {"edits": []})
        self.assertEqual(content, "")


class TestFalsePositiveRegression(unittest.TestCase):
    """Regression tests for known false positive scenarios."""

    def test_relative_import_no_path_traversal(self):
        """Relative ES module imports should not trigger path_traversal."""
        rule, _, _ = hook.check_patterns(
            "app.js", "import { x } from '../../utils'"
        )
        self.assertIsNone(rule)

    def test_env_var_no_hardcoded_secret(self):
        """process.env access should not trigger hardcoded_secrets."""
        rule, _, _ = hook.check_patterns(
            "config.js", "const key = process.env.API_KEY"
        )
        self.assertIsNone(rule)

    def test_static_sql_no_injection(self):
        """Static SQL string without concatenation should not trigger."""
        rule, _, _ = hook.check_patterns(
            "db.py", 'const q = "SELECT * FROM users"'
        )
        self.assertIsNone(rule)

    def test_sha256_no_deprecated(self):
        """SHA-256 hash should not trigger unsafe_deprecated_apis."""
        rule, _, _ = hook.check_patterns(
            "app.js", "crypto.createHash('sha256').update(data)"
        )
        self.assertIsNone(rule)

    def test_buffer_from_no_deprecated(self):
        """Buffer.from() should not trigger unsafe_deprecated_apis."""
        rule, _, _ = hook.check_patterns(
            "app.js", "const buf = Buffer.from('hello', 'utf-8')"
        )
        self.assertIsNone(rule)

    def test_yaml_safe_load_no_trigger(self):
        """yaml.safe_load should NOT trigger insecure_deserialization.

        yaml.safe_load( does not contain the substring yaml.load(
        because the 'safe_' prefix breaks the match.
        """
        rule, _, _ = hook.check_patterns(
            "app.py", "data = yaml.safe_load(content)"
        )
        self.assertIsNone(rule)

    def test_disabled_hook_exits_immediately(self):
        """When ENABLE_SECURITY_REMINDER=0, hook should exit 0 immediately."""
        import io
        from contextlib import redirect_stdout, redirect_stderr

        input_data = json.dumps({
            "session_id": "test-disabled",
            "tool_name": "Write",
            "tool_input": {
                "file_path": "app.js",
                "content": "eval(malicious)",
            },
        })

        with patch.dict(os.environ, {"ENABLE_SECURITY_REMINDER": "0"}):
            with patch("sys.stdin", io.StringIO(input_data)):
                with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit) as cm:
                        hook.main()
                    self.assertEqual(cm.exception.code, 0)

    def test_non_file_tool_exits_immediately(self):
        """Non-file tools (Bash, etc.) should exit 0 immediately."""
        import io
        from contextlib import redirect_stdout, redirect_stderr

        input_data = json.dumps({
            "session_id": "test-nontool",
            "tool_name": "Bash",
            "tool_input": {"command": "eval 'echo hello'"},
        })

        with patch("sys.stdin", io.StringIO(input_data)):
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as cm:
                    hook.main()
                self.assertEqual(cm.exception.code, 0)


class TestAllPatternsSeverityDefined(unittest.TestCase):
    """Ensure all patterns have a valid severity field."""

    def test_all_patterns_have_severity(self):
        for pattern in hook.SECURITY_PATTERNS:
            self.assertIn(
                "severity",
                pattern,
                f"Pattern '{pattern['ruleName']}' missing severity field",
            )
            self.assertIn(
                pattern["severity"],
                ("block", "warn"),
                f"Pattern '{pattern['ruleName']}' has invalid severity: {pattern['severity']}",
            )

    def test_pattern_count(self):
        """Verify we have exactly 14 patterns."""
        self.assertEqual(len(hook.SECURITY_PATTERNS), 14)


if __name__ == "__main__":
    unittest.main()
