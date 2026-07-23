#!/usr/bin/env python3
"""Tests for the credential guard hook."""

import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOK_SCRIPT = os.path.join(
    os.path.dirname(__file__), "..", "hooks", "credential_guard.py"
)


def run_hook(tool_name, tool_input, session_id="test"):
    """Run the hook script with the given input and return (exit_code, stderr)."""
    input_data = json.dumps({
        "session_id": session_id,
        "tool_name": tool_name,
        "tool_input": tool_input,
    })
    result = subprocess.run(
        [sys.executable, HOOK_SCRIPT],
        input=input_data,
        capture_output=True,
        text=True,
        env={**os.environ, "CREDENTIAL_GUARD_DISABLED": "0"},
    )
    return result.returncode, result.stderr


class TestCredentialDetection(unittest.TestCase):
    """Test that known credential patterns are detected and blocked."""

    def _assert_blocked(self, tool_name, tool_input, pattern_label):
        code, stderr = run_hook(tool_name, tool_input, session_id=f"test-{id(self)}-{pattern_label}")
        self.assertEqual(code, 2, f"Expected block (exit 2) for {pattern_label}, got {code}.\nstderr: {stderr}")
        self.assertIn("CREDENTIAL GUARD", stderr)

    def _assert_allowed(self, tool_name, tool_input, description=""):
        code, stderr = run_hook(tool_name, tool_input, session_id=f"test-allow-{id(self)}-{description}")
        self.assertEqual(code, 0, f"Expected allow (exit 0) for {description}, got {code}.\nstderr: {stderr}")

    # ── GitHub ────────────────────────────────────────────────────────
    def test_github_pat(self):
        self._assert_blocked("Write", {
            "file_path": "config.ts",
            "content": 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl"',
        }, "github_pat")

    def test_github_fine_grained_pat(self):
        self._assert_blocked("Write", {
            "file_path": "config.ts",
            "content": 'const token = "github_pat_11AABBC_abcdefghijklmnopqrstuvwxyz0123456789"',
        }, "github_fine_grained_pat")

    def test_github_oauth(self):
        self._assert_blocked("Write", {
            "file_path": "auth.py",
            "content": 'TOKEN = "gho_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl"',
        }, "github_oauth")

    # ── AWS ───────────────────────────────────────────────────────────
    def test_aws_access_key(self):
        self._assert_blocked("Write", {
            "file_path": "config.py",
            "content": 'AWS_KEY = "AKIAIOSFODNN7EXAMPLE"',
        }, "aws_access_key")

    def test_aws_secret_key(self):
        self._assert_blocked("Write", {
            "file_path": "config.py",
            "content": 'aws_secret_access_key = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"',
        }, "aws_secret_key")

    # ── Anthropic ─────────────────────────────────────────────────────
    def test_anthropic_api_key(self):
        self._assert_blocked("Write", {
            "file_path": "app.py",
            "content": 'client = Anthropic(api_key="sk-ant-api03-abcdefghijklmnopqrstuvwxyz")',
        }, "anthropic_api_key")

    # ── OpenAI ────────────────────────────────────────────────────────
    def test_openai_project_key(self):
        self._assert_blocked("Write", {
            "file_path": "app.py",
            "content": 'OPENAI_KEY = "sk-proj-abcdefghijklmnopqrstuvwxyz1234"',
        }, "openai_api_key_proj")

    # ── Stripe ────────────────────────────────────────────────────────
    def test_stripe_secret_key(self):
        self._assert_blocked("Write", {
            "file_path": "billing.py",
            "content": 'stripe.api_key = "sk_test_FAKE00PLACEHOLDER00VALUE0"',
        }, "stripe_secret_key")

    # ── Slack ─────────────────────────────────────────────────────────
    def test_slack_token(self):
        self._assert_blocked("Write", {
            "file_path": "bot.py",
            "content": 'SLACK_TOKEN = "xoxb-1234567890-abcdefghij"',
        }, "slack_token")

    def test_slack_webhook(self):
        self._assert_blocked("Write", {
            "file_path": "notify.py",
            "content": 'WEBHOOK = "https://hooks.slack.com/services/T0000/B0000/xxxxxxxxxxxxx"',
        }, "slack_webhook")

    # ── Google ────────────────────────────────────────────────────────
    def test_google_api_key(self):
        self._assert_blocked("Write", {
            "file_path": "maps.js",
            "content": 'const key = "AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe"',
        }, "google_api_key")

    def test_gcp_service_account(self):
        self._assert_blocked("Write", {
            "file_path": "credentials.json",
            "content": '{"type": "service_account", "project_id": "my-project"}',
        }, "gcp_service_account")

    # ── SendGrid ──────────────────────────────────────────────────────
    def test_sendgrid_key(self):
        self._assert_blocked("Write", {
            "file_path": "email.py",
            "content": 'sg_key = "SG.abcdefghijklmnopqrstuv.wxyzABCDEFGHIJKLMNOPQRSTUV"',
        }, "sendgrid_key")

    # ── npm ───────────────────────────────────────────────────────────
    def test_npm_token(self):
        self._assert_blocked("Write", {
            "file_path": ".npmrc",
            "content": '//registry.npmjs.org/:_authToken=npm_abcdefghijklmnopqrstuvwxyz0123456789AB',
        }, "npm_token")

    # ── Private keys ──────────────────────────────────────────────────
    def test_private_key_rsa(self):
        self._assert_blocked("Write", {
            "file_path": "deploy.sh",
            "content": '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAK...',
        }, "private_key_rsa")

    def test_private_key_ec(self):
        self._assert_blocked("Write", {
            "file_path": "key.pem",
            "content": '-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE...',
        }, "private_key_ec")

    # ── Bearer / Basic auth ───────────────────────────────────────────
    def test_bearer_token(self):
        self._assert_blocked("Write", {
            "file_path": "api.py",
            "content": 'headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"}',
        }, "bearer_token")

    # ── Database URLs ─────────────────────────────────────────────────
    def test_postgres_url(self):
        self._assert_blocked("Write", {
            "file_path": "db.py",
            "content": 'DATABASE_URL = "postgres://admin:s3cretP4ss@db.example.com/mydb"',
        }, "postgres_url")

    def test_mongodb_url(self):
        self._assert_blocked("Write", {
            "file_path": "db.py",
            "content": 'MONGO_URI = "mongodb+srv://user:password123@cluster.mongodb.net/db"',
        }, "mongodb_url")

    # ── Generic secret assignment ─────────────────────────────────────
    def test_generic_secret(self):
        self._assert_blocked("Write", {
            "file_path": "config.py",
            "content": 'api_key = "abcdefghijklmnopqrstuvwxyz1234567890"',
        }, "generic_secret")


