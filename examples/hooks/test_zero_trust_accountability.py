#!/usr/bin/env python3
"""
Test Suite for Zero-Trust Environment Variable Accountability System

This test suite validates the recursive AI accountability implementation
for Claude Code's zero-trust environment variable security.

Run with: python3 test_zero_trust_accountability.py
"""

import json
import os
import tempfile
import unittest
from pathlib import Path
import hashlib
import time
from unittest.mock import patch

# Import our accountability system
from zero_trust_env_accountability import (
    ZeroTrustEnvironmentAccountability,
    CryptographicCommitment,
    EnvironmentAccessAuditEntry
)


class TestZeroTrustAccountability(unittest.TestCase):
    """Test the zero-trust environment variable accountability system."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.audit_file = Path(self.temp_dir) / "test_audit.jsonl"
        self.accountability = ZeroTrustEnvironmentAccountability(str(self.audit_file))
        
    def tearDown(self):
        """Clean up test environment."""
        if self.audit_file.exists():
            self.audit_file.unlink()
            
    def test_secret_detection_patterns(self):
        """Test detection of various secret patterns."""
        test_cases = [
            ("sk-1234567890123456789012345678901234567890123456", "OpenAI API Key"),
            ("xoxb-123-456-789-abcdef123456", "Slack Bot Token"),
            ("ghp_abcdefghijklmnopqrstuvwxyz0123456789", "GitHub Personal Access Token"),
            ("AKIAIOSFODNN7EXAMPLE", "AWS Access Key"),
            ("postgres://user:pass@localhost:5432/db", "PostgreSQL Connection String"),
            ("not_a_secret", None)  # Should not detect
        ]
        
        for value, expected_type in test_cases:
            detected = self.accountability.detect_secrets_in_value(value)
            if expected_type:
                self.assertTrue(len(detected) > 0, f"Should detect secret in: {value}")
                self.assertTrue(
                    any(expected_type in secret_type for _, secret_type in detected),
                    f"Should detect {expected_type} in {value}"
                )
            else:
                self.assertEqual(len(detected), 0, f"Should not detect secret in: {value}")
                
    def test_sensitive_env_var_detection(self):
        """Test detection of sensitive environment variable names."""
        sensitive_vars = [
            "API_KEY", "SECRET_KEY", "PASSWORD", "TOKEN", "PRIVATE_KEY",
            "DATABASE_URL", "db_password", "redis_url", "MY_API_KEY"
        ]
        
        non_sensitive_vars = [
            "PATH", "HOME", "USER", "LANG", "TZ", "DEBUG_MODE"
        ]
        
        for var in sensitive_vars:
            self.assertTrue(
                self.accountability.is_sensitive_env_var(var),
                f"Should detect {var} as sensitive"
            )
            
        for var in non_sensitive_vars:
            self.assertFalse(
                self.accountability.is_sensitive_env_var(var),
                f"Should not detect {var} as sensitive"
            )
            
    def test_cryptographic_commitment_creation(self):
        """Test cryptographic commitment creation."""
        var_name = "TEST_API_KEY"
        secret_value = "sk-1234567890123456789012345678901234567890123456"
        tool_context = {"tool_name": "Bash", "parameter": "command"}
        
        commitment = self.accountability.create_cryptographic_commitment(
            var_name, secret_value, tool_context
        )
        
        # Verify commitment structure
        self.assertIsInstance(commitment, CryptographicCommitment)
        self.assertEqual(len(commitment.commitment_id), 16)
        self.assertEqual(len(commitment.original_hash), 64)  # SHA256 hex
        self.assertTrue(commitment.masked_value.startswith("<MASKED_"))
        self.assertIsInstance(commitment.timestamp, str)
        self.assertEqual(len(commitment.validation_proof), 64)  # SHA256 hex
        
        # Verify the original secret is not stored
        self.assertNotIn(secret_value, commitment.masked_value)
        self.assertNotIn(secret_value, commitment.original_hash)
        self.assertNotIn(secret_value, str(commitment.context))
        
    def test_tool_input_processing_env_var_masking(self):
        """Test processing tool input with environment variable masking."""
        # Set up test environment variable
        test_secret = "sk-test123456789012345678901234567890123456789"
        with patch.dict(os.environ, {"TEST_SECRET": test_secret}):
            tool_input = {
                "command": "echo $TEST_SECRET",
                "description": "Test command"
            }
            
            modified_input = self.accountability.process_tool_input(tool_input, "Bash")
            
            # Verify the secret was masked
            self.assertNotIn(test_secret, str(modified_input))
            self.assertIn("<MASKED_", modified_input["command"])
            
            # Verify audit entry was created
            self.assertTrue(self.audit_file.exists())
            
    def test_tool_input_processing_embedded_secrets(self):
        """Test processing tool input with embedded secrets."""
        tool_input = {
            "command": "curl -H 'Authorization: sk-1234567890123456789012345678901234567890123456'",
            "description": "Test API call"
        }
        
        modified_input = self.accountability.process_tool_input(tool_input, "Bash")
        
        # Verify the embedded secret was masked
        self.assertNotIn("sk-1234567890123456789012345678901234567890123456", str(modified_input))
        self.assertIn("<MASKED_", modified_input["command"])
        
    def test_audit_trail_integrity(self):
        """Test audit trail integrity validation."""
        # Create some test audit entries
        commitment = CryptographicCommitment(
            commitment_id="test123",
            original_hash="hash123",
            masked_value="<MASKED_TEST>",
            timestamp="2025-01-01T00:00:00",
            context={"test": "data"},
            validation_proof="proof123"
        )
        
        audit_entry = EnvironmentAccessAuditEntry(
            timestamp="2025-01-01T00:00:00",
            variable_name="TEST_VAR",
            access_type="masked",
            commitment=commitment,
            tool_context={"tool_name": "Test"},
            integrity_hash=""
        )
        
        # Add to audit log
        self.accountability.audit_environment_access(audit_entry)
        
        # Validate integrity
        validation_result = self.accountability.validate_audit_integrity()
        
        self.assertEqual(validation_result["status"], "validated")
        self.assertEqual(validation_result["total_entries"], 1)
        self.assertEqual(validation_result["valid_entries"], 1)
        self.assertEqual(validation_result["invalid_entries"], 0)
        self.assertTrue(validation_result["valid"])
        
    def test_audit_trail_tamper_detection(self):
        """Test detection of tampered audit entries."""
        # Create audit entry
        commitment = CryptographicCommitment(
            commitment_id="test123",
            original_hash="hash123", 
            masked_value="<MASKED_TEST>",
            timestamp="2025-01-01T00:00:00",
            context={"test": "data"},
            validation_proof="proof123"
        )
        
        audit_entry = EnvironmentAccessAuditEntry(
            timestamp="2025-01-01T00:00:00",
            variable_name="TEST_VAR",
            access_type="masked",
            commitment=commitment,
            tool_context={"tool_name": "Test"},
            integrity_hash=""
        )
        
        self.accountability.audit_environment_access(audit_entry)
        
        # Manually tamper with the audit file
        with open(self.audit_file, 'r') as f:
            content = f.read()
            
        # Change the variable name (tampering)
        tampered_content = content.replace('"TEST_VAR"', '"TAMPERED_VAR"')
        
        with open(self.audit_file, 'w') as f:
            f.write(tampered_content)
            
        # Validate - should detect tampering
        validation_result = self.accountability.validate_audit_integrity()
        
        self.assertEqual(validation_result["status"], "validated")
        self.assertEqual(validation_result["invalid_entries"], 1)
        self.assertFalse(validation_result["valid"])
        self.assertEqual(
            validation_result["invalid_details"][0]["reason"], 
            "integrity_hash_mismatch"
        )
        
    def test_recursive_accountability_validation(self):
        """Test recursive validation of the accountability system itself."""
        # This tests the meta-validation capability
        var_name = "RECURSIVE_TEST"
        secret_value = "sk-recursive123456789012345678901234567890123"
        tool_context = {"tool_name": "AccountabilityValidator"}
        
        commitment1 = self.accountability.create_cryptographic_commitment(
            var_name, secret_value, tool_context
        )
        
        commitment2 = self.accountability.create_cryptographic_commitment(
            var_name, secret_value, tool_context
        )
        
        # Different commitments should have different IDs (time-based)
        self.assertNotEqual(commitment1.commitment_id, commitment2.commitment_id)
        
        # But same secret should produce same hash
        self.assertEqual(commitment1.original_hash, commitment2.original_hash)
        
        # Validation proofs should be different (time-based)
        self.assertNotEqual(commitment1.validation_proof, commitment2.validation_proof)


class TestIntegrationScenarios(unittest.TestCase):
    """Integration tests for real-world scenarios."""
    
    def setUp(self):
        """Set up integration test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.audit_file = Path(self.temp_dir) / "integration_audit.jsonl"
        self.accountability = ZeroTrustEnvironmentAccountability(str(self.audit_file))
        
    def test_healthcare_compliance_scenario(self):
        """Test healthcare compliance scenario with PHI protection."""
        # Simulate healthcare environment with sensitive data
        healthcare_secrets = {
            "HIPAA_DATABASE_URL": "postgres://phi_user:secret_pass@hipaa-db:5432/patient_data",
            "PHI_ENCRYPTION_KEY": "AES256-healthcare-key-12345678901234567890",
            "FHIR_API_KEY": "sk-fhir123456789012345678901234567890123456789"
        }
        
        with patch.dict(os.environ, healthcare_secrets):
            # Test various tool inputs that might access PHI
            tool_inputs = [
                {
                    "command": "psql $HIPAA_DATABASE_URL -c 'SELECT * FROM patients'",
                    "tool_name": "Bash"
                },
                {
                    "api_key": "$FHIR_API_KEY",
                    "endpoint": "https://fhir.example.com/Patient",
                    "tool_name": "HTTPRequest"
                },
                {
                    "encryption_key": "$PHI_ENCRYPTION_KEY",
                    "data_file": "patient_records.csv",
                    "tool_name": "DataProcessor"
                }
            ]
            
            masked_outputs = []
            for tool_input in tool_inputs:
                tool_name = tool_input.pop("tool_name")
                modified = self.accountability.process_tool_input(tool_input, tool_name)
                masked_outputs.append(modified)
                
            # Verify all secrets were masked
            for output in masked_outputs:
                output_str = str(output)
                for secret_value in healthcare_secrets.values():
                    self.assertNotIn(secret_value, output_str)
                    
            # Verify comprehensive audit trail
            validation_result = self.accountability.validate_audit_integrity()
            self.assertTrue(validation_result["valid"])
            self.assertGreaterEqual(validation_result["total_entries"], 3)
            
    def test_financial_trading_scenario(self):
        """Test financial trading scenario with API key protection."""
        trading_secrets = {
            "TRADING_API_KEY": "sk-trading789012345678901234567890123456789012",
            "BROKER_PASSWORD": "super-secret-broker-pass-2024",
            "MARKET_DATA_TOKEN": "md_token_abcdefghijklmnopqrstuvwxyz123456"
        }
        
        with patch.dict(os.environ, trading_secrets):
            tool_input = {
                "command": f"python3 trading_bot.py --api-key $TRADING_API_KEY --password $BROKER_PASSWORD",
                "timeout": 300
            }
            
            modified = self.accountability.process_tool_input(tool_input, "Bash")
            
            # Verify secrets were masked
            for secret in trading_secrets.values():
                self.assertNotIn(secret, str(modified))
                
            # Should have masked placeholders
            self.assertIn("<MASKED_", str(modified))
            
            # Verify audit compliance
            validation_result = self.accountability.validate_audit_integrity()
            self.assertTrue(validation_result["valid"])


