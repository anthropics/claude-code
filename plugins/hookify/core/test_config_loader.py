import pytest
import sys
import os

# Add plugins/ directory to path so we can import hookify
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from hookify.core.config_loader import extract_frontmatter

def test_missing_frontmatter():
    content = "Hello, world!\nThis is a test."
    fm, msg = extract_frontmatter(content)
    assert fm == {}
    assert msg == content

def test_simple_key_value():
    content = """---
name: test-rule
enabled: true
event: bash
---
Message body
"""
    fm, msg = extract_frontmatter(content)
    assert fm == {"name": "test-rule", "enabled": True, "event": "bash"}
    assert msg == "Message body"

def test_boolean_conversion():
    content = """---
is_true: true
is_false: false
is_True: True
is_False: False
is_string: "true"
---
Message
"""
    fm, msg = extract_frontmatter(content)
    assert fm["is_true"] is True
    assert fm["is_false"] is False
    assert fm["is_True"] is True
    assert fm["is_False"] is False
    assert fm["is_string"] is True

def test_list_items():
    content = """---
events:
  - bash
  - file
  - stop
---
Message
"""
    fm, msg = extract_frontmatter(content)
    assert fm == {"events": ["bash", "file", "stop"]}
    assert msg == "Message"

def test_inline_dict_in_list():
    content = """---
conditions:
  - field: command, operator: regex_match, pattern: rm -rf
  - field: command, operator: contains, pattern: sudo
---
Message
"""
    fm, msg = extract_frontmatter(content)
    assert fm == {
        "conditions": [
            {"field": "command", "operator": "regex_match", "pattern": "rm -rf"},
            {"field": "command", "operator": "contains", "pattern": "sudo"}
        ]
    }
    assert msg == "Message"

def test_multiline_dict_in_list():
    content = """---
conditions:
  - field: command
    operator: regex_match
    pattern: "rm -rf"
  - field: command
    operator: contains
    pattern: sudo
---
Message
"""
    fm, msg = extract_frontmatter(content)
    assert fm == {
        "conditions": [
            {"field": "command", "operator": "regex_match", "pattern": "rm -rf"},
            {"field": "command", "operator": "contains", "pattern": "sudo"}
        ]
    }
    assert msg == "Message"

def test_comments_and_blank_lines():
    content = """---
# This is a comment
name: test-rule

# Another comment
enabled: true
---
Message
"""
    fm, msg = extract_frontmatter(content)
    assert fm == {"name": "test-rule", "enabled": True}
    assert msg == "Message"

def test_complex_frontmatter():
    content = """---
name: require-tests
enabled: true
event: bash
conditions:
  - field: command
    operator: regex_match
    pattern: "git commit"
  - field: command
    operator: regex_match
    pattern: "-m"
action: warn
---
You are about to commit code!
Make sure you run the tests first!
"""
    fm, msg = extract_frontmatter(content)
    assert fm["name"] == "require-tests"
    assert fm["enabled"] is True
    assert fm["event"] == "bash"
    assert len(fm["conditions"]) == 2
    assert fm["conditions"][0] == {"field": "command", "operator": "regex_match", "pattern": "git commit"}
    assert fm["conditions"][1] == {"field": "command", "operator": "regex_match", "pattern": "-m"}
    assert fm["action"] == "warn"
    assert msg == "You are about to commit code!\nMake sure you run the tests first!"
import os
import sys
from unittest.mock import mock_open, patch

# Make sure we can import plugins.hookify...
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from plugins.hookify.core.config_loader import load_rule_file

def test_load_rule_file_success():
    """Test successful loading of a rule file."""
    content = """---
name: test_rule
enabled: true
event: bash
---

Test message"""
    with patch('builtins.open', mock_open(read_data=content)):
        rule = load_rule_file('dummy.md')
        assert rule is not None
        assert rule.name == 'test_rule'
        assert rule.enabled is True
        assert rule.event == 'bash'
        assert rule.message == 'Test message'

def test_load_rule_file_ioerror():
    """Test loading a rule file that doesn't exist."""
    with patch('builtins.open', side_effect=IOError("File not found")):
        rule = load_rule_file('nonexistent.md')
        assert rule is None

def test_load_rule_file_permission_error():
    """Test loading a rule file with permission error."""
    with patch('builtins.open', side_effect=PermissionError("Permission denied")):
        rule = load_rule_file('noperms.md')
        assert rule is None

def test_load_rule_file_oserror():
    """Test loading a rule file with generic OSError."""
    with patch('builtins.open', side_effect=OSError("Generic OS error")):
        rule = load_rule_file('oserror.md')
        assert rule is None

def test_load_rule_file_missing_frontmatter():
    """Test loading a rule file missing frontmatter."""
    content = "Just some text without frontmatter"
    with patch('builtins.open', mock_open(read_data=content)):
        rule = load_rule_file('no_frontmatter.md')
        assert rule is None

def test_load_rule_file_malformed_frontmatter():
    """Test loading a rule file with malformed frontmatter (ValueError from parser)."""
    # Force extract_frontmatter to raise ValueError
    with patch('builtins.open', mock_open(read_data="---\nfoo\n---")), \
         patch('plugins.hookify.core.config_loader.extract_frontmatter', side_effect=ValueError("Malformed")):
        rule = load_rule_file('malformed.md')
        assert rule is None

def test_load_rule_file_unicode_decode_error():
    """Test loading a rule file with invalid encoding."""
    with patch('builtins.open', mock_open()) as m_open:
        m_open.return_value.read.side_effect = UnicodeDecodeError('utf-8', b'\\x80', 0, 1, 'invalid start byte')
        rule = load_rule_file('bad_encoding.md')
        assert rule is None

def test_load_rule_file_unexpected_exception():
    """Test loading a rule file throwing an unexpected exception."""
    with patch('builtins.open', side_effect=Exception("Unexpected")):
        rule = load_rule_file('unexpected.md')
        assert rule is None
