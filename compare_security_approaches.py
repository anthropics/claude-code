#!/usr/bin/env python3
"""
Comparison of Security Approaches: Fail-Open vs Byzantine Fault Tolerance
========================================================================
Demonstrates the difference between our original approach and true zero-trust.
"""
import subprocess
import sys
import json

def test_hook(hook_file, test_input, description):
    """Test a security hook and return results"""
    print(f"\n🧪 {description}")
    print("-" * 50)
    
    try:
        result = subprocess.run(
            [sys.executable, hook_file],
            input=test_input,
            text=True,
            capture_output=True,
            timeout=10
        )
        
        print(f"Exit Code: {result.returncode}")
        print(f"Behavior: {'BLOCKED' if result.returncode == 2 else 'ALLOWED'}")
        
        if result.stderr:
            # Show first few lines of output
            stderr_lines = result.stderr.split('\n')[:3]
            print(f"Output: {stderr_lines[0] if stderr_lines else 'None'}")
        
        return result.returncode
        
    except subprocess.TimeoutExpired:
        print("❌ Test timed out")
        return -1
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return -1

def main():
    """Compare security approaches"""
    print("🔒 SECURITY APPROACH COMPARISON")
    print("=" * 60)
    print("Comparing fail-open vs Byzantine fault tolerance approaches")
    
    # Test cases
    test_cases = [
        {
            "name": "Valid Secret Detection",
            "input": '{"tool_name": "Bash", "tool_input": {"command": "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890"}}',
            "expected": 2
        },
        {
            "name": "Safe Command",
            "input": '{"tool_name": "Bash", "tool_input": {"command": "echo hello world"}}',
            "expected": 0
        },
        {
            "name": "Invalid JSON (Error Handling)",
            "input": 'invalid json here',
            "expected": "depends on approach"
        },
        {
            "name": "Empty Input (Edge Case)",
            "input": '',
            "expected": "depends on approach"
        }
    ]
    
    hooks = [
        ("secret_detection_hook.py", "Original (Fail-Open)"),
        ("zero_trust_byzantine_hook.py", "Byzantine (Fail-Secure)")
    ]
    
    results = {}
    
    for hook_file, hook_name in hooks:
        print(f"\n🛡️  Testing {hook_name}")
        print("=" * 40)
        results[hook_name] = {}
        
        for test_case in test_cases:
            exit_code = test_hook(hook_file, test_case["input"], test_case["name"])
            results[hook_name][test_case["name"]] = exit_code
    
    # Analysis
    print(f"\n📊 COMPARISON ANALYSIS")
    print("=" * 60)
    
    for test_case in test_cases:
        test_name = test_case["name"]
        print(f"\n{test_name}:")
        for hook_name in ["Original (Fail-Open)", "Byzantine (Fail-Secure)"]:
            exit_code = results[hook_name][test_name]
            behavior = "BLOCKED" if exit_code == 2 else "ALLOWED" if exit_code == 0 else "ERROR"
            print(f"  {hook_name:25}: {behavior} (exit {exit_code})")
    
    # Key differences
    print(f"\n🎯 KEY DIFFERENCES")
    print("=" * 40)
    print("Fail-Open Approach:")
    print("  ✅ User-friendly - doesn't break Claude Code on errors")
    print("  ❌ Security risk - allows execution when validation fails")
    print("  📝 Simple audit trail")
    
    print(f"\nByzantine Fault Tolerance:")
    print("  ✅ True zero-trust - fail secure on ANY error")
    print("  ✅ Cryptographic commitments and validation")
    print("  ✅ Tamper-proof audit chain")
    print("  ❌ Stricter - may block legitimate usage if bugs exist")
    
    print(f"\n🏗️ LIBRARY POTENTIAL")
    print("=" * 40)
    print("These two approaches demonstrate:")
    print("  • Different security/usability tradeoffs")
    print("  • Reusable patterns for any system")
    print("  • Foundation for a comprehensive security library")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())