"""
Claude Code Integration
=======================
Zero-trust security hook for Claude Code with Byzantine fault tolerance.
Drop-in replacement for manual hook implementations.
"""

import json
import sys
import os
from typing import Dict, Any, Optional
from ..core.secret_detector import SecretDetector, SecurityLevel
from ..core.byzantine_validator import ByzantineValidator, ValidationResult
from ..core.audit_chain import AuditChain

class ClaudeCodeHook:
    """Complete Claude Code security hook with zero-trust guarantees"""
    
    def __init__(self, 
                 security_level: SecurityLevel = SecurityLevel.FAIL_SECURE,
                 byzantine_quorum: int = 3,
                 audit_dir: Optional[str] = None):
        """Initialize Claude Code security hook
        
        Args:
            security_level: FAIL_SAFE (user-friendly) or FAIL_SECURE (zero-trust)
            byzantine_quorum: Number of validators for Byzantine consensus
            audit_dir: Custom audit directory
        """
        self.security_level = security_level
        
        # Initialize components
        self.secret_detector = SecretDetector(
            security_level=security_level,
            audit_dir=audit_dir
        )
        
        self.byzantine_validator = ByzantineValidator(
            byzantine_quorum=byzantine_quorum,
            audit_dir=audit_dir,
            fail_secure=(security_level == SecurityLevel.FAIL_SECURE)
        )
        
        self.audit_chain = AuditChain(audit_dir=audit_dir)
    
    def analyze_tool_call(self, tool_call: Dict[str, Any]) -> tuple[bool, Dict[str, Any]]:
        """Analyze a Claude Code tool call for security threats
        
        Args:
            tool_call: Tool call data with 'tool_name' and 'tool_input'
            
        Returns:
            Tuple of (should_block, analysis_result)
        """
        # Run secret detection
        detection_result = self.secret_detector.analyze_data(tool_call)
        
        # Create Byzantine commitment
        commitment, validation_result = self.byzantine_validator.validate_and_commit(tool_call)
        
        # Create validation proof
        validation_proof = self.byzantine_validator.create_validation_proof(
            commitment, 
            validation_result,
            {
                "secret_types": detection_result.audit_data.get("secret_types", []),
                "secrets_count": detection_result.audit_data.get("secrets_count", 0)
            }
        )
        
        # Add to audit chain
        audit_entry = self.audit_chain.add_entry(
            commitment=commitment,
            validation_proof=validation_proof
        )
        
        # Determine if we should block
        should_block = (
            detection_result.blocked or 
            validation_result in [ValidationResult.REJECTED, ValidationResult.ERROR]
        )
        
        # Compile analysis result
        analysis_result = {
            "secrets_found": detection_result.secrets_found,
            "risk_score": detection_result.risk_score,
            "commitment": commitment,
            "validation_result": validation_result,
            "audit_entry_id": audit_entry.entry_id,
            "blocked": should_block,
            "security_level": self.security_level.value
        }
        
        return should_block, analysis_result
    
    def run_as_hook(self) -> int:
        """Run as Claude Code PreToolUse hook
        
        Reads JSON from stdin, analyzes it, and exits with appropriate code.
        Exit codes: 0 = allow, 1 = block gracefully, 2 = block with alert
        
        Returns:
            Exit code for the hook
        """
        try:
            # Read tool call from stdin
            input_data = sys.stdin.read().strip()
            if not input_data:
                if self.security_level == SecurityLevel.FAIL_SECURE:
                    sys.stderr.write("ZERO-TRUST: Empty input blocked\\n")
                    return 2
                return 0  # Fail-safe: allow empty input
            
            # Parse JSON
            try:
                tool_call = json.loads(input_data)
            except json.JSONDecodeError as e:
                if self.security_level == SecurityLevel.FAIL_SECURE:
                    sys.stderr.write(f"ZERO-TRUST: Invalid JSON blocked: {e}\\n")
                    return 2
                return 0  # Fail-safe: allow invalid JSON
            
            # Validate required fields
            if not isinstance(tool_call, dict) or 'tool_name' not in tool_call:
                if self.security_level == SecurityLevel.FAIL_SECURE:
                    sys.stderr.write("ZERO-TRUST: Missing required fields blocked\\n")
                    return 2
                return 0  # Fail-safe: allow malformed data
            
            # Run security analysis
            should_block, analysis = self.analyze_tool_call(tool_call)
            
            if should_block:
                # Show security alert
                if self.security_level == SecurityLevel.FAIL_SECURE:
                    sys.stderr.write("🔒 ZERO-TRUST BYZANTINE SECURITY ALERT\\n")
                    sys.stderr.write(f"Tool: {tool_call.get('tool_name', 'unknown')}\\n")
                    
                    if analysis['secrets_found']:
                        secret_types = [s_type for _, s_type in analysis['secrets_found']]
                        sys.stderr.write(f"Secrets detected: {', '.join(set(secret_types))}\\n")
                    
                    sys.stderr.write(f"Cryptographic commitment: {analysis['commitment'].commitment_id}\\n")
                    sys.stderr.write(f"Byzantine validators: {len(analysis['commitment'].validator_chain)}\\n")
                    sys.stderr.write(f"Audit chain entry: {analysis['audit_entry_id']}\\n")
                    
                    return 2  # Block with alert
                else:
                    # Fail-safe mode: warn but allow
                    sys.stderr.write("⚠️  Security warning: secrets detected but allowed (fail-safe mode)\\n")
                    return 0
            
            return 0  # Allow execution
            
        except Exception as e:
            if self.security_level == SecurityLevel.FAIL_SECURE:
                sys.stderr.write(f"ZERO-TRUST: Unexpected error blocked: {e}\\n")
                return 2
            return 0  # Fail-safe: allow on errors


def create_hook_script(security_level: SecurityLevel = SecurityLevel.FAIL_SECURE,
                      byzantine_quorum: int = 3,
                      output_file: str = "claude_code_security_hook.py") -> str:
    """Create a standalone Claude Code security hook script
    
    Args:
        security_level: Security enforcement level
        byzantine_quorum: Number of Byzantine validators
        output_file: Output filename for the hook script
        
    Returns:
        Path to the created hook script
    """
    hook_script = f'''#!/usr/bin/env python3
"""
Claude Code Zero-Trust Security Hook
Generated by zero-trust-security library
"""
import sys
import os

# Add library to path if not installed
try:
    from zero_trust_security.integrations.claude_code import ClaudeCodeHook
    from zero_trust_security.core.secret_detector import SecurityLevel
except ImportError:
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from zero_trust_security.integrations.claude_code import ClaudeCodeHook
    from zero_trust_security.core.secret_detector import SecurityLevel

def main():
    """Main hook entry point"""
    hook = ClaudeCodeHook(
        security_level=SecurityLevel.{security_level.name},
        byzantine_quorum={byzantine_quorum}
    )
    sys.exit(hook.run_as_hook())

if __name__ == "__main__":
    main()
'''
    
    with open(output_file, 'w') as f:
        f.write(hook_script)
    
    # Make executable
    os.chmod(output_file, 0o755)
    
    return output_file