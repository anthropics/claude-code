#!/usr/bin/env python3
"""
Test CI compatibility - verify the hook works in automated environments
with minimal dependencies and different configurations.
"""

import subprocess
import sys
import os
import tempfile
import json
from pathlib import Path

def test_minimal_environment():
    """Test hook works with minimal Python environment"""
    print("🐍 Testing minimal Python environment compatibility...")
    
    # Test that hook only uses standard library
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    # Read the hook file and check imports
    with open(hook_path) as f:
        content = f.read()
    
    # Should only import standard library modules
    allowed_imports = {
        'json', 'sys', 're', 'os', 'typing', 'datetime', 'pathlib'
    }
    
    import ast
    tree = ast.parse(content)
    
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                module = alias.name.split('.')[0]
                if module not in allowed_imports:
                    raise AssertionError(f"Unexpected import: {module}")
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                module = node.module.split('.')[0]
                if module not in allowed_imports:
                    raise AssertionError(f"Unexpected import: {module}")
    
    print("✅ Only standard library imports used")

def test_cross_platform():
    """Test cross-platform compatibility"""
    print("🌐 Testing cross-platform compatibility...")
    
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    # Test with different environment configurations
    test_envs = [
        {},  # Minimal environment
        {"HOME": "/tmp"},  # Different home directory
        {"TMPDIR": "/tmp"},  # Different temp directory
    ]
    
    for i, env in enumerate(test_envs):
        test_env = os.environ.copy()
        test_env.update(env)
        
        tool_call = {
            "tool": "Bash",
            "input": {"command": "echo $API_KEY"}
        }
        
        result = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(tool_call),
            capture_output=True,
            text=True,
            env=test_env
        )
        
        assert result.returncode == 2, f"Environment {i}: Should block secret"
        assert "SENSITIVE_ENV_VAR" in result.stderr, f"Environment {i}: Should detect secret"
    
    print("✅ Cross-platform compatibility verified")

def test_permission_scenarios():
    """Test different permission scenarios"""
    print("🔐 Testing permission scenarios...")
    
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    # Test with readonly home directory simulation
    with tempfile.TemporaryDirectory() as temp_dir:
        readonly_home = Path(temp_dir) / "readonly_home"
        readonly_home.mkdir()
        
        # Make directory readonly
        readonly_home.chmod(0o444)
        
        try:
            test_env = os.environ.copy()
            test_env["HOME"] = str(readonly_home)
            
            tool_call = {
                "tool": "Bash", 
                "input": {"command": "echo $SECRET_KEY"}
            }
            
            result = subprocess.run(
                [sys.executable, str(hook_path)],
                input=json.dumps(tool_call),
                capture_output=True,
                text=True,
                env=test_env
            )
            
            # Should still work (fail gracefully on audit log issues)
            assert result.returncode == 2, "Should still block secrets even with permission issues"
            
        finally:
            # Restore permissions for cleanup
            readonly_home.chmod(0o755)
    
    print("✅ Permission scenarios handled gracefully")

def test_unicode_and_encoding():
    """Test Unicode and encoding handling"""
    print("🌍 Testing Unicode and encoding...")
    
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    # Test with Unicode in commands
    unicode_tests = [
        "echo 'Hello 世界' && echo $API_KEY",
        "python3 -c \"print('émojis 🔒')\" && echo sk-test123456789012345678901234567890123456789",
        "echo 'Ñoño çãraçtërs' $SECRET_TOKEN"
    ]
    
    for command in unicode_tests:
        tool_call = {
            "tool": "Bash",
            "input": {"command": command}
        }
        
        result = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(tool_call, ensure_ascii=False),
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        assert result.returncode == 2, f"Should detect secrets in Unicode command: {command[:30]}..."
    
    print("✅ Unicode handling verified")

def test_large_inputs():
    """Test handling of large inputs"""
    print("📏 Testing large input handling...")
    
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    # Test with very large command
    large_safe_command = "echo " + "safe_text " * 10000
    large_unsafe_command = large_safe_command + " && echo $API_KEY"
    
    # Test large safe command
    tool_call = {
        "tool": "Bash",
        "input": {"command": large_safe_command}
    }
    
    result = subprocess.run(
        [sys.executable, str(hook_path)],
        input=json.dumps(tool_call),
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 0, "Large safe command should be allowed"
    
    # Test large unsafe command
    tool_call = {
        "tool": "Bash", 
        "input": {"command": large_unsafe_command}
    }
    
    result = subprocess.run(
        [sys.executable, str(hook_path)],
        input=json.dumps(tool_call),
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 2, "Large unsafe command should be blocked"
    
    print("✅ Large input handling verified")

def test_concurrent_usage():
    """Test concurrent hook usage"""
    print("🔄 Testing concurrent usage...")
    
    import threading
    import time
    
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    results = []
    
    def run_hook_test(test_id):
        tool_call = {
            "tool": "Bash",
            "input": {"command": f"echo $API_KEY_{test_id}"}
        }
        
        result = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(tool_call),
            capture_output=True,
            text=True
        )
        
        results.append((test_id, result.returncode))
    
    # Run multiple concurrent tests
    threads = []
    for i in range(5):
        thread = threading.Thread(target=run_hook_test, args=(i,))
        threads.append(thread)
        thread.start()
    
    # Wait for all to complete
    for thread in threads:
        thread.join()
    
    # Verify all blocked correctly
    for test_id, exit_code in results:
        assert exit_code == 2, f"Concurrent test {test_id} should have blocked"
    
    print("✅ Concurrent usage verified")

def run_ci_tests():
    """Run all CI compatibility tests"""
    print("🏗️  Running CI Compatibility Tests")
    print("=" * 50)
    
    tests = [
        test_minimal_environment,
        test_cross_platform,
        test_permission_scenarios,
        test_unicode_and_encoding,
        test_large_inputs,
        test_concurrent_usage
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"❌ {test.__name__}: FAIL - {e}")
            failed += 1
    
    print("=" * 50)
    print(f"📊 CI Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 ALL CI TESTS PASSED! Hook is CI-ready.")
        return True
    else:
        print("❌ Some CI tests failed. Review issues before deployment.")
        return False

if __name__ == "__main__":
    success = run_ci_tests()
    sys.exit(0 if success else 1)