"""Tests for rule loading and filtering from .local.md files.

Tests cover:
- Loading multiple rule files
- Event-based filtering
- YAML frontmatter parsing
- Legacy pattern to conditions conversion
"""

import pytest
from pathlib import Path

from hookify.core.config_loader import (
    Rule, Condition, load_rules, load_rule_file, extract_frontmatter
)


class TestExtractFrontmatter:
    """Tests for YAML frontmatter extraction."""

    def test_simple_frontmatter(self):
        """Test parsing simple key-value pairs."""
        content = """---
name: test-rule
enabled: true
event: bash
action: warn
---

Rule message here.
"""
        frontmatter, message = extract_frontmatter(content)

        assert frontmatter["name"] == "test-rule"
        assert frontmatter["enabled"] is True
        assert frontmatter["event"] == "bash"
        assert frontmatter["action"] == "warn"
        assert message == "Rule message here."

    def test_boolean_values(self):
        """Test boolean value parsing (true/false)."""
        content = """---
enabled: true
disabled: false
---
msg
"""
        frontmatter, _ = extract_frontmatter(content)

        assert frontmatter["enabled"] is True
        assert frontmatter["disabled"] is False

    def test_quoted_strings(self):
        """Test quoted string parsing."""
        content = """---
pattern: "rm -rf"
name: 'test-name'
---
msg
"""
        frontmatter, _ = extract_frontmatter(content)

        assert frontmatter["pattern"] == "rm -rf"
        assert frontmatter["name"] == "test-name"

    def test_conditions_list(self):
        """Test parsing conditions as list of dicts."""
        content = """---
name: test
conditions:
  - field: command
    operator: contains
    pattern: test
  - field: file_path
    operator: ends_with
    pattern: .py
---
msg
"""
        frontmatter, _ = extract_frontmatter(content)

        assert "conditions" in frontmatter
        assert len(frontmatter["conditions"]) == 2
        assert frontmatter["conditions"][0]["field"] == "command"
        assert frontmatter["conditions"][0]["operator"] == "contains"
        assert frontmatter["conditions"][1]["pattern"] == ".py"

    def test_inline_dict_conditions(self):
        """Test parsing inline comma-separated dict items."""
        content = """---
name: test
conditions:
  - field: command, operator: regex_match, pattern: test
---
msg
"""
        frontmatter, _ = extract_frontmatter(content)

        assert len(frontmatter["conditions"]) == 1
        assert frontmatter["conditions"][0]["field"] == "command"
        assert frontmatter["conditions"][0]["operator"] == "regex_match"

    def test_no_frontmatter(self):
        """Test handling content without frontmatter."""
        content = "Just plain text without frontmatter"
        frontmatter, message = extract_frontmatter(content)

        assert frontmatter == {}
        assert message == content

    def test_incomplete_frontmatter(self):
        """Test handling incomplete frontmatter markers."""
        content = """---
name: test
No closing marker
"""
        frontmatter, _ = extract_frontmatter(content)
        assert frontmatter == {}


class TestLoadRuleFile:
    """Tests for loading individual rule files."""

    def test_load_valid_rule(self, create_rule_file):
        """Test loading a valid rule file."""
        content = """---
name: valid-rule
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: contains
    pattern: danger
---

This is a dangerous command!
"""
        rule_file = create_rule_file("valid-rule", content)
        rule = load_rule_file(str(rule_file))

        assert rule is not None
        assert rule.name == "valid-rule"
        assert rule.enabled is True
        assert rule.event == "bash"
        assert rule.action == "block"
        assert len(rule.conditions) == 1
        assert rule.conditions[0].field == "command"
        assert "dangerous command" in rule.message

    def test_load_legacy_pattern_rule(self, create_rule_file):
        """Test loading rule with legacy pattern (converts to condition)."""
        content = """---
name: legacy-rule
enabled: true
event: bash
pattern: "rm -rf"
---

Old style rule.
"""
        rule_file = create_rule_file("legacy-rule", content)
        rule = load_rule_file(str(rule_file))

        assert rule is not None
        assert len(rule.conditions) == 1
        assert rule.conditions[0].field == "command"  # Inferred from bash event
        assert rule.conditions[0].operator == "regex_match"
        assert rule.conditions[0].pattern == "rm -rf"

    def test_load_file_event_legacy_pattern(self, create_rule_file):
        """Test legacy pattern with file event infers correct field."""
        content = """---
name: file-legacy
enabled: true
event: file
pattern: "TODO"
---

Found TODO.
"""
        rule_file = create_rule_file("file-legacy", content)
        rule = load_rule_file(str(rule_file))

        assert rule.conditions[0].field == "new_text"

    def test_load_missing_frontmatter(self, create_rule_file):
        """Test loading file without frontmatter returns None."""
        content = "No frontmatter here"
        rule_file = create_rule_file("no-frontmatter", content)
        rule = load_rule_file(str(rule_file))

        assert rule is None

    def test_load_nonexistent_file(self):
        """Test loading nonexistent file returns None."""
        rule = load_rule_file("/nonexistent/path/hookify.test.local.md")
        assert rule is None


