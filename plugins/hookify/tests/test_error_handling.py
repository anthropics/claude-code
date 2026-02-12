"""Tests for error handling and fault tolerance in hookify.

Tests cover:
- Graceful handling of missing files
- Invalid JSON/YAML handling
- Regex compilation errors
- Transcript file access errors
- Import failures
- Edge cases and boundary conditions
"""

import pytest
import os
from pathlib import Path
from typing import Dict, Any
from unittest.mock import patch, mock_open

from hookify.core.config_loader import load_rules, load_rule_file, extract_frontmatter
from hookify.core.rule_engine import RuleEngine, compile_regex


class TestTranscriptFileErrors:
    """Tests for handling transcript file access errors."""

    def test_missing_transcript_file(self, rule_engine: RuleEngine, temp_project_dir):
        """Test handling when transcript file doesn't exist."""
        stop_input = {
            "hook_event_name": "Stop",
            "reason": "Done",
            "transcript_path": "/nonexistent/transcript.txt",
        }

        rules = [
            _make_rule(
                name="check-transcript",
                event="stop",
                conditions=[{"field": "transcript", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test message"
            ),
        ]

        # Should not crash, transcript returns empty string
        result = rule_engine.evaluate_rules(rules, stop_input)
        # Rule shouldn't match since transcript is empty
        assert result == {}

    def test_unreadable_transcript_file(self, rule_engine: RuleEngine, temp_project_dir):
        """Test handling when transcript file is unreadable."""
        # Create file and remove read permissions
        transcript_file = temp_project_dir / "unreadable.txt"
        transcript_file.write_text("content")
        os.chmod(transcript_file, 0o000)

        stop_input = {
            "hook_event_name": "Stop",
            "reason": "Done",
            "transcript_path": str(transcript_file),
        }

        rules = [
            _make_rule(
                name="check-transcript",
                event="stop",
                conditions=[{"field": "transcript", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        try:
            # Should not crash
            result = rule_engine.evaluate_rules(rules, stop_input)
            assert result == {}  # No match since transcript couldn't be read
        finally:
            # Restore permissions for cleanup
            os.chmod(transcript_file, 0o644)


class TestRegexErrors:
    """Tests for regex compilation and matching errors."""

    def test_invalid_regex_pattern(self, rule_engine: RuleEngine):
        """Test handling of invalid regex patterns."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "ls -la"}
        }

        rules = [
            _make_rule(
                name="invalid-regex",
                event="bash",
                conditions=[{"field": "command", "operator": "regex_match", "pattern": "[unclosed"}],
                action="block",
                message="Should not match"
            ),
        ]

        # Should not crash, invalid regex returns False (no match)
        result = rule_engine.evaluate_rules(rules, input_data)
        assert result == {}

    def test_catastrophic_backtracking_regex(self, rule_engine: RuleEngine):
        """Test handling of potentially slow regex patterns."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "a" * 100}
        }

        # This pattern could cause catastrophic backtracking in some engines
        # Python's re module handles this reasonably well
        rules = [
            _make_rule(
                name="complex-regex",
                event="bash",
                conditions=[{"field": "command", "operator": "regex_match", "pattern": "(a+)+$"}],
                action="warn",
                message="Matched"
            ),
        ]

        # Should complete without hanging
        result = rule_engine.evaluate_rules(rules, input_data)
        assert "Matched" in result.get("systemMessage", "")

    def test_regex_cache(self):
        """Test that regex patterns are cached."""
        pattern = r"test\s+pattern"

        # Compile same pattern twice
        regex1 = compile_regex(pattern)
        regex2 = compile_regex(pattern)

        # Should be the same object due to caching
        assert regex1 is regex2


class TestMalformedInput:
    """Tests for handling malformed input data."""

    def test_missing_tool_name(self, rule_engine: RuleEngine):
        """Test handling input without tool_name."""
        input_data = {
            "hook_event_name": "PreToolUse",
            # Missing tool_name
            "tool_input": {"command": "test"}
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        # Should not crash
        result = rule_engine.evaluate_rules(rules, input_data)
        # May or may not match depending on implementation

    def test_missing_tool_input(self, rule_engine: RuleEngine):
        """Test handling input without tool_input."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            # Missing tool_input
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        # Should not crash
        result = rule_engine.evaluate_rules(rules, input_data)
        assert result == {}  # No match with missing input

    def test_null_values_in_input(self, rule_engine: RuleEngine):
        """Test handling None values in tool_input."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {
                "command": None
            }
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        # Should not crash
        result = rule_engine.evaluate_rules(rules, input_data)

    def test_non_string_field_values(self, rule_engine: RuleEngine):
        """Test handling non-string values that get converted."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {
                "command": 123  # Number instead of string
            }
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "123"}],
                action="warn",
                message="Found number"
            ),
        ]

        result = rule_engine.evaluate_rules(rules, input_data)
        # Should convert to string and match
        assert "Found number" in result.get("systemMessage", "")


class TestRuleFileErrors:
    """Tests for rule file loading errors."""

    def test_malformed_yaml(self, create_rule_file):
        """Test handling of malformed YAML in frontmatter."""
        content = """---
name: test
enabled: [unclosed bracket
---
message
"""
        rule_file = create_rule_file("malformed", content)
        rule = load_rule_file(str(rule_file))

        # Should handle gracefully (may return None or partial data)
        # The custom YAML parser is lenient

    def test_unicode_errors(self, temp_project_dir):
        """Test handling of files with invalid unicode."""
        rule_file = temp_project_dir / ".claude" / "hookify.unicode.local.md"

        # Write binary content that's not valid UTF-8
        with open(rule_file, 'wb') as f:
            f.write(b"---\nname: test\n---\n\xff\xfe invalid unicode")

        rule = load_rule_file(str(rule_file))
        assert rule is None  # Should return None for encoding errors

    def test_empty_file(self, create_rule_file):
        """Test handling of empty rule file."""
        rule_file = create_rule_file("empty", "")
        rule = load_rule_file(str(rule_file))

        assert rule is None


class TestFieldExtractionErrors:
    """Tests for field extraction edge cases."""

    def test_unknown_field_name(self, rule_engine: RuleEngine):
        """Test handling of unknown field names."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "test"}
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "nonexistent_field", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        # Should not crash, unknown field returns None -> no match
        result = rule_engine.evaluate_rules(rules, input_data)
        assert result == {}

    def test_multiedit_with_empty_edits(self, rule_engine: RuleEngine):
        """Test MultiEdit tool with empty edits array."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "MultiEdit",
            "tool_input": {
                "file_path": "/test/file.py",
                "edits": []  # Empty edits
            }
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="file",
                conditions=[{"field": "new_text", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        # Should not crash
        result = rule_engine.evaluate_rules(rules, input_data)
        assert result == {}

    def test_multiedit_with_malformed_edits(self, rule_engine: RuleEngine):
        """Test MultiEdit tool with malformed edit entries."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "MultiEdit",
            "tool_input": {
                "file_path": "/test/file.py",
                "edits": [
                    {"invalid": "entry"},  # Missing new_string
                    None,  # Null entry
                    "not a dict"  # Wrong type
                ]
            }
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="file",
                conditions=[{"field": "new_text", "operator": "contains", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        # Should handle gracefully
        result = rule_engine.evaluate_rules(rules, input_data)


class TestOperatorEdgeCases:
    """Tests for operator edge cases."""

    def test_unknown_operator(self, rule_engine: RuleEngine):
        """Test handling of unknown operator."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "test"}
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "command", "operator": "unknown_op", "pattern": "test"}],
                action="warn",
                message="Test"
            ),
        ]

        # Unknown operator returns False -> no match
        result = rule_engine.evaluate_rules(rules, input_data)
        assert result == {}

    def test_empty_pattern(self, rule_engine: RuleEngine):
        """Test handling of empty pattern."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "test"}
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": ""}],
                action="warn",
                message="Empty pattern"
            ),
        ]

        result = rule_engine.evaluate_rules(rules, input_data)
        # Empty string is contained in any string
        assert "Empty pattern" in result.get("systemMessage", "")

    def test_special_characters_in_pattern(self, rule_engine: RuleEngine):
        """Test patterns with special regex characters when using 'contains'."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "echo $HOME"}
        }

        rules = [
            _make_rule(
                name="test-rule",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "$HOME"}],
                action="warn",
                message="Found $HOME"
            ),
        ]

        result = rule_engine.evaluate_rules(rules, input_data)
        # 'contains' does literal string matching, not regex
        assert "Found $HOME" in result.get("systemMessage", "")


class TestConcurrentRuleEvaluation:
    """Tests for multiple rules with various states."""

    def test_mixed_match_states(self, rule_engine: RuleEngine):
        """Test evaluation with mix of matching and non-matching rules."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "ls -la"}
        }

        rules = [
            _make_rule(
                name="match-ls",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "ls"}],
                action="warn",
                message="Found ls"
            ),
            _make_rule(
                name="no-match-rm",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "rm"}],
                action="block",
                message="Found rm"
            ),
            _make_rule(
                name="match-dash",
                event="bash",
                conditions=[{"field": "command", "operator": "contains", "pattern": "-"}],
                action="warn",
                message="Found dash"
            ),
        ]

        result = rule_engine.evaluate_rules(rules, input_data)

        # Should have warnings from matching rules
        assert "Found ls" in result.get("systemMessage", "")
        assert "Found dash" in result.get("systemMessage", "")
        # Should not have blocking (rm rule didn't match)
        assert "hookSpecificOutput" not in result

    def test_empty_rules_list(self, rule_engine: RuleEngine):
        """Test evaluation with empty rules list."""
        input_data = {
            "hook_event_name": "PreToolUse",
            "tool_name": "Bash",
            "tool_input": {"command": "ls"}
        }

        result = rule_engine.evaluate_rules([], input_data)
        assert result == {}


# Helper function to create rules for tests
def _make_rule(name, event, conditions, action="warn", message="Test", enabled=True, tool_matcher=None):
    """Helper to create Rule objects."""
    from hookify.core.config_loader import Rule, Condition

    cond_objects = [
        Condition(
            field=c.get("field", ""),
            operator=c.get("operator", "regex_match"),
            pattern=c.get("pattern", "")
        )
        for c in conditions
    ]
    return Rule(
        name=name,
        enabled=enabled,
        event=event,
        conditions=cond_objects,
        action=action,
        message=message,
        tool_matcher=tool_matcher
    )
