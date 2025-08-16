#!/usr/bin/env python3
"""
Comprehensive Library Test Suite
===============================
Tests all components of the zero-trust security library.
"""

import os
import sys
import tempfile
import shutil
import json
from pathlib import Path

# Add the library to the path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from zero_trust_security.core.secret_detector import SecretDetector, SecurityLevel, SecretPattern
from zero_trust_security.core.byzantine_validator import ByzantineValidator, ValidationResult
from zero_trust_security.core.audit_chain import AuditChain
from zero_trust_security.integrations.claude_code import ClaudeCodeHook
from zero_trust_security.integrations.crewai_agent import CrewAIAccountabilityAgent

class TestSecretDetector:
    """Test the SecretDetector component"""
    
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        self.detector = SecretDetector(audit_dir=temp_dir)
    
    def test_secret_detection(self):
        """Test basic secret detection"""
        test_data = {
            "command": "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890",
            "env": {"AWS_ACCESS_KEY": "AKIAIOSFODNN7EXAMPLE"}
        }
        
        result = self.detector.analyze_data(test_data)
        
        assert len(result.secrets_found) >= 2, f"Should detect 2+ secrets, found {len(result.secrets_found)}"
        assert result.blocked, "Should block when secrets are found"
        assert result.risk_score > 0, "Should have positive risk score"
        
        print("✅ Secret detection: PASS")
    
    def test_safe_content(self):
        """Test that safe content is allowed"""
        test_data = {"command": "echo hello world"}
        
        result = self.detector.analyze_data(test_data)
        
        assert len(result.secrets_found) == 0, "Should not detect secrets in safe content"
        assert not result.blocked, "Should not block safe content"
        assert result.risk_score == 0, "Should have zero risk score"
        
        print("✅ Safe content detection: PASS")
    
    def test_custom_patterns(self):
        """Test custom pattern addition"""
        custom_pattern = SecretPattern(
            name="TEST_SECRET",
            pattern=r"TEST_[A-Z0-9]{10}",
            description="Test secret pattern"
        )
        
        detector = SecretDetector(audit_dir=self.temp_dir)
        detector.add_custom_pattern("TEST_SECRET", custom_pattern)
        
        test_data = {"value": "TEST_ABC1234567"}
        result = detector.analyze_data(test_data)
        
        assert len(result.secrets_found) >= 1, "Should detect custom pattern"
        assert any("TEST_SECRET" in str(s) for s in result.secrets_found), "Should identify custom pattern type"
        
        print("✅ Custom patterns: PASS")

class TestByzantineValidator:
    """Test the ByzantineValidator component"""
    
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        self.validator = ByzantineValidator(audit_dir=temp_dir)
    
    def test_commitment_creation(self):
        """Test security commitment creation"""
        test_data = {"command": "echo test"}
        
        commitment = self.validator.create_commitment(test_data)
        
        assert commitment.commitment_id.startswith("sec_"), "Should have proper commitment ID format"
        assert len(commitment.tool_call_hash) == 64, "Should have SHA256 hash"
        assert commitment.validation_word in self.validator.COMMITMENT_WORDS, "Should use valid commitment word"
        assert len(commitment.validator_chain) == self.validator.byzantine_quorum, "Should have correct validator count"
        
        print("✅ Commitment creation: PASS")
    
    def test_commitment_validation(self):
        """Test commitment validation"""
        test_data = {"command": "echo test"}
        
        commitment = self.validator.create_commitment(test_data)
        result = self.validator.validate_commitment(commitment, test_data)
        
        assert result == ValidationResult.VALIDATED, f"Should validate correctly, got {result}"
        
        print("✅ Commitment validation: PASS")
    
    def test_tampered_commitment(self):
        """Test detection of tampered commitments"""
        test_data = {"command": "echo test"}
        different_data = {"command": "echo different"}
        
        commitment = self.validator.create_commitment(test_data)
        result = self.validator.validate_commitment(commitment, different_data)
        
        assert result == ValidationResult.REJECTED, "Should reject tampered commitment"
        
        print("✅ Tampered commitment detection: PASS")

class TestAuditChain:
    """Test the AuditChain component"""
    
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        self.chain = AuditChain(audit_dir=temp_dir)
    
    def test_entry_addition(self):
        """Test adding entries to audit chain"""
        validator = ByzantineValidator(audit_dir=self.temp_dir)
        commitment = validator.create_commitment({"test": "data"})
        
        entry = self.chain.add_entry(commitment=commitment)
        
        assert entry.entry_id.startswith("audit_"), "Should have proper entry ID"
        assert len(entry.chain_hash) == 64, "Should have SHA256 chain hash"
        assert entry.commitment == commitment, "Should store commitment correctly"
        
        print("✅ Audit entry addition: PASS")
    
    def test_chain_integrity(self):
        """Test audit chain integrity verification"""
        # Add multiple entries
        validator = ByzantineValidator(audit_dir=self.temp_dir)
        
        for i in range(3):
            commitment = validator.create_commitment({"test": f"data_{i}"})
            self.chain.add_entry(commitment=commitment)
        
        is_valid, errors = self.chain.verify_chain_integrity()
        
        assert is_valid, f"Chain should be valid, errors: {errors}"
        assert len(errors) == 0, "Should have no integrity errors"
        
        print("✅ Chain integrity verification: PASS")

