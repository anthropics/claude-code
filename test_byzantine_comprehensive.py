#!/usr/bin/env python3
"""
Comprehensive test for Byzantine fault tolerance implementation
"""
import subprocess
import sys
import json
from pathlib import Path

def run_byzantine_test(tool_call_json):
    """Run the Byzantine security hook and return results"""
    hook_path = Path(__file__).parent / "zero_trust_byzantine_hook.py"
    
    result = subprocess.run(
        [sys.executable, str(hook_path)],
        input=tool_call_json,
        capture_output=True,
        text=True
    )
    
    return result.returncode, result.stdout, result.stderr

def test_byzantine_secret_detection():
    """Test Byzantine hook blocks secrets properly"""
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890"
        }
    }
    
    exit_code, stdout, stderr = run_byzantine_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "ZERO-TRUST BYZANTINE SECURITY ALERT" in stderr, "Should show Byzantine alert"
    assert "Cryptographic commitment:" in stderr, "Should show commitment ID"
    assert "Byzantine validators:" in stderr, "Should show validator count"
    assert "Audit chain entry:" in stderr, "Should show audit entry ID"
    print("✅ Byzantine secret detection: PASS")

def test_byzantine_safe_command():
    """Test Byzantine hook allows safe commands"""
    tool_call = {
        "tool_name": "Bash", 
        "tool_input": {
            "command": "echo hello world"
        }
    }
    
    exit_code, stdout, stderr = run_byzantine_test(json.dumps(tool_call))
    
    assert exit_code == 0, f"Expected exit code 0, got {exit_code}"
    print("✅ Byzantine safe command: PASS")

def test_byzantine_fail_secure():
    """Test Byzantine hook fails secure on errors"""
    test_cases = [
        ("", "Empty input"),
        ("invalid json", "Invalid JSON"),
        ("{}", "Missing required fields"),
    ]
    
    for test_input, description in test_cases:
        exit_code, stdout, stderr = run_byzantine_test(test_input)
        assert exit_code == 2, f"{description}: Expected exit code 2 (fail secure), got {exit_code}"
    
    print("✅ Byzantine fail-secure behavior: PASS")

def test_byzantine_audit_chain():
    """Test Byzantine audit chain is created"""
    import os
    from pathlib import Path
    
    audit_dir = Path.home() / ".claude-code-security-bft"
    audit_file = audit_dir / "byzantine_audit_chain.jsonl"
    
    # Record current size
    initial_size = audit_file.stat().st_size if audit_file.exists() else 0
    
    # Run a test that should create audit entry
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {"command": "echo test"}
    }
    
    exit_code, stdout, stderr = run_byzantine_test(json.dumps(tool_call))
    assert exit_code == 0, "Safe command should be allowed"
    
    # Check audit file grew
    assert audit_file.exists(), "Byzantine audit file should exist"
    new_size = audit_file.stat().st_size
    assert new_size > initial_size, "Audit file should have grown"
    
    print("✅ Byzantine audit chain: PASS")

def main():
    """Run all Byzantine tests"""
    print("🏛️  Running Byzantine Fault Tolerance Tests")
    print("=" * 50)
    
    tests = [
        test_byzantine_secret_detection,
        test_byzantine_safe_command, 
        test_byzantine_fail_secure,
        test_byzantine_audit_chain
    ]
    
    passed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"❌ {test.__name__}: FAIL - {e}")
        except Exception as e:
            print(f"❌ {test.__name__}: ERROR - {e}")
    
    print("\n" + "=" * 50)
    print(f"📊 Byzantine Test Results: {passed}/{len(tests)} passed")
    
    if passed == len(tests):
        print("🏆 ALL BYZANTINE TESTS PASSED! Zero-trust implementation validated.")
        return 0
    else:
        print("⚠️  Some Byzantine tests failed.")
        return 1

if __name__ == "__main__":
    sys.exit(main())