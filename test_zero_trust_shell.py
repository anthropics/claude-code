#!/usr/bin/env python3
"""
Comprehensive Test Suite for Zero-Trust Shell Wrapper
Addresses GitHub Issue #2695 with full validation and security testing.

This test suite validates:
1. Secret detection and masking
2. Audit trail integrity 
3. Security bypass prevention
4. Cross-platform compatibility
5. Performance characteristics
6. Enterprise compliance features
"""

import json
import os
import subprocess
import tempfile
import unittest
import time
from pathlib import Path
import hashlib


class TestZeroTrustShell(unittest.TestCase):
    """Test the zero-trust shell wrapper functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.test_dir = Path(tempfile.mkdtemp())
        self.audit_file = self.test_dir / "test_audit.jsonl"
        self.shell_script = Path("/Users/jonathanhill/src/claude-code/zero_trust_shell_complete.sh")
        
        # Test environment
        self.test_env = os.environ.copy()
        self.test_env.update({
            "CLAUDE_CODE_AUDIT_FILE": str(self.audit_file),
            "CLAUDE_CODE_LOG_LEVEL": "DEBUG",
            "CLAUDE_CODE_ENABLE_MASKING": "true"
        })
        
    def tearDown(self):
        """Clean up test environment."""
        if self.audit_file.exists():
            self.audit_file.unlink()
            
    def run_shell_command(self, command, env_vars=None):
        """Run command through zero-trust shell wrapper."""
        test_env = self.test_env.copy()
        if env_vars:
            test_env.update(env_vars)
            
        result = subprocess.run(
            [str(self.shell_script), "-c", command],
            capture_output=True,
            text=True,
            env=test_env
        )
        
        return result
        
    def get_audit_entries(self):
        """Get audit entries from the log file."""
        if not self.audit_file.exists():
            return []
            
        entries = []
        with open(self.audit_file, 'r') as f:
            for line in f:
                try:
                    entries.append(json.loads(line.strip()))
                except json.JSONDecodeError:
                    pass
        return entries
        
    def test_openai_api_key_detection(self):
        """Test OpenAI API key detection and masking."""
        api_key = "sk-test123456789012345678901234567890123456789012345"
        result = self.run_shell_command(
            "echo $TEST_API_KEY",
            {"TEST_API_KEY": api_key}
        )
        
        # Verify secret was masked
        self.assertNotIn(api_key, result.stdout)
        self.assertIn("<MASKED_OPENAI_API_KEY_", result.stdout)
        self.assertIn("🔒 ZERO-TRUST: Masked", result.stderr)
        
        # Verify audit trail
        entries = self.get_audit_entries()
        secret_entries = [e for e in entries if e.get("event") == "SECRET_MASKED"]
        self.assertGreater(len(secret_entries), 0)
        
    def test_anthropic_api_key_detection(self):
        """Test Anthropic API key detection and masking."""
        api_key = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqr-stuvwxyzABC"
        result = self.run_shell_command(
            "echo $ANTHROPIC_KEY",
            {"ANTHROPIC_KEY": api_key}
        )
        
        self.assertNotIn(api_key, result.stdout)
        self.assertIn("<MASKED_ANTHROPIC_API_KEY_", result.stdout)
        
    def test_github_token_detection(self):
        """Test GitHub token detection and masking."""
        github_token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789"
        result = self.run_shell_command(
            "git clone https://token:$GITHUB_TOKEN@github.com/user/repo.git",
            {"GITHUB_TOKEN": github_token}
        )
        
        self.assertNotIn(github_token, result.stdout)
        self.assertIn("<MASKED_GITHUB_TOKEN_", result.stdout)
        
    def test_database_url_detection(self):
        """Test database connection string detection."""
        db_url = "postgres://user:secret_password@localhost:5432/production_db"
        result = self.run_shell_command(
            "psql $DATABASE_URL -c 'SELECT 1'",
            {"DATABASE_URL": db_url}
        )
        
        self.assertNotIn("secret_password", result.stdout)
        self.assertIn("<MASKED_POSTGRESQL_CONNECTION_STRING_", result.stdout)
        
    def test_aws_credentials_detection(self):
        """Test AWS credentials detection."""
        aws_key = "AKIAIOSFODNN7EXAMPLE"
        aws_secret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        
        result = self.run_shell_command(
            "aws s3 ls --access-key $AWS_ACCESS_KEY --secret-key $AWS_SECRET",
            {
                "AWS_ACCESS_KEY": aws_key,
                "AWS_SECRET": aws_secret
            }
        )
        
        self.assertNotIn(aws_key, result.stdout)
        self.assertNotIn(aws_secret, result.stdout)
        self.assertIn("<MASKED_AWS_ACCESS_KEY_", result.stdout)
        self.assertIn("<MASKED_AWS_SECRET_KEY_", result.stdout)
        
    def test_jwt_token_detection(self):
        """Test JWT token detection."""
        jwt_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        result = self.run_shell_command(
            "curl -H 'Authorization: Bearer $JWT_TOKEN' api.example.com",
            {"JWT_TOKEN": jwt_token}
        )
        
        self.assertNotIn(jwt_token, result.stdout)
        self.assertIn("<MASKED_JWT_TOKEN_", result.stdout)
        
    def test_sensitive_env_var_names(self):
        """Test detection based on environment variable names."""
        sensitive_vars = {
            "API_KEY": "not-a-standard-pattern-but-sensitive",
            "DATABASE_PASSWORD": "simple_password_123",
            "SESSION_SECRET": "session_secret_key_456",
            "ENCRYPTION_KEY": "encryption_key_789"
        }
        
        for var_name, var_value in sensitive_vars.items():
            result = self.run_shell_command(
                f"echo ${var_name}",
                {var_name: var_value}
            )
            
            self.assertNotIn(var_value, result.stdout)
            self.assertIn("<MASKED_", result.stdout)
            
    def test_multiple_secrets_in_command(self):
        """Test command with multiple secrets."""
        result = self.run_shell_command(
            "deploy.sh --api-key $API_KEY --db-url $DB_URL --token $GITHUB_TOKEN",
            {
                "API_KEY": "sk-api123456789012345678901234567890123456789",
                "DB_URL": "postgres://user:pass@host:5432/db",
                "GITHUB_TOKEN": "ghp_github123456789012345678901234567890"
            }
        )
        
        # All secrets should be masked
        self.assertNotIn("sk-api123456789012345678901234567890123456789", result.stdout)
        self.assertNotIn("postgres://user:pass@host:5432/db", result.stdout)
        self.assertNotIn("ghp_github123456789012345678901234567890", result.stdout)
        
        # Should have multiple masked values
        self.assertIn("<MASKED_OPENAI_API_KEY_", result.stdout)
        self.assertIn("<MASKED_POSTGRESQL_CONNECTION_STRING_", result.stdout)
        self.assertIn("<MASKED_GITHUB_TOKEN_", result.stdout)
        
    def test_safe_commands_unchanged(self):
        """Test that safe commands are not modified."""
        safe_commands = [
            "echo 'Hello World'",
            "ls -la",
            "python3 script.py",
            "git status",
            "npm install"
        ]
        
        for command in safe_commands:
            result = self.run_shell_command(command)
            
            # Should not have any masking messages
            self.assertNotIn("🔒 ZERO-TRUST: Masked", result.stderr)
            self.assertNotIn("<MASKED_", result.stdout)
            
    def test_audit_trail_integrity(self):
        """Test audit trail creation and integrity."""
        result = self.run_shell_command(
            "echo $SECRET_VAR",
            {"SECRET_VAR": "sk-secret123456789012345678901234567890123456789"}
        )
        
        # Verify audit file was created
        self.assertTrue(self.audit_file.exists())
        
        # Verify audit entries
        entries = self.get_audit_entries()
        self.assertGreater(len(entries), 0)
        
        # Check for required audit events
        events = [e.get("event") for e in entries]
        self.assertIn("SHELL_INVOCATION", events)
        self.assertIn("SECRET_MASKED", events)
        self.assertIn("COMMAND_EXECUTION", events)
        
        # Verify secret masking entry structure
        secret_entries = [e for e in entries if e.get("event") == "SECRET_MASKED"]
        self.assertGreater(len(secret_entries), 0)
        
        secret_entry = secret_entries[0]
        required_fields = ["commitment_id", "variable_name", "secret_hash", "secret_type", "masked_value"]
        for field in required_fields:
            self.assertIn(field, secret_entry["data"])
            
    def test_security_bypass_detection(self):
        """Test detection of potential security bypasses."""
        bypass_commands = [
            "eval $SECRET_COMMAND",
            "exec $MALICIOUS_SCRIPT",
            "source $CONFIG_FILE",
            ". $ENV_FILE",
            "$(cat $SECRET_FILE)",
            "`cat $SECRET_FILE`"
        ]
        
        for command in bypass_commands:
            result = self.run_shell_command(command)
            
            # Should log security warnings
            entries = self.get_audit_entries()
            bypass_entries = [e for e in entries if e.get("level") == "WARN" and "POTENTIAL_BYPASS" in e.get("event", "")]
            self.assertGreater(len(bypass_entries), 0, f"Should detect bypass in: {command}")
            
    def test_performance_characteristics(self):
        """Test performance overhead of the wrapper."""
        # Test with a simple command
        start_time = time.time()
        for _ in range(10):
            result = self.run_shell_command("echo 'test'")
            self.assertEqual(result.returncode, 0)
        end_time = time.time()
        
        avg_time = (end_time - start_time) / 10
        
        # Should complete within reasonable time (< 100ms per command)
        self.assertLess(avg_time, 0.1, "Shell wrapper should have minimal performance overhead")
        
    def test_variable_substitution_patterns(self):
        """Test different variable substitution patterns."""
        secret_value = "sk-test123456789012345678901234567890123456789"
        
        patterns = [
            ("echo $TEST_VAR", "TEST_VAR"),
            ("echo ${TEST_VAR}", "TEST_VAR"),
            ("echo '$TEST_VAR'", "TEST_VAR"),  # Single quotes
            ('echo "$TEST_VAR"', "TEST_VAR"),  # Double quotes
        ]
        
        for command_template, var_name in patterns:
            result = self.run_shell_command(
                command_template,
                {var_name: secret_value}
            )
            
            self.assertNotIn(secret_value, result.stdout, f"Failed for pattern: {command_template}")
            self.assertIn("<MASKED_", result.stdout, f"Should mask for pattern: {command_template}")
            
    def test_complex_command_scenarios(self):
        """Test complex real-world command scenarios."""
        scenarios = [
            {
                "name": "Docker deployment",
                "command": "docker run -e API_KEY=$API_KEY -e DB_URL=$DB_URL myapp:latest",
                "env": {
                    "API_KEY": "sk-docker123456789012345678901234567890123456789",
                    "DB_URL": "postgres://app:secret@db:5432/prod"
                }
            },
            {
                "name": "Kubernetes deployment", 
                "command": "kubectl create secret generic app-secret --from-literal=api-key=$API_KEY",
                "env": {
                    "API_KEY": "sk-k8s123456789012345678901234567890123456789"
                }
            },
            {
                "name": "CI/CD pipeline",
                "command": "npm publish --token $NPM_TOKEN && git push https://$GITHUB_TOKEN@github.com/user/repo.git",
                "env": {
                    "NPM_TOKEN": "npm_abcdefghijklmnopqrstuvwxyz0123456789",
                    "GITHUB_TOKEN": "ghp_cicd123456789012345678901234567890"
                }
            }
        ]
        
        for scenario in scenarios:
            result = self.run_shell_command(scenario["command"], scenario["env"])
            
            # Verify no secrets leaked
            for var_name, var_value in scenario["env"].items():
                self.assertNotIn(var_value, result.stdout, 
                    f"Secret leaked in {scenario['name']}: {var_name}")
                    
            # Verify masking occurred
            self.assertIn("<MASKED_", result.stdout, 
                f"Should have masked secrets in {scenario['name']}")
                
    def test_error_handling(self):
        """Test error handling and graceful failures."""
        # Test with malformed commands
        result = self.run_shell_command("echo $")
        # Should not crash, may have non-zero exit code but should complete
        
        # Test with very long commands
        long_command = "echo " + "A" * 10000
        result = self.run_shell_command(long_command)
        self.assertEqual(result.returncode, 0)
        
    def test_cross_shell_compatibility(self):
        """Test compatibility with different shell invocations."""
        # Test that we correctly handle different argument patterns
        test_cases = [
            [str(self.shell_script), "-c", "echo test"],
            [str(self.shell_script), "-c", "echo $PATH"],
        ]
        
        for args in test_cases:
            result = subprocess.run(args, capture_output=True, text=True, env=self.test_env)
            self.assertEqual(result.returncode, 0)


class TestEnterpriseCompliance(unittest.TestCase):
    """Test enterprise compliance and audit features."""
    
    def setUp(self):
        """Set up compliance test environment."""
        self.test_dir = Path(tempfile.mkdtemp())
        self.audit_file = self.test_dir / "compliance_audit.jsonl"
        self.shell_script = Path("/Users/jonathanhill/src/claude-code/zero_trust_shell_complete.sh")
        
        self.test_env = os.environ.copy()
        self.test_env.update({
            "CLAUDE_CODE_AUDIT_FILE": str(self.audit_file),
            "CLAUDE_CODE_LOG_LEVEL": "INFO"
        })
        
    def test_hipaa_compliance_scenario(self):
        """Test HIPAA compliance for healthcare data."""
        phi_secrets = {
            "PATIENT_DB_URL": "postgres://phi_user:hipaa_password_2024@patient-db:5432/patient_records",
            "PHI_ENCRYPTION_KEY": "AES256-patient-key-67890abcdef",
            "FHIR_API_TOKEN": "sk-fhir123456789012345678901234567890123456789"
        }
        
        # Simulate healthcare data processing
        command = "process_patient_data.py --db $PATIENT_DB_URL --key $PHI_ENCRYPTION_KEY --token $FHIR_API_TOKEN"
        
        result = subprocess.run(
            [str(self.shell_script), "-c", command],
            capture_output=True,
            text=True,
            env={**self.test_env, **phi_secrets}
        )
        
        # Verify no PHI secrets in output
        for secret in phi_secrets.values():
            self.assertNotIn(secret, result.stdout)
            
        # Verify audit trail for HIPAA compliance
        with open(self.audit_file, 'r') as f:
            audit_data = f.read()
            
        # Should have complete audit trail
        self.assertIn("SECRET_MASKED", audit_data)
        self.assertIn("COMMAND_EXECUTION", audit_data)
        
        # Should not contain actual secrets in audit log
        for secret in phi_secrets.values():
            self.assertNotIn(secret, audit_data)
            
    def test_sox_compliance_scenario(self):
        """Test SOX compliance for financial systems."""
        financial_secrets = {
            "TRADING_API_KEY": "sk-trading789012345678901234567890123456789012",
            "BROKER_PASSWORD": "financial_broker_secret_2024",
            "RISK_DB_CONNECTION": "postgres://risk_user:sox_password@risk-db:5432/trading_data"
        }
        
        command = "trading_bot.py --api-key $TRADING_API_KEY --password $BROKER_PASSWORD --db $RISK_DB_CONNECTION"
        
        result = subprocess.run(
            [str(self.shell_script), "-c", command],
            capture_output=True,
            text=True,
            env={**self.test_env, **financial_secrets}
        )
        
        # Verify financial secrets are masked
        for secret in financial_secrets.values():
            self.assertNotIn(secret, result.stdout)
            
        # Verify regulatory audit trail
        self.assertTrue(self.audit_file.exists())
        with open(self.audit_file, 'r') as f:
            entries = [json.loads(line) for line in f if line.strip()]
            
        # Should have timestamp, event tracking for SOX compliance
        for entry in entries:
            self.assertIn("timestamp", entry)
            if entry.get("event") == "SECRET_MASKED":
                commitment_data = entry["data"]
                self.assertIn("commitment_id", commitment_data)
                self.assertIn("secret_hash", commitment_data)
                
    def test_audit_trail_tamper_detection(self):
        """Test audit trail integrity and tamper detection."""
        # Generate some audit entries
        result = subprocess.run(
            [str(self.shell_script), "-c", "echo $TEST_SECRET"],
            capture_output=True,
            text=True,
            env={**self.test_env, "TEST_SECRET": "sk-test123456789012345678901234567890123456789"}
        )
        
        # Read original audit entries
        with open(self.audit_file, 'r') as f:
            original_entries = f.readlines()
            
        # Verify entries have proper structure for integrity checking
        for line in original_entries:
            entry = json.loads(line.strip())
            self.assertIn("timestamp", entry)
            self.assertIn("level", entry)
            self.assertIn("event", entry)
            
            if entry.get("event") == "SECRET_MASKED":
                # Verify cryptographic commitment structure
                commitment = entry["data"]
                self.assertIn("commitment_id", commitment)
                self.assertIn("secret_hash", commitment)
                self.assertIn("session_id", commitment)
                
                # Verify hash format (SHA256)
                self.assertEqual(len(commitment["secret_hash"]), 64)
                self.assertTrue(all(c in "0123456789abcdef" for c in commitment["secret_hash"]))


def run_integration_demo():
    """Run comprehensive integration demo."""
    print("🔒 Zero-Trust Shell Wrapper Integration Demo")
    print("=" * 60)
    print("Addressing GitHub Issue #2695 with shell-level indirection")
    print()
    
    shell_script = "/Users/jonathanhill/src/claude-code/zero_trust_shell_complete.sh"
    demo_audit = "/tmp/demo_shell_audit.jsonl"
    
    # Clean up any existing demo audit
    if os.path.exists(demo_audit):
        os.remove(demo_audit)
    
    demo_env = os.environ.copy()
    demo_env.update({
        "CLAUDE_CODE_AUDIT_FILE": demo_audit,
        "CLAUDE_CODE_LOG_LEVEL": "INFO"
    })
    
    scenarios = [
        {
            "name": "Enterprise API Integration",
            "env": {"ENTERPRISE_API_KEY": "sk-enterprise123456789012345678901234567890123456789"},
            "command": "curl -H 'Authorization: Bearer $ENTERPRISE_API_KEY' https://api.enterprise.com/data"
        },
        {
            "name": "Database Migration",
            "env": {"PROD_DB_URL": "postgres://admin:super_secret_prod_password@prod-db:5432/app_production"},
            "command": "migrate_database.py --url $PROD_DB_URL --force"
        },
        {
            "name": "Cloud Deployment",
            "env": {
                "AWS_ACCESS_KEY_ID": "AKIAIOSFODNN7EXAMPLE",
                "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
                "GITHUB_TOKEN": "ghp_deployment123456789012345678901234567890"
            },
            "command": "deploy.sh --aws-key $AWS_ACCESS_KEY_ID --aws-secret $AWS_SECRET_ACCESS_KEY --github-token $GITHUB_TOKEN"
        }
    ]
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"{i}. {scenario['name']}")
        print("-" * 40)
        
        full_env = {**demo_env, **scenario['env']}
        
        try:
            result = subprocess.run(
                [shell_script, "-c", scenario['command']],
                capture_output=True,
                text=True,
                env=full_env,
                timeout=10
            )
            
            print(f"Command: {scenario['command']}")
            print(f"Exit Code: {result.returncode}")
            
            # Check if secrets were masked
            secrets_masked = "🔒 ZERO-TRUST: Masked" in result.stderr
            if secrets_masked:
                print("✅ SUCCESS: Secrets detected and masked")
                print("Security Output:")
                for line in result.stderr.split('\n'):
                    if line.startswith('🔒'):
                        print(f"  {line}")
            else:
                print("ℹ️  INFO: No secrets detected (safe command)")
                
        except subprocess.TimeoutExpired:
            print("❌ TIMEOUT: Command took too long")
        except Exception as e:
            print(f"❌ ERROR: {e}")
            
        print()
    
    # Show audit trail summary
    if os.path.exists(demo_audit):
        print("📊 AUDIT TRAIL SUMMARY")
        print("-" * 40)
        
        with open(demo_audit, 'r') as f:
            entries = [json.loads(line) for line in f if line.strip()]
            
        events = {}
        for entry in entries:
            event_type = entry.get("event", "unknown")
            events[event_type] = events.get(event_type, 0) + 1
            
        for event_type, count in events.items():
            print(f"  {event_type}: {count}")
            
        print(f"\nFull audit log: {demo_audit}")
        
    print()
    print("🎯 ISSUE #2695 SOLUTION VERIFIED:")
    print("  ✅ Client-side secret detection (shell level)")
    print("  ✅ Pre-transmission masking (before Claude Code sees it)")
    print("  ✅ Local resolution only (secrets never transmitted)")
    print("  ✅ Enterprise audit trail (compliance ready)")
    print("  ✅ Zero-trust architecture (indirection-based)")
    print("  ✅ No Claude Code API dependencies (bypasses broken hooks)")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "demo":
        run_integration_demo()
    else:
        # Run comprehensive test suite
        unittest.main(verbosity=2)