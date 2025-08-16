#!/usr/bin/env python3
"""
Comprehensive test suite for the Claude Code security hook.
Tests all secret detection patterns and integration scenarios.
"""

import json
import subprocess
import tempfile
import os
import sys
from pathlib import Path

def run_hook_test(tool_call_json):
    """Run the security hook with given input and return exit code, stdout, stderr"""
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    result = subprocess.run(
        [sys.executable, str(hook_path)],
        input=tool_call_json,
        capture_output=True,
        text=True
    )
    
    return result.returncode, result.stdout, result.stderr

def test_openai_api_key():
    """Test OpenAI API key detection"""
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "curl -H 'Authorization: Bearer sk-1234567890abcdef1234567890abcdef1234567890' api.openai.com"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "OPENAI_API_KEY" in stderr, "Should detect OpenAI API key"
    assert "sk-1234567..." in stderr, "Should show truncated key"
    print("✅ OpenAI API key detection: PASS")

def test_anthropic_api_key():
    """Test Anthropic API key detection"""
    tool_call = {
        "tool_name": "Bash", 
        "tool_input": {
            "command": "export ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqr-stuvwxyzABC"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "ANTHROPIC_API_KEY" in stderr, "Should detect Anthropic API key"
    print("✅ Anthropic API key detection: PASS")

def test_github_token():
    """Test GitHub token detection"""
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "git clone https://ghp_abcdefghijklmnopqrstuvwxyz0123456789@github.com/user/repo.git"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "GITHUB_TOKEN" in stderr, "Should detect GitHub token"
    print("✅ GitHub token detection: PASS")

def test_database_url():
    """Test database URL detection"""
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "psql postgres://user:secret_password@localhost:5432/production_db"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "POSTGRESQL_URL" in stderr, "Should detect PostgreSQL URL"
    print("✅ Database URL detection: PASS")

def test_aws_credentials():
    """Test AWS credentials detection"""
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "aws s3 ls --access-key AKIAIOSFODNN7EXAMPLE --secret-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "AWS_ACCESS_KEY" in stderr, "Should detect AWS access key"
    print("✅ AWS credentials detection: PASS")

def test_environment_variables():
    """Test sensitive environment variable detection"""
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "echo $API_KEY $DATABASE_PASSWORD $SECRET_TOKEN"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "SENSITIVE_ENV_VAR" in stderr, "Should detect sensitive env vars"
    print("✅ Environment variable detection: PASS")

def test_jwt_token():
    """Test JWT token detection"""
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "curl -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' api.example.com"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "JWT_TOKEN" in stderr, "Should detect JWT token"
    print("✅ JWT token detection: PASS")

def test_safe_commands():
    """Test that safe commands are allowed"""
    safe_commands = [
        "ls -la",
        "git status", 
        "python3 script.py",
        "echo 'Hello World'",
        "npm install"
    ]
    
    for command in safe_commands:
        tool_call = {
            "tool_name": "Bash",
            "tool_input": {"command": command}
        }
        
        exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
        assert exit_code == 0, f"Safe command '{command}' should be allowed, got exit code {exit_code}"
    
    print("✅ Safe commands allowed: PASS")

def test_read_tool_sensitive_files():
    """Test Read tool with sensitive file detection"""
    tool_call = {
        "tool_name": "Read",
        "tool_input": {
            "file_path": "/path/to/.env"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "SENSITIVE_FILE" in stderr, "Should detect sensitive file"
    print("✅ Sensitive file detection: PASS")

def test_write_tool_with_secrets():
    """Test Write tool with secret content"""
    tool_call = {
        "tool_name": "Write",
        "tool_input": {
            "file_path": "/tmp/config.py",
            "content": "API_KEY = 'sk-1234567890abcdef1234567890abcdef1234567890'\nDATABASE_URL = 'postgres://user:pass@host/db'"
        }
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, f"Expected exit code 2, got {exit_code}"
    assert "OPENAI_API_KEY" in stderr, "Should detect API key in content"
    print("✅ Write tool secret detection: PASS")

def test_error_handling():
    """Test hook error handling with malformed input"""
    # Test with invalid JSON
    exit_code, stdout, stderr = run_hook_test("invalid json")
    assert exit_code == 0, "Should fail open on invalid JSON"
    
    # Test with empty input
    exit_code, stdout, stderr = run_hook_test("")
    assert exit_code == 0, "Should fail open on empty input"
    
    print("✅ Error handling: PASS")

def test_audit_logging():
    """Test that audit logging works"""
    audit_dir = Path.home() / ".claude-code-security"
    audit_file = audit_dir / "secret_detections.jsonl"
    
    # Clear existing log
    if audit_file.exists():
        audit_file.unlink()
    
    # Run a test that should be logged
    tool_call = {
        "tool_name": "Bash",
        "tool_input": {"command": "echo $SECRET_KEY"}
    }
    
    exit_code, stdout, stderr = run_hook_test(json.dumps(tool_call))
    
    assert exit_code == 2, "Should block command"
    assert audit_file.exists(), "Audit file should be created"
    
    # Check audit content
    with open(audit_file) as f:
        audit_entry = json.loads(f.read().strip())
        assert audit_entry["tool"] == "Bash", "Should log tool name"
        assert audit_entry["blocked"] == True, "Should log as blocked"
        assert "SENSITIVE_ENV_VAR" in audit_entry["secret_types"], "Should log secret type"
    
    print("✅ Audit logging: PASS")

def run_all_tests():
    """Run all tests and report results"""
    tests = [
        test_openai_api_key,
        test_anthropic_api_key, 
        test_github_token,
        test_database_url,
        test_aws_credentials,
        test_environment_variables,
        test_jwt_token,
        test_safe_commands,
        test_read_tool_sensitive_files,
        test_write_tool_with_secrets,
        test_error_handling,
        test_audit_logging
    ]
    
    print("🧪 Running comprehensive hook tests...")
    print("=" * 50)
    
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
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 ALL TESTS PASSED! Hook is ready for production.")
        return True
    else:
        print("❌ Some tests failed. Review and fix issues before deployment.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)