class TestToolTypes(unittest.TestCase):
    """Test that different tool types are handled correctly."""

    def test_edit_tool(self):
        code, stderr = run_hook("Edit", {
            "file_path": "config.ts",
            "new_string": 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl"',
        }, session_id="test-edit")
        self.assertEqual(code, 2)

    def test_multiedit_tool(self):
        code, stderr = run_hook("MultiEdit", {
            "file_path": "config.ts",
            "edits": [
                {"new_string": 'const a = "safe"'},
                {"new_string": 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl"'},
            ],
        }, session_id="test-multiedit")
        self.assertEqual(code, 2)

    def test_bash_redirect(self):
        code, stderr = run_hook("Bash", {
            "command": 'echo "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl" > config.txt',
        }, session_id="test-bash-redirect")
        self.assertEqual(code, 2)

    def test_bash_heredoc(self):
        code, stderr = run_hook("Bash", {
            "command": 'cat <<EOF > config.txt\ntoken=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl\nEOF',
        }, session_id="test-bash-heredoc")
        self.assertEqual(code, 2)

    def test_bash_no_redirect_allowed(self):
        code, _ = run_hook("Bash", {
            "command": "ls -la",
        }, session_id="test-bash-safe")
        self.assertEqual(code, 0)


class TestSafePaths(unittest.TestCase):
    """Test that allowlisted paths are not scanned."""

    def test_env_example(self):
        code, _ = run_hook("Write", {
            "file_path": ".env.example",
            "content": 'GH_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl',
        }, session_id="test-safe-env")
        self.assertEqual(code, 0)

    def test_env_sample(self):
        code, _ = run_hook("Write", {
            "file_path": ".env.sample",
            "content": 'API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
        }, session_id="test-safe-sample")
        self.assertEqual(code, 0)

    def test_fixture_dir(self):
        code, _ = run_hook("Write", {
            "file_path": "tests/fixtures/api_response.json",
            "content": '{"token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl"}',
        }, session_id="test-safe-fixture")
        self.assertEqual(code, 0)

    def test_test_mock(self):
        code, _ = run_hook("Write", {
            "file_path": "tests/mock_auth.py",
            "content": 'MOCK_TOKEN = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl"',
        }, session_id="test-safe-mock")
        self.assertEqual(code, 0)


class TestCleanContent(unittest.TestCase):
    """Test that clean content is allowed through."""

    def test_env_var_reference(self):
        code, _ = run_hook("Write", {
            "file_path": "config.ts",
            "content": 'const token = process.env.GITHUB_TOKEN',
        }, session_id="test-clean-env")
        self.assertEqual(code, 0)

    def test_placeholder(self):
        code, _ = run_hook("Write", {
            "file_path": "config.ts",
            "content": 'const token = "${GITHUB_TOKEN}"',
        }, session_id="test-clean-placeholder")
        self.assertEqual(code, 0)

    def test_short_string(self):
        code, _ = run_hook("Write", {
            "file_path": "config.ts",
            "content": 'const name = "hello world"',
        }, session_id="test-clean-short")
        self.assertEqual(code, 0)

    def test_empty_content(self):
        code, _ = run_hook("Write", {
            "file_path": "empty.txt",
            "content": "",
        }, session_id="test-clean-empty")
        self.assertEqual(code, 0)


class TestDisableFlag(unittest.TestCase):
    """Test that the plugin can be disabled."""

    def test_disabled(self):
        input_data = json.dumps({
            "session_id": "test-disabled",
            "tool_name": "Write",
            "tool_input": {
                "file_path": "config.ts",
                "content": 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl',
            },
        })
        result = subprocess.run(
            [sys.executable, HOOK_SCRIPT],
            input=input_data,
            capture_output=True,
            text=True,
            env={**os.environ, "CREDENTIAL_GUARD_DISABLED": "1"},
        )
        self.assertEqual(result.returncode, 0)


class TestRedaction(unittest.TestCase):
    """Test that matched values are redacted in output."""

    def test_token_is_redacted(self):
        code, stderr = run_hook("Write", {
            "file_path": "config.ts",
            "content": 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl',
        }, session_id="test-redact")
        self.assertEqual(code, 2)
        self.assertNotIn("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijkl", stderr)
        self.assertIn("ghp_", stderr)
        self.assertIn("***", stderr)


if __name__ == "__main__":
    # Clean up any test state files before running
    state_dir = os.path.expanduser("~/.claude")
    if os.path.exists(state_dir):
        for f in os.listdir(state_dir):
            if f.startswith("credential_guard_state_test"):
                os.remove(os.path.join(state_dir, f))

    unittest.main()
