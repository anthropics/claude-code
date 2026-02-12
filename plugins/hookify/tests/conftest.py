"""Pytest fixtures for hookify integration tests."""

import os
import sys
import json
import tempfile
import shutil
from pathlib import Path
from typing import Generator, Dict, Any, List

import pytest

# Add parent directories to path for imports
PLUGIN_ROOT = Path(__file__).parent.parent
PLUGINS_DIR = PLUGIN_ROOT.parent
sys.path.insert(0, str(PLUGINS_DIR))
sys.path.insert(0, str(PLUGIN_ROOT))

from hookify.core.config_loader import Rule, Condition, load_rules, extract_frontmatter
from hookify.core.rule_engine import RuleEngine


@pytest.fixture
def rule_engine() -> RuleEngine:
    """Create a RuleEngine instance."""
    return RuleEngine()


@pytest.fixture
def temp_project_dir() -> Generator[Path, None, None]:
    """Create a temporary project directory with .claude folder.

    This fixture creates a clean temp directory and changes to it,
    then restores the original directory after the test.
    """
    original_dir = os.getcwd()
    temp_dir = tempfile.mkdtemp(prefix="hookify_test_")

    # Create .claude directory for rule files
    claude_dir = Path(temp_dir) / ".claude"
    claude_dir.mkdir()

    os.chdir(temp_dir)

    yield Path(temp_dir)

    os.chdir(original_dir)
    shutil.rmtree(temp_dir)


@pytest.fixture
def sample_rule_file(temp_project_dir: Path) -> Path:
    """Create a sample rule file for testing."""
    rule_content = """---
name: block-rm-rf
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: rm\\s+-rf
---

**Dangerous command blocked!**

The `rm -rf` command can permanently delete files. Please use safer alternatives.
"""
    rule_file = temp_project_dir / ".claude" / "hookify.dangerous-commands.local.md"
    rule_file.write_text(rule_content)
    return rule_file


@pytest.fixture
def create_rule_file(temp_project_dir: Path):
    """Factory fixture to create rule files with custom content."""
    def _create(name: str, content: str) -> Path:
        rule_file = temp_project_dir / ".claude" / f"hookify.{name}.local.md"
        rule_file.write_text(content)
        return rule_file
    return _create


@pytest.fixture
def sample_bash_input() -> Dict[str, Any]:
    """Sample PreToolUse input for Bash tool."""
    return {
        "session_id": "test-session-123",
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_input": {
            "command": "ls -la"
        },
        "cwd": "/test/project"
    }


@pytest.fixture
def sample_write_input() -> Dict[str, Any]:
    """Sample PreToolUse input for Write tool."""
    return {
        "session_id": "test-session-123",
        "hook_event_name": "PreToolUse",
        "tool_name": "Write",
        "tool_input": {
            "file_path": "/test/project/src/main.py",
            "content": "print('hello world')"
        },
        "cwd": "/test/project"
    }


@pytest.fixture
def sample_edit_input() -> Dict[str, Any]:
    """Sample PreToolUse input for Edit tool."""
    return {
        "session_id": "test-session-123",
        "hook_event_name": "PreToolUse",
        "tool_name": "Edit",
        "tool_input": {
            "file_path": "/test/project/src/main.py",
            "old_string": "hello",
            "new_string": "goodbye"
        },
        "cwd": "/test/project"
    }


@pytest.fixture
def sample_multiedit_input() -> Dict[str, Any]:
    """Sample PreToolUse input for MultiEdit tool."""
    return {
        "session_id": "test-session-123",
        "hook_event_name": "PreToolUse",
        "tool_name": "MultiEdit",
        "tool_input": {
            "file_path": "/test/project/src/main.py",
            "edits": [
                {"old_string": "foo", "new_string": "bar"},
                {"old_string": "baz", "new_string": "qux"}
            ]
        },
        "cwd": "/test/project"
    }


@pytest.fixture
def sample_stop_input(temp_project_dir: Path) -> Dict[str, Any]:
    """Sample Stop event input with transcript file."""
    # Create a transcript file
    transcript_file = temp_project_dir / "transcript.txt"
    transcript_file.write_text("""
User: Please implement the feature
Assistant: I'll implement that feature now.
[Uses Write tool to create file]
User: Great, now run the tests
Assistant: Running tests...
[Uses Bash tool: npm test]
All tests passed!
""")

    return {
        "session_id": "test-session-123",
        "hook_event_name": "Stop",
        "reason": "Task completed",
        "transcript_path": str(transcript_file),
        "cwd": str(temp_project_dir)
    }


@pytest.fixture
def sample_userprompt_input() -> Dict[str, Any]:
    """Sample UserPromptSubmit event input."""
    return {
        "session_id": "test-session-123",
        "hook_event_name": "UserPromptSubmit",
        "user_prompt": "Please delete all files in the directory",
        "cwd": "/test/project"
    }


def make_rule(
    name: str,
    event: str,
    conditions: List[Dict[str, str]],
    action: str = "warn",
    message: str = "Test message",
    enabled: bool = True,
    tool_matcher: str = None
) -> Rule:
    """Helper function to create Rule objects for testing."""
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
