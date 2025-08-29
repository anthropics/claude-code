#!/usr/bin/env python3
"""
Test the zero-trust accountability hook with Claude Code's actual API
"""

import json
import subprocess
import os
import tempfile

def test_hook_with_secret():
    """Test the hook with a command containing secrets."""
    
    # Set up test environment with a fake secret
    test_env = os.environ.copy()
    test_env["TEST_API_KEY"] = "sk-test123456789012345678901234567890123456789"
    
    # Create test input that Claude Code would send to the hook
    test_input = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "echo $TEST_API_KEY",
            "description": "Test command"
        }
    }
    
    # Run the hook
    hook_path = "/Users/jonathanhill/src/claude-code/examples/hooks/zero_trust_env_accountability.py"
    
    try:
        result = subprocess.run(
            ["python3", hook_path],
            input=json.dumps(test_input),
            capture_output=True,
            text=True,
            env=test_env
        )
        
        print("=== HOOK TEST RESULTS ===")
        print(f"Exit code: {result.returncode}")
        print(f"Stdout: {result.stdout}")
        print(f"Stderr: {result.stderr}")
        
        # Exit code 2 means the hook blocked the command (correct behavior)
        if result.returncode == 2:
            print("✅ SUCCESS: Hook correctly blocked secret transmission!")
        else:
            print("❌ FAILURE: Hook should have blocked the command")
            
    except Exception as e:
        print(f"Error running hook: {e}")

def test_hook_without_secret():
    """Test the hook with a safe command."""
    
    test_input = {
        "tool_name": "Bash", 
        "tool_input": {
            "command": "echo 'Hello World'",
            "description": "Safe test command"
        }
    }
    
    hook_path = "/Users/jonathanhill/src/claude-code/examples/hooks/zero_trust_env_accountability.py"
    
    try:
        result = subprocess.run(
            ["python3", hook_path],
            input=json.dumps(test_input),
            capture_output=True,
            text=True
        )
        
        print("\n=== SAFE COMMAND TEST ===")
        print(f"Exit code: {result.returncode}")
        print(f"Stdout: {result.stdout}")
        print(f"Stderr: {result.stderr}")
        
        # Exit code 0 means the hook allowed the command (correct behavior)
        if result.returncode == 0:
            print("✅ SUCCESS: Hook correctly allowed safe command!")
        else:
            print("❌ FAILURE: Hook should have allowed safe command")
            
    except Exception as e:
        print(f"Error running hook: {e}")

if __name__ == "__main__":
    test_hook_with_secret()
    test_hook_without_secret()