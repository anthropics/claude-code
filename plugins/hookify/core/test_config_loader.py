import pytest
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
