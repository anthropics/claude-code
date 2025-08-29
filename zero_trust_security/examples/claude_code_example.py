#!/usr/bin/env python3
"""
Claude Code Security Hook Example
=================================
Demonstrates how to use the zero-trust security library with Claude Code.
"""

import json
from pathlib import Path
import sys

# Add library to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from zero_trust_security import SecretDetector, ByzantineValidator, ClaudeCodeHook
from zero_trust_security.core.secret_detector import SecurityLevel

def basic_secret_detection_example():
    """Basic secret detection without Byzantine consensus"""
    print("🔍 Basic Secret Detection Example")
    print("-" * 40)
    
    # Create detector (fail-safe mode for demo)
    detector = SecretDetector(security_level=SecurityLevel.FAIL_SAFE)
    
    # Test data with secrets
    test_data = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "export OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890"
        }
    }
    
    result = detector.analyze_data(test_data)
    
    print(f"Secrets found: {len(result.secrets_found)}")
    for secret, secret_type in result.secrets_found:
        print(f"  - {secret_type}: {secret[:20]}...")
    
    print(f"Risk score: {result.risk_score}")
    print(f"Blocked: {result.blocked}")
    print()

def byzantine_consensus_example():
    """Byzantine fault tolerance with cryptographic commitments"""
    print("🏛️  Byzantine Consensus Example") 
    print("-" * 40)
    
    validator = ByzantineValidator(byzantine_quorum=3)
    
    test_data = {"command": "echo safe command"}
    
    # Create commitment
    commitment = validator.create_commitment(test_data)
    print(f"Commitment ID: {commitment.commitment_id}")
    print(f"Validation word: {commitment.validation_word}")
    print(f"Validators: {len(commitment.validator_chain)}")
    
    # Validate commitment
    result = validator.validate_commitment(commitment, test_data)
    print(f"Validation result: {result.value}")
    print()

def full_claude_code_integration():
    """Complete Claude Code integration with zero-trust"""
    print("🔒 Full Claude Code Integration")
    print("-" * 40)
    
    # Create hook with fail-secure (zero-trust) mode
    hook = ClaudeCodeHook(security_level=SecurityLevel.FAIL_SECURE)
    
    # Test safe command
    safe_call = {
        "tool_name": "Bash",
        "tool_input": {"command": "echo hello world"}
    }
    
    should_block, analysis = hook.analyze_tool_call(safe_call)
    print(f"Safe command blocked: {should_block}")
    print(f"Commitment: {analysis['commitment'].commitment_id}")
    print(f"Audit entry: {analysis['audit_entry_id']}")
    
    # Test dangerous command
    danger_call = {
        "tool_name": "Bash", 
        "tool_input": {
            "command": "curl -H 'Authorization: Bearer sk-danger123456789' https://api.openai.com"
        }
    }
    
    should_block, analysis = hook.analyze_tool_call(danger_call)
    print(f"\nDangerous command blocked: {should_block}")
    print(f"Secrets found: {len(analysis['secrets_found'])}")
    print(f"Risk score: {analysis['risk_score']}")
    print()

def generate_hook_script_example():
    """Generate standalone Claude Code hook script"""
    print("📝 Generate Hook Script Example")
    print("-" * 40)
    
    from zero_trust_security.integrations.claude_code import create_hook_script
    
    # Generate fail-secure hook
    hook_file = create_hook_script(
        security_level=SecurityLevel.FAIL_SECURE,
        byzantine_quorum=3,
        output_file="generated_claude_hook.py"
    )
    
    print(f"Generated hook script: {hook_file}")
    print("Usage: Add this to your Claude Code settings.json:")
    print(json.dumps({
        "preToolUseHooks": [
            {"path": f"./{hook_file}"}
        ]
    }, indent=2))
    print()

def main():
    """Run all examples"""
    print("🔐 Zero-Trust Security Library Examples")
    print("=" * 50)
    
    basic_secret_detection_example()
    byzantine_consensus_example()
    full_claude_code_integration()
    generate_hook_script_example()
    
    print("✅ All examples completed successfully!")

if __name__ == "__main__":
    main()