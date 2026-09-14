
#!/usr/bin/env python3
import sys
import os
import unittest
import json
from dataclasses import dataclass

# Dynamic path resolution to make this script cross-platform
# We need to add the 'plugins' directory to sys.path
# This script is in plugins/hookify/tests/test_core.py
current_dir = os.path.dirname(os.path.abspath(__file__))
# Go up 2 levels: tests -> hookify -> plugins
plugins_dir = os.path.abspath(os.path.join(current_dir, '../../'))

if plugins_dir not in sys.path:
    sys.path.insert(0, plugins_dir)

# Now we can import reliably
from hookify.core.rule_engine import RuleEngine
from hookify.core.config_loader import Condition, Rule

class TestHookifyEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RuleEngine()

    def test_glob_match_insensitive(self):
        """Test default glob matching (case insensitive)."""
        rule = Rule(
            name="glob-test",
            enabled=True,
            event="all",
            conditions=[
                Condition(field="file_path", operator="glob_match", pattern="*.secret.js", case_sensitive=False)
            ]
        )
        
        # Should match despite mixed case in input
        input_data = {"tool_name": "Write", "tool_input": {"file_path": "/src/API.Secret.js"}}
        result = self.engine.evaluate_rules([rule], input_data)
        self.assertTrue(result, "Glob sensitive=False should match mixed case input")

    def test_glob_match_sensitive(self):
        """Test case-sensitive glob matching."""
        rule = Rule(
            name="glob-test-sensitive",
            enabled=True,
            event="all",
            conditions=[
                Condition(field="file_path", operator="glob_match", pattern="*.secret.js", case_sensitive=True)
            ]
        )
        
        # Mismatch case
        input_data_mismatch = {"tool_name": "Write", "tool_input": {"file_path": "/src/API.Secret.js"}}
        result_mismatch = self.engine.evaluate_rules([rule], input_data_mismatch)
        self.assertFalse(result_mismatch, "Glob sensitive=True should NOT match mixed case input")

        # Match case
        input_data_match = {"tool_name": "Write", "tool_input": {"file_path": "/src/api.secret.js"}}
        result_match = self.engine.evaluate_rules([rule], input_data_match)
        self.assertTrue(result_match, "Glob sensitive=True should match exact case input")

    def test_regex_match_sensitive(self):
        """Test case-sensitive regex matching."""
        rule_sensitive = Rule(
            name="regex-test-sensitive",
            enabled=True,
            event="all",
            conditions=[
                Condition(field="command", operator="regex_match", pattern="error", case_sensitive=True)
            ]
        )
        
        # "ERROR" != "error"
        input_data = {"tool_name": "Bash", "tool_input": {"command": "echo ERROR"}}
        result = self.engine.evaluate_rules([rule_sensitive], input_data)
        self.assertFalse(result, "Regex sensitive=True should differentiate case")

    def test_string_equals_sensitive(self):
        """Test case-sensitive exact equality."""
        rule = Rule(
            name="equals-test",
            enabled=True,
            event="all",
            conditions=[
                Condition(field="command", operator="equals", pattern="production", case_sensitive=True)
            ]
        )
        
        input_data = {"tool_name": "Bash", "tool_input": {"command": "PRODUCTION"}}
        result = self.engine.evaluate_rules([rule], input_data)
        self.assertFalse(result, "Equals sensitive=True should NOT match different case")

if __name__ == '__main__':
    unittest.main()
