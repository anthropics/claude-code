"""
Unit tests for the Zero-Trust Security Hook
"""
import unittest
import subprocess
import json
import os
import sys

# Add the hook directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

class TestZeroTrustHook(unittest.TestCase):
    """Test the zero-trust security hook"""
    
    def setUp(self):
        self.hook_path = os.path.join(os.path.dirname(__file__), 'hook.py')
    
    def test_secret_replacement(self):
        """Test that secrets are replaced with placeholders"""
        tool_call = {
            "tool_name": "Bash",
            "tool_input": {
                "command": "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef"
            }
        }
        
        # Run the hook
        result = subprocess.run(
            ["python3", self.hook_path],
            input=json.dumps(tool_call),
            capture_output=True,
            text=True
        )
        
        # Should succeed
        self.assertEqual(result.returncode, 0)
        
        # Should modify the input
        self.assertTrue(result.stdout.strip())
        
        # Parse the modified tool call
        modified_call = json.loads(result.stdout.strip())
        modified_command = modified_call["tool_input"]["command"]
        
        # Should contain placeholder
        self.assertIn("PLACEHOLDER", modified_command)
        self.assertNotIn("sk-1234567890abcdef1234567890abcdef1234567890abcdef", modified_command)
    
    def test_safe_command_unchanged(self):
        """Test that safe commands remain unchanged"""
        tool_call = {
            "tool_name": "Bash",
            "tool_input": {
                "command": "echo 'Hello World'"
            }
        }
        
        # Run the hook
        result = subprocess.run(
            ["python3", self.hook_path],
            input=json.dumps(tool_call),
            capture_output=True,
            text=True
        )
        
        # Should succeed
        self.assertEqual(result.returncode, 0)
        
        # Should not modify the input
        self.assertFalse(result.stdout.strip())
    
    def test_aws_key_detection(self):
        """Test AWS access key detection"""
        tool_call = {
            "tool_name": "Bash",
            "tool_input": {
                "command": "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLA"
            }
        }
        
        # Run the hook
        result = subprocess.run(
            ["python3", self.hook_path],
            input=json.dumps(tool_call),
            capture_output=True,
            text=True
        )
        
        # Should succeed
        self.assertEqual(result.returncode, 0)
        
        # Should modify the input
        self.assertTrue(result.stdout.strip())
        
        # Parse the modified tool call
        modified_call = json.loads(result.stdout.strip())
        modified_command = modified_call["tool_input"]["command"]
        
        # Should contain placeholder
        self.assertIn("PLACEHOLDER", modified_command)
        self.assertNotIn("AKIAIOSFODNN7EXAMPLA", modified_command)
    
    def test_test_pattern_ignored(self):
        """Test that test patterns are ignored"""
        tool_call = {
            "tool_name": "Bash",
            "tool_input": {
                "command": "export OPENAI_API_KEY=sk-example1234567890abcdef1234567890abcdef12"
            }
        }
        
        # Run the hook
        result = subprocess.run(
            ["python3", self.hook_path],
            input=json.dumps(tool_call),
            capture_output=True,
            text=True
        )
        
        # Should succeed
        self.assertEqual(result.returncode, 0)
        
        # Should not modify the input (test patterns ignored)
        self.assertFalse(result.stdout.strip())

if __name__ == '__main__':
    unittest.main()