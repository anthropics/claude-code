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