class TestClaudeCodeIntegration:
    """Test Claude Code integration"""
    
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        self.hook = ClaudeCodeHook(
            security_level=SecurityLevel.FAIL_SECURE,
            audit_dir=temp_dir
        )
    
    def test_tool_call_analysis(self):
        """Test Claude Code tool call analysis"""
        # Test with secret
        secret_call = {
            "tool_name": "Bash",
            "tool_input": {"command": "export API_KEY=sk-1234567890abcdef1234567890abcdef1234567890"}
        }
        
        should_block, analysis = self.hook.analyze_tool_call(secret_call)
        
        assert should_block, "Should block tool call with secrets"
        assert len(analysis["secrets_found"]) > 0, "Should find secrets"
        assert analysis["commitment"] is not None, "Should create commitment"
        
        # Test with safe content
        safe_call = {
            "tool_name": "Bash",
            "tool_input": {"command": "echo hello"}
        }
        
        should_block, analysis = self.hook.analyze_tool_call(safe_call)
        
        assert not should_block, "Should not block safe tool call"
        assert len(analysis["secrets_found"]) == 0, "Should find no secrets"
        
        print("✅ Claude Code tool call analysis: PASS")

class TestCrewAIIntegration:
    """Test CrewAI integration"""
    
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir
        self.agent = CrewAIAccountabilityAgent(audit_dir=temp_dir)
    
    def test_agent_action_validation(self):
        """Test CrewAI agent action validation"""
        # Test safe action
        safe_action = {
            "action": "analyze_data",
            "parameters": {"data": "safe content"}
        }
        
        is_valid, result = self.agent.validate_agent_action(safe_action)
        
        assert is_valid, "Should validate safe agent action"
        assert len(result["secrets_found"]) == 0, "Should find no secrets"
        
        # Test action with secrets
        secret_action = {
            "action": "connect_database",
            "parameters": {"url": "postgres://user:secret123@localhost/db"}
        }
        
        is_valid, result = self.agent.validate_agent_action(secret_action)
        
        assert not is_valid, "Should not validate action with secrets"
        assert len(result["secrets_found"]) > 0, "Should find secrets"
        
        print("✅ CrewAI agent validation: PASS")
    
    def test_accountability_report(self):
        """Test accountability report generation"""
        actions = [
            {"action": "safe_task", "data": "clean"},
            {"action": "risky_task", "api_key": "sk-1234567890abcdef1234567890abcdef1234567890"}
        ]
        
        report = self.agent.create_accountability_report(actions)
        
        assert report["total_actions"] == 2, "Should count all actions"
        assert report["valid_actions"] == 1, "Should identify one valid action"
        assert report["invalid_actions"] == 1, "Should identify one invalid action"
        assert 0 <= report["success_rate"] <= 1, "Should calculate success rate"
        
        print("✅ CrewAI accountability report: PASS")

def run_all_tests():
    """Run comprehensive library test suite"""
    print("🔒 Zero-Trust Security Library Test Suite")
    print("=" * 50)
    
    # Create temporary directory for tests
    temp_dir = tempfile.mkdtemp(prefix="zero_trust_test_")
    
    try:
        # Initialize test classes
        secret_tests = TestSecretDetector(temp_dir)
        byzantine_tests = TestByzantineValidator(temp_dir)
        chain_tests = TestAuditChain(temp_dir)
        claude_tests = TestClaudeCodeIntegration(temp_dir)
        crew_tests = TestCrewAIIntegration(temp_dir)
        
        # Run all tests
        test_methods = [
            (secret_tests, ["test_secret_detection", "test_safe_content", "test_custom_patterns"]),
            (byzantine_tests, ["test_commitment_creation", "test_commitment_validation", "test_tampered_commitment"]),
            (chain_tests, ["test_entry_addition", "test_chain_integrity"]),
            (claude_tests, ["test_tool_call_analysis"]),
            (crew_tests, ["test_agent_action_validation", "test_accountability_report"])
        ]
        
        passed = 0
        total = 0
        
        for test_instance, methods in test_methods:
            for method_name in methods:
                total += 1
                try:
                    method = getattr(test_instance, method_name)
                    method()
                    passed += 1
                except Exception as e:
                    print(f"❌ {method_name}: FAIL - {e}")
        
        print("\n" + "=" * 50)
        print(f"📊 Library Test Results: {passed}/{total} passed")
        
        if passed == total:
            print("🏆 ALL LIBRARY TESTS PASSED! Zero-trust implementation validated.")
            return 0
        else:
            print("⚠️  Some library tests failed.")
            return 1
            
    finally:
        # Cleanup
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    sys.exit(run_all_tests())