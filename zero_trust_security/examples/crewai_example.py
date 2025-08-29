#!/usr/bin/env python3
"""
CrewAI Accountability Agent Example
==================================
Demonstrates recursive AI accountability with Byzantine fault tolerance.
"""

from pathlib import Path
import sys

# Add library to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from zero_trust_security import CrewAIAccountabilityAgent
from zero_trust_security.core.secret_detector import SecurityLevel

def basic_agent_validation():
    """Basic agent action validation"""
    print("🤖 Basic Agent Validation")
    print("-" * 40)
    
    agent = CrewAIAccountabilityAgent(
        agent_role="Security Validator",
        security_level=SecurityLevel.FAIL_SECURE
    )
    
    # Test safe action
    safe_action = {
        "action": "analyze_text",
        "parameters": {"text": "Hello world", "format": "json"},
        "metadata": {"agent_id": "text_analyzer"}
    }
    
    is_valid, result = agent.validate_agent_action(safe_action)
    print(f"Safe action valid: {is_valid}")
    print(f"Risk score: {result['risk_score']}")
    print(f"Commitment: {result['commitment'].commitment_id}")
    
    # Test risky action
    risky_action = {
        "action": "database_connect",
        "parameters": {
            "url": "postgres://admin:secret123@production.db/sensitive_data",
            "api_key": "sk-1234567890abcdef"
        }
    }
    
    is_valid, result = agent.validate_agent_action(risky_action)
    print(f"\nRisky action valid: {is_valid}")
    print(f"Secrets found: {len(result['secrets_found'])}")
    for secret, secret_type in result['secrets_found']:
        print(f"  - {secret_type}: {secret[:15]}...")
    print()

def multi_agent_accountability():
    """Multi-agent system with accountability reporting"""
    print("👥 Multi-Agent Accountability")
    print("-" * 40)
    
    agent = CrewAIAccountabilityAgent(
        agent_role="Multi-Agent Coordinator",
        security_level=SecurityLevel.FAIL_SECURE
    )
    
    # Simulate multiple agent actions
    agent_actions = [
        {
            "agent_id": "researcher",
            "action": "web_search", 
            "query": "latest AI research papers"
        },
        {
            "agent_id": "writer",
            "action": "generate_content",
            "content": "Based on research findings..."
        },
        {
            "agent_id": "uploader", 
            "action": "upload_file",
            "credentials": {
                "aws_key": "AKIAIOSFODNN7EXAMPLE",
                "aws_secret": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            }
        },
        {
            "agent_id": "notifier",
            "action": "send_notification",
            "message": "Task completed successfully"
        }
    ]
    
    # Generate accountability report
    report = agent.create_accountability_report(agent_actions)
    
    print(f"Total actions: {report['total_actions']}")
    print(f"Valid actions: {report['valid_actions']}")
    print(f"Invalid actions: {report['invalid_actions']}")
    print(f"Success rate: {report['success_rate']:.2%}")
    print(f"Total secrets detected: {report['total_secrets_detected']}")
    print(f"Average risk score: {report['average_risk_score']:.1f}")
    print(f"Byzantine quorum: {report['byzantine_quorum']}")
    print()

def agent_description_example():
    """Show agent description and tools"""
    print("📋 Agent Description & Tools")
    print("-" * 40)
    
    agent = CrewAIAccountabilityAgent()
    
    print("Agent Description:")
    print(agent.get_agent_description())
    
    print("\nAvailable Tools:")
    tools = agent.get_agent_tools()
    for tool in tools:
        print(f"  - {tool['name']}: {tool['description']}")
    print()

def audit_chain_verification():
    """Demonstrate audit chain verification"""
    print("🔗 Audit Chain Verification")
    print("-" * 40)
    
    agent = CrewAIAccountabilityAgent()
    
    # Create some actions to build audit chain
    test_actions = [
        {"action": "test1", "data": "safe"},
        {"action": "test2", "data": "also safe"}
    ]
    
    # Process actions (builds audit chain)
    for action in test_actions:
        agent.validate_agent_action(action)
    
    # Verify chain integrity
    verification = agent.verify_audit_chain()
    
    print(f"Chain valid: {verification['chain_valid']}")
    print(f"Total entries: {verification['chain_statistics']['total_entries']}")
    print(f"Integrity errors: {len(verification['integrity_errors'])}")
    
    if verification['integrity_errors']:
        print("Errors found:")
        for error in verification['integrity_errors']:
            print(f"  - {error}")
    print()

def recursive_accountability_demo():
    """Demonstrate recursive AI accountability"""
    print("🔄 Recursive AI Accountability")
    print("-" * 40)
    
    # Create multiple accountability agents
    validator_agent = CrewAIAccountabilityAgent(
        agent_role="Primary Validator",
        security_level=SecurityLevel.FAIL_SECURE
    )
    
    oversight_agent = CrewAIAccountabilityAgent(
        agent_role="Oversight Validator", 
        security_level=SecurityLevel.FAIL_SECURE
    )
    
    # Primary agent validates an action
    primary_action = {
        "action": "sensitive_operation",
        "data": "classified information",
        "auth_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjo"
    }
    
    primary_valid, primary_result = validator_agent.validate_agent_action(primary_action)
    print(f"Primary validation: {primary_valid}")
    print(f"Primary commitment: {primary_result['commitment'].commitment_id}")
    
    # Oversight agent validates the primary agent's decision
    oversight_action = {
        "action": "review_validation",
        "primary_commitment_id": primary_result['commitment'].commitment_id,
        "primary_audit_entry": primary_result['audit_entry_id'],
        "validation_decision": primary_valid
    }
    
    oversight_valid, oversight_result = oversight_agent.validate_agent_action(oversight_action)
    print(f"Oversight validation: {oversight_valid}")
    print(f"Oversight commitment: {oversight_result['commitment'].commitment_id}")
    
    print("\n🎯 Recursive accountability achieved:")
    print("  1. Primary agent validated user action")
    print("  2. Oversight agent validated primary agent's decision")
    print("  3. Both decisions cryptographically committed to audit chain")
    print("  4. Full Byzantine fault tolerance with tamper-proof trail")
    print()

def main():
    """Run all CrewAI examples"""
    print("🤖 CrewAI Accountability Agent Examples")
    print("=" * 50)
    
    basic_agent_validation()
    multi_agent_accountability()
    agent_description_example()
    audit_chain_verification()
    recursive_accountability_demo()
    
    print("✅ All CrewAI examples completed successfully!")

if __name__ == "__main__":
    main()