#!/usr/bin/env python3
"""
Test script to verify the hook works with Claude Code's actual input format.
This captures what Claude Code would actually send to our hook.
"""

import json
import sys
import tempfile
from pathlib import Path

def test_real_claude_input():
    """Test with realistic Claude Code tool call format"""
    
    # This is what Claude Code actually sends to PreToolUse hooks
    realistic_tool_calls = [
        {
            "tool": "Bash",
            "input": {
                "command": "echo $DATABASE_URL",
                "description": "Display database connection string"
            }
        },
        {
            "tool": "Read", 
            "input": {
                "file_path": "/path/to/.env"
            }
        },
        {
            "tool": "Write",
            "input": {
                "file_path": "/tmp/config.py",
                "content": "API_KEY = 'sk-test123456789012345678901234567890123456789'"
            }
        },
        {
            "tool": "Edit",
            "input": {
                "file_path": "/tmp/script.sh",
                "old_string": "API_KEY=placeholder",
                "new_string": "API_KEY=sk-real123456789012345678901234567890123456789"
            }
        }
    ]
    
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    print("🔧 Testing Claude Code integration scenarios...")
    print("=" * 60)
    
    for i, tool_call in enumerate(realistic_tool_calls, 1):
        print(f"\nTest {i}: {tool_call['tool']} tool")
        print(f"Input: {json.dumps(tool_call, indent=2)}")
        
        # Test the hook
        import subprocess
        result = subprocess.run(
            [sys.executable, str(hook_path)],
            input=json.dumps(tool_call),
            capture_output=True,
            text=True
        )
        
        print(f"Exit Code: {result.returncode}")
        
        if result.returncode == 2:
            print("🔒 BLOCKED - Security alert triggered")
            print("Security output:")
            for line in result.stderr.split('\n'):
                if line.strip():
                    print(f"  {line}")
        elif result.returncode == 0:
            print("✅ ALLOWED - No secrets detected")
        else:
            print(f"❌ ERROR - Unexpected exit code: {result.returncode}")
            if result.stderr:
                print(f"Error: {result.stderr}")
        
        print("-" * 40)
    
    print("\n🎯 Integration test complete!")

def test_performance():
    """Test hook performance with various input sizes"""
    hook_path = Path(__file__).parent / "secret_detection_hook.py"
    
    # Test with large command
    large_command = "echo " + "safe_text " * 1000
    tool_call = {
        "tool": "Bash",
        "input": {"command": large_command}
    }
    
    import time
    import subprocess
    
    start = time.time()
    result = subprocess.run(
        [sys.executable, str(hook_path)],
        input=json.dumps(tool_call),
        capture_output=True,
        text=True
    )
    end = time.time()
    
    print(f"\n⚡ Performance Test:")
    print(f"Large command processing time: {(end - start) * 1000:.2f}ms")
    print(f"Exit code: {result.returncode} (should be 0 for safe command)")
    
    if (end - start) < 0.1:  # Should be under 100ms
        print("✅ Performance: ACCEPTABLE")
    else:
        print("⚠️  Performance: SLOW - may impact user experience")

if __name__ == "__main__":
    test_real_claude_input()
    test_performance()