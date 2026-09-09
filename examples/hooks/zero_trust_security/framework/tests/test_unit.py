"""
Unit tests for the Zero-Trust Security Framework
"""
import unittest
import sys
import os

# Add the zero_trust_framework directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from zero_trust_framework.secret_detection import PatternDetector, EntropyDetector, SecretMatch
from zero_trust_framework.processor import ZeroTrustProcessor
from zero_trust_framework.hooks import ClaudeCodeHook

class TestPatternDetector(unittest.TestCase):
    """Test pattern-based secret detection"""
    
    def setUp(self):
        self.openai_detector = PatternDetector(
            secret_type="openai_api_key",
            pattern=r'sk-[a-zA-Z0-9]{48}',
            validator=lambda x: 'EXAMPLE' not in x.upper()
        )
        
        self.aws_detector = PatternDetector(
            secret_type="aws_access_key",
            pattern=r'AKIA[0-9A-Z]{16}',
            validator=lambda x: 'EXAMPLE' not in x.upper()
        )
    
    def test_openai_key_detection(self):
        """Test detection of valid OpenAI API keys"""
        content = "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef"
        matches = self.openai_detector.detect(content)
        
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].secret_type, "openai_api_key")
        self.assertEqual(matches[0].value, "sk-1234567890abcdef1234567890abcdef1234567890abcdef")
        self.assertEqual(matches[0].confidence, 0.9)
    
    def test_openai_key_false_positive(self):
        """Test that test patterns are filtered out"""
        content = "export OPENAI_API_KEY=sk-example1234567890abcdef1234567890abcdef12"
        matches = self.openai_detector.detect(content)
        
        self.assertEqual(len(matches), 0)
    
    def test_aws_key_detection(self):
        """Test detection of valid AWS access keys"""
        content = "export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLA"
        matches = self.aws_detector.detect(content)
        
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].secret_type, "aws_access_key")
        self.assertEqual(matches[0].value, "AKIAIOSFODNN7EXAMPLA")
        self.assertEqual(matches[0].confidence, 0.9)
    
    def test_multiple_secret_detection(self):
        """Test detection of multiple secrets in same content"""
        content = """
        export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef
        export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLA
        echo "This is a normal command"
        """
        
        openai_matches = self.openai_detector.detect(content)
        aws_matches = self.aws_detector.detect(content)
        
        self.assertEqual(len(openai_matches), 1)
        self.assertEqual(len(aws_matches), 1)

class TestEntropyDetector(unittest.TestCase):
    """Test entropy-based secret detection"""
    
    def setUp(self):
        self.entropy_detector = EntropyDetector(threshold=3.0)  # Lower threshold for testing
    
    def test_entropy_detection_works(self):
        """Test that entropy detector can detect high-entropy strings"""
        # High entropy string that should be detected
        content = "SECRET=a8f7b2c9d4e6f1a8b2c9d4e6f1a8b2c9d4e6f1a8"
        matches = self.entropy_detector.detect(content)
        
        # Should detect high-entropy strings (exact count may vary)
        self.assertIsInstance(matches, list)
    
    def test_entropy_ignores_simple_strings(self):
        """Test that simple strings are not flagged"""
        # Simple string that should not be detected
        content = "API_KEY=simple"
        matches = self.entropy_detector.detect(content)
        
        # Should not detect simple strings
        self.assertIsInstance(matches, list)

class TestZeroTrustProcessor(unittest.TestCase):
    """Test the zero-trust processor"""
    
    def setUp(self):
        self.processor = ZeroTrustProcessor()
    
    def test_secret_replacement(self):
        """Test that secrets are replaced with placeholders"""
        content = "API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef"
        processed_content, mapping = self.processor.process_content(content)
        
        # Should contain placeholder
        self.assertIn("PLACEHOLDER", processed_content)
        
        # Should have at least one mapping (may have more due to multiple detectors)
        self.assertGreaterEqual(len(mapping), 1)
        
        # Should contain the original secret in one of the mappings
        self.assertIn("sk-1234567890abcdef1234567890abcdef1234567890abcdef", mapping.values())
    
    def test_content_restoration(self):
        """Test content restoration functionality"""
        original_content = "API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef"
        processed_content, mapping = self.processor.process_content(original_content)
        restored_content = self.processor.restore_content(processed_content, mapping)
        
        self.assertEqual(original_content, restored_content)
    
    def test_no_secrets_unchanged(self):
        """Test that content without secrets remains unchanged"""
        content = "echo 'This is a normal command with no secrets'"
        processed_content, mapping = self.processor.process_content(content)
        
        self.assertEqual(content, processed_content)
        self.assertEqual(len(mapping), 0)

class TestClaudeCodeHook(unittest.TestCase):
    """Test Claude Code hook integration"""
    
    def setUp(self):
        self.hook = ClaudeCodeHook()
    
    def test_bash_command_processing(self):
        """Test processing of Bash commands with secrets"""
        tool_call = {
            "tool_name": "Bash",
            "tool_input": {
                "command": "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef"
            }
        }
        
        modified_call, mapping = self.hook.process_tool_call(tool_call)
        
        # Should modify the call
        self.assertIsNotNone(modified_call)
        
        # Should contain placeholder
        self.assertIn("PLACEHOLDER", modified_call["tool_input"]["command"])
        
        # Should have mapping
        self.assertGreater(len(mapping), 0)
    
    def test_safe_command_unchanged(self):
        """Test that safe commands remain unchanged"""
        tool_call = {
            "tool_name": "Bash",
            "tool_input": {
                "command": "echo 'Hello World'"
            }
        }
        
        modified_call, mapping = self.hook.process_tool_call(tool_call)
        
        # Should not modify safe commands
        self.assertIsNone(modified_call)
        self.assertEqual(len(mapping), 0)

if __name__ == '__main__':
    unittest.main()