def run_comprehensive_demo():
    """Run a comprehensive demonstration of the accountability system."""
    print("🔒 Zero-Trust Environment Variable Accountability System Demo")
    print("=" * 70)
    
    # Create demo accountability system
    demo_dir = Path.home() / ".claude-code-demo"
    demo_dir.mkdir(exist_ok=True)
    audit_file = demo_dir / "demo_audit.jsonl"
    
    accountability = ZeroTrustEnvironmentAccountability(str(audit_file))
    
    print(f"📁 Demo audit file: {audit_file}")
    print()
    
    # Demo 1: Environment variable masking
    print("Demo 1: Environment Variable Masking")
    print("-" * 40)
    
    demo_secrets = {
        "DEMO_API_KEY": "sk-demo123456789012345678901234567890123456789",
        "DEMO_DB_URL": "postgres://user:secret@localhost:5432/demo",
        "DEMO_TOKEN": "ghp_demotoken123456789012345678901234567890"
    }
    
    with patch.dict(os.environ, demo_secrets):
        tool_input = {
            "command": "echo 'API Key: $DEMO_API_KEY' && psql $DEMO_DB_URL",
            "description": "Demo command with secrets"
        }
        
        print(f"Original input: {tool_input}")
        modified = accountability.process_tool_input(tool_input, "Bash")
        print(f"Masked input: {modified}")
        print()
        
    # Demo 2: Embedded secret detection
    print("Demo 2: Embedded Secret Detection")
    print("-" * 40)
    
    tool_input = {
        "headers": {
            "Authorization": "Bearer sk-embedded123456789012345678901234567890123456",
            "X-API-Key": "another-secret-key-12345"
        },
        "url": "https://api.example.com/data"
    }
    
    print(f"Original input: {tool_input}")
    modified = accountability.process_tool_input(tool_input, "HTTPRequest")
    print(f"Masked input: {modified}")
    print()
    
    # Demo 3: Audit trail validation
    print("Demo 3: Audit Trail Validation")
    print("-" * 40)
    
    validation_result = accountability.validate_audit_integrity()
    print(f"Audit validation: {json.dumps(validation_result, indent=2)}")
    print()
    
    print("✅ Demo completed successfully!")
    print(f"📊 Check audit trail at: {audit_file}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        run_comprehensive_demo()
    else:
        # Run unit tests
        unittest.main(verbosity=2)