class TestLoadRules:
    """Tests for loading multiple rules with filtering."""

    def test_load_multiple_rules(self, temp_project_dir, create_rule_file):
        """Test loading multiple rule files."""
        create_rule_file("rule1", """---
name: rule-one
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: test1
---
Rule 1
""")
        create_rule_file("rule2", """---
name: rule-two
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: test2
---
Rule 2
""")

        rules = load_rules()

        assert len(rules) == 2
        names = {r.name for r in rules}
        assert "rule-one" in names
        assert "rule-two" in names

    def test_filter_by_event(self, temp_project_dir, create_rule_file):
        """Test filtering rules by event type."""
        create_rule_file("bash-rule", """---
name: bash-rule
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: test
---
Bash rule
""")
        create_rule_file("file-rule", """---
name: file-rule
enabled: true
event: file
conditions:
  - field: content
    operator: contains
    pattern: test
---
File rule
""")
        create_rule_file("all-rule", """---
name: all-rule
enabled: true
event: all
conditions:
  - field: content
    operator: contains
    pattern: test
---
All events rule
""")

        # Filter for bash events
        bash_rules = load_rules(event="bash")
        bash_names = {r.name for r in bash_rules}
        assert "bash-rule" in bash_names
        assert "all-rule" in bash_names  # 'all' matches any event
        assert "file-rule" not in bash_names

        # Filter for file events
        file_rules = load_rules(event="file")
        file_names = {r.name for r in file_rules}
        assert "file-rule" in file_names
        assert "all-rule" in file_names
        assert "bash-rule" not in file_names

    def test_filter_excludes_disabled(self, temp_project_dir, create_rule_file):
        """Test that disabled rules are excluded."""
        create_rule_file("enabled-rule", """---
name: enabled-rule
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: test
---
Enabled
""")
        create_rule_file("disabled-rule", """---
name: disabled-rule
enabled: false
event: bash
conditions:
  - field: command
    operator: contains
    pattern: test
---
Disabled
""")

        rules = load_rules()

        assert len(rules) == 1
        assert rules[0].name == "enabled-rule"

    def test_load_rules_handles_invalid_file(self, temp_project_dir, create_rule_file):
        """Test that invalid files are skipped without crashing."""
        # Valid rule
        create_rule_file("valid", """---
name: valid
enabled: true
event: bash
conditions:
  - field: command
    operator: contains
    pattern: test
---
Valid rule
""")
        # Invalid rule (no frontmatter)
        create_rule_file("invalid", "No frontmatter")

        rules = load_rules()

        # Should only load the valid rule
        assert len(rules) == 1
        assert rules[0].name == "valid"

    def test_load_with_no_rules(self, temp_project_dir):
        """Test loading when no rule files exist."""
        rules = load_rules()
        assert rules == []


class TestRuleFromDict:
    """Tests for Rule.from_dict construction."""

    def test_defaults(self):
        """Test default values for optional fields."""
        frontmatter = {
            "name": "test",
            "event": "bash",
        }
        rule = Rule.from_dict(frontmatter, "message")

        assert rule.name == "test"
        assert rule.enabled is True  # Default
        assert rule.action == "warn"  # Default
        assert rule.message == "message"

    def test_explicit_values(self):
        """Test explicit values override defaults."""
        frontmatter = {
            "name": "test",
            "enabled": False,
            "event": "file",
            "action": "block",
            "tool_matcher": "Write|Edit",
        }
        rule = Rule.from_dict(frontmatter, "message")

        assert rule.enabled is False
        assert rule.event == "file"
        assert rule.action == "block"
        assert rule.tool_matcher == "Write|Edit"


class TestConditionFromDict:
    """Tests for Condition.from_dict construction."""

    def test_all_fields(self):
        """Test creating condition with all fields."""
        data = {
            "field": "command",
            "operator": "regex_match",
            "pattern": r"rm\s+-rf"
        }
        condition = Condition.from_dict(data)

        assert condition.field == "command"
        assert condition.operator == "regex_match"
        assert condition.pattern == r"rm\s+-rf"

    def test_default_operator(self):
        """Test default operator is regex_match."""
        data = {
            "field": "command",
            "pattern": "test"
        }
        condition = Condition.from_dict(data)

        assert condition.operator == "regex_match"

    def test_missing_fields(self):
        """Test missing fields default to empty strings."""
        data = {}
        condition = Condition.from_dict(data)

        assert condition.field == ""
        assert condition.pattern == ""
