#!/usr/bin/env python3
"""Integration test for compound command validation feature."""

import sys
import os
import json

# Add plugin root to path
PLUGIN_ROOT = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(PLUGIN_ROOT)
sys.path.insert(0, parent_dir)
sys.path.insert(0, PLUGIN_ROOT)

from hookify.core.config_loader import Rule, Condition
from hookify.core.rule_engine import RuleEngine


def test_compound_command_detection():
    """Test that compound commands are detected and formatted correctly."""
    print("Testing compound command detection...")
    
    # Create a rule that detects compound commands
    rule = Rule(
        name="test-compound",
        enabled=True,
        event="bash",
        conditions=[
            Condition(
                field="command",
                operator="is_compound",
                pattern=""
            )
        ],
        action="warn",
        message="⚠️ Compound command detected:\n\n{{COMMAND_BREAKDOWN}}"
    )
    
    engine = RuleEngine()
    
    # Test 1: Simple command (should not match)
    input1 = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "ls -la"
        }
    }
    
    result1 = engine.evaluate_rules([rule], input1)
    assert result1 == {}, f"Simple command should not match: {result1}"
    print("  ✓ Simple command correctly ignored")
    
    # Test 2: Compound command with && (should match)
    input2 = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "sleep 10 && echo done"
        }
    }
    
    result2 = engine.evaluate_rules([rule], input2)
    assert "systemMessage" in result2, "Compound command should trigger warning"
    assert "sleep 10" in result2["systemMessage"], "Should show first command"
    assert "echo done" in result2["systemMessage"], "Should show second command"
    assert "THEN (if successful)" in result2["systemMessage"], "Should explain && operator"
    print("  ✓ Compound command with && detected and formatted")
    
    # Test 3: Compound command with || (should match)
    input3 = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "cmd1 || cmd2"
        }
    }
    
    result3 = engine.evaluate_rules([rule], input3)
    assert "systemMessage" in result3, "Compound command should trigger warning"
    assert "OR (if failed)" in result3["systemMessage"], "Should explain || operator"
    print("  ✓ Compound command with || detected and formatted")
    
    # Test 4: Compound command with ; (should match)
    input4 = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "ls ; pwd"
        }
    }
    
    result4 = engine.evaluate_rules([rule], input4)
    assert "systemMessage" in result4, "Compound command should trigger warning"
    assert "THEN (regardless)" in result4["systemMessage"], "Should explain ; operator"
    print("  ✓ Compound command with ; detected and formatted")
    
    # Test 5: Pipe command (should match)
    input5 = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "cat file.txt | grep pattern"
        }
    }
    
    result5 = engine.evaluate_rules([rule], input5)
    assert "systemMessage" in result5, "Pipe command should trigger warning"
    assert "PIPE output to" in result5["systemMessage"], "Should explain | operator"
    print("  ✓ Pipe command detected and formatted")
    
    # Test 6: Quoted string with operator (should not match)
    input6 = {
        "tool_name": "Bash",
        "tool_input": {
            "command": 'echo "hello && world"'
        }
    }
    
    result6 = engine.evaluate_rules([rule], input6)
    assert result6 == {}, f"Quoted operator should not match: {result6}"
    print("  ✓ Quoted operators correctly ignored")
    
    print("\n✅ All compound command tests passed!\n")


def test_base_commands_template():
    """Test the {{BASE_COMMANDS}} template variable."""
    print("Testing {{BASE_COMMANDS}} template...")
    
    rule = Rule(
        name="test-base-commands",
        enabled=True,
        event="bash",
        conditions=[
            Condition(
                field="command",
                operator="is_compound",
                pattern=""
            )
        ],
        action="warn",
        message="Commands: {{BASE_COMMANDS}}"
    )
    
    engine = RuleEngine()
    
    input_data = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "sleep 10 && echo done && ls -la"
        }
    }
    
    result = engine.evaluate_rules([rule], input_data)
    assert "systemMessage" in result, "Should trigger warning"
    assert "`sleep`" in result["systemMessage"], "Should include sleep"
    assert "`echo`" in result["systemMessage"], "Should include echo"
    assert "`ls`" in result["systemMessage"], "Should include ls"
    print("  ✓ {{BASE_COMMANDS}} template correctly expanded")
    print(f"  Message: {result['systemMessage']}")
    print("\n✅ Template test passed!\n")


def test_dangerous_compound_blocking():
    """Test blocking dangerous compound commands."""
    print("Testing dangerous compound command blocking...")
    
    rule = Rule(
        name="block-dangerous-compound",
        enabled=True,
        event="bash",
        conditions=[
            Condition(field="command", operator="is_compound", pattern=""),
            Condition(field="command", operator="regex_match", pattern=r"rm\s+-rf")
        ],
        action="block",
        message="❌ Dangerous compound command blocked!\n\n{{COMMAND_BREAKDOWN}}"
    )
    
    engine = RuleEngine()
    
    # Test: Compound command with rm -rf (should block)
    input_data = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "ls -la && rm -rf /tmp/test"
        },
        "hook_event_name": "PreToolUse"
    }
    
    result = engine.evaluate_rules([rule], input_data)
    assert "hookSpecificOutput" in result, "Should block operation"
    assert result["hookSpecificOutput"]["permissionDecision"] == "deny", "Should deny permission"
    assert "rm -rf" in result["systemMessage"], "Should mention dangerous command"
    print("  ✓ Dangerous compound command correctly blocked")
    print(f"  Message: {result['systemMessage'][:100]}...")
    print("\n✅ Blocking test passed!\n")


if __name__ == '__main__':
    try:
        test_compound_command_detection()
        test_base_commands_template()
        test_dangerous_compound_blocking()
        print("=" * 60)
        print("🎉 All integration tests passed!")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
