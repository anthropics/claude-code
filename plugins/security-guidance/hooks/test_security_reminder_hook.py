import sys
import os
import pytest

# Add the hooks directory to sys.path to import the hook script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from security_reminder_hook import check_patterns

def test_check_patterns_path_check():
    """Test path matching logic."""
    rule_name, reminder = check_patterns(".github/workflows/deploy.yml", "")
    assert rule_name == "github_actions_workflow"
    assert "Command Injection" in reminder

def test_check_patterns_path_check_normalized():
    """Test path normalization logic (removing leading slashes)."""
    rule_name, reminder = check_patterns("/.github/workflows/test.yaml", "")
    assert rule_name == "github_actions_workflow"

def test_check_patterns_substring_check():
    """Test content matching logic with a known bad substring."""
    rule_name, reminder = check_patterns("src/utils.js", "child_process.exec('ls')")
    assert rule_name == "child_process_exec"
    assert "Security Warning" in reminder

def test_check_patterns_multiple_substrings():
    """Test matching for various rules based on their substrings."""
    rule_name, reminder = check_patterns("src/utils.js", "execSync('ls')")
    assert rule_name == "child_process_exec"

    rule_name, reminder = check_patterns("app.js", "new Function('x', 'return x')")
    assert rule_name == "new_function_injection"

    rule_name, reminder = check_patterns("app.js", "eval('console.log(1)')")
    assert rule_name == "eval_injection"

    rule_name, reminder = check_patterns("app.py", "import pickle\npickle.loads(data)")
    assert rule_name == "pickle_deserialization"

def test_check_patterns_no_match():
    """Test when both path and content are safe."""
    rule_name, reminder = check_patterns("src/main.js", "console.log('Hello world');")
    assert rule_name is None
    assert reminder is None

def test_check_patterns_content_empty():
    """Test when content is empty string."""
    rule_name, reminder = check_patterns("src/main.js", "")
    assert rule_name is None
    assert reminder is None

def test_check_patterns_none_content():
    """Test when content is None."""
    rule_name, reminder = check_patterns("src/main.js", None)
    assert rule_name is None
    assert reminder is None
