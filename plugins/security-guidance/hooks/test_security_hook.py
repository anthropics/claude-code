#!/usr/bin/env python3
"""
Test script for the Enhanced Security Reminder Hook
This script tests various security patterns to ensure they are properly detected.
"""

import json
import subprocess
import sys
import tempfile
import os
from pathlib import Path


def run_hook_test(tool_name: str, file_path: str, content: str, session_id: str = "test") -> tuple:
    """Run the security hook with test data and return the result."""
    hook_path = Path(__file__).parent / "security_reminder_hook.py"
    
    # Prepare test input
    test_input = {
        "session_id": session_id,
        "tool_name": tool_name,
        "tool_input": {
            "file_path": file_path,
            "content": content,
            "new_string": content if tool_name == "Edit" else "",
            "edits": [{"new_string": content}] if tool_name == "MultiEdit" else []
        }
    }
    
    try:
        # Run the hook
        result = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(test_input),
            text=True,
            capture_output=True,
            timeout=10
        )
        
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Timeout"
    except Exception as e:
        return -1, "", str(e)


def test_security_patterns():
    """Test various security patterns."""
    tests = [
        # Command injection tests
        {
            "name": "Command Injection - exec()",
            "file_path": "test.js",
            "content": "exec(`command ${userInput}`)",
            "expected_exit": 2,
            "expected_warning": "Command Injection"
        },
        {
            "name": "Command Injection - os.system()",
            "file_path": "test.py",
            "content": "os.system(f'command {user_input}')",
            "expected_exit": 2,
            "expected_warning": "Command Injection"
        },
        
        # Code injection tests
        {
            "name": "Code Injection - eval()",
            "file_path": "test.js",
            "content": "eval(userCode)",
            "expected_exit": 2,
            "expected_warning": "Code Injection"
        },
        {
            "name": "Code Injection - new Function()",
            "file_path": "test.js",
            "content": "new Function(userCode)",
            "expected_exit": 2,
            "expected_warning": "Code Injection"
        },
        
        # XSS tests
        {
            "name": "XSS - innerHTML",
            "file_path": "test.js",
            "content": "element.innerHTML = userContent",
            "expected_exit": 2,
            "expected_warning": "XSS"
        },
        {
            "name": "XSS - dangerouslySetInnerHTML",
            "file_path": "test.jsx",
            "content": "<div dangerouslySetInnerHTML={{__html: userContent}} />",
            "expected_exit": 2,
            "expected_warning": "XSS"
        },
        
        # SQL injection tests
        {
            "name": "SQL Injection",
            "file_path": "test.py",
            "content": "cursor.execute('SELECT * FROM users WHERE id = ' + user_id)",
            "expected_exit": 2,
            "expected_warning": "SQL Injection"
        },
        
        # Hardcoded secrets tests
        {
            "name": "Hardcoded Secret - API Key",
            "file_path": "test.py",
            "content": "api_key = 'sk-1234567890abcdef'",
            "expected_exit": 2,
            "expected_warning": "Hardcoded Secret"
        },
        
        # GitHub Actions tests
        {
            "name": "GitHub Actions Workflow",
            "file_path": ".github/workflows/test.yml",
            "content": "run: echo 'Hello World'",
            "expected_exit": 2,
            "expected_warning": "GitHub Actions"
        },
        
        # Safe code tests (should not trigger warnings)
        {
            "name": "Safe Code - No Issues",
            "file_path": "test.js",
            "content": "const safe = 'This is safe code';",
            "expected_exit": 0,
            "expected_warning": None
        }
    ]
    
    print("🧪 Testing Enhanced Security Reminder Hook")
    print("=" * 50)
    
    passed = 0
    failed = 0
    
    for test in tests:
        print(f"\n🔍 Testing: {test['name']}")
        
        exit_code, stdout, stderr = run_hook_test("Write", test["file_path"], test["content"])
        
        if exit_code == test["expected_exit"]:
            if test["expected_warning"]:
                if test["expected_warning"] in stderr:
                    print(f"✅ PASS: Warning correctly detected")
                    passed += 1
                else:
                    print(f"❌ FAIL: Expected warning '{test['expected_warning']}' not found")
                    print(f"   Stderr: {stderr[:200]}...")
                    failed += 1
            else:
                print(f"✅ PASS: No warning (as expected)")
                passed += 1
        else:
            print(f"❌ FAIL: Expected exit code {test['expected_exit']}, got {exit_code}")
            print(f"   Stderr: {stderr[:200]}...")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️ Some tests failed!")
        return False


def test_performance():
    """Test performance with large content."""
    print("\n🚀 Testing Performance with Large Content")
    print("=" * 50)
    
    # Create large content with security issue at the beginning
    large_content = "exec(`command ${userInput}`) " + "console.log('test'); " * 1000  # ~20KB
    
    exit_code, stdout, stderr = run_hook_test("Write", "test.js", large_content, "perf_test")
    
    if exit_code == 2 and "Command Injection" in stderr:
        print("✅ PASS: Large content handled correctly")
        return True
    else:
        print("❌ FAIL: Large content not handled properly")
        print(f"   Exit code: {exit_code}")
        print(f"   Stderr: {stderr[:200]}...")
        return False


def test_state_management():
    """Test session state management."""
    print("\n💾 Testing State Management")
    print("=" * 50)
    
    # First run - should trigger warning
    exit_code1, _, stderr1 = run_hook_test("Write", "test.js", "exec(`command ${userInput}`)", "state_test")
    
    # Second run with same session - should not trigger warning
    exit_code2, _, stderr2 = run_hook_test("Write", "test.js", "exec(`command ${userInput}`)", "state_test")
    
    if exit_code1 == 2 and exit_code2 == 0:
        print("✅ PASS: State management working correctly")
        return True
    else:
        print("❌ FAIL: State management not working")
        print(f"   First run: exit_code={exit_code1}")
        print(f"   Second run: exit_code={exit_code2}")
        return False


def main():
    """Run all tests."""
    print("🔒 Enhanced Security Reminder Hook Test Suite")
    print("=" * 60)
    
    # Check if hook exists
    hook_path = Path(__file__).parent / "security_reminder_hook.py"
    if not hook_path.exists():
        print(f"❌ Hook not found at {hook_path}")
        return False
    
    # Run tests
    tests_passed = []
    tests_passed.append(test_security_patterns())
    tests_passed.append(test_performance())
    tests_passed.append(test_state_management())
    
    print("\n" + "=" * 60)
    print(f"📈 Overall Results: {sum(tests_passed)}/{len(tests_passed)} test suites passed")
    
    if all(tests_passed):
        print("🎉 All test suites passed!")
        return True
    else:
        print("⚠️ Some test suites failed!")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
