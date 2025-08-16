"""
CrewAI Integration
==================
Byzantine fault tolerance agent for CrewAI multi-agent systems.
Provides recursive AI accountability with cryptographic validation.
"""

from typing import Dict, Any, List, Optional
from ..core.secret_detector import SecretDetector, SecurityLevel
from ..core.byzantine_validator import ByzantineValidator, ValidationResult
from ..core.audit_chain import AuditChain

class CrewAIAccountabilityAgent:
    """CrewAI agent with Byzantine fault tolerance and recursive accountability"""
    
    def __init__(self,
                 agent_role: str = "Security Validator",
                 security_level: SecurityLevel = SecurityLevel.FAIL_SECURE,
                 byzantine_quorum: int = 3,
                 audit_dir: Optional[str] = None):
        """Initialize CrewAI accountability agent
        
        Args:
            agent_role: Role description for the agent
            security_level: Security enforcement level
            byzantine_quorum: Number of validators for consensus
            audit_dir: Custom audit directory
        """
        self.agent_role = agent_role
        self.security_level = security_level
        
        # Initialize security components
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
    
    def validate_agent_action(self, action_data: Dict[str, Any]) -> tuple[bool, Dict[str, Any]]:
        """Validate a CrewAI agent action with Byzantine consensus
        
        Args:
            action_data: Agent action data to validate
            
        Returns:
            Tuple of (is_valid, validation_result)
        """
        # Run secret detection on action
        detection_result = self.secret_detector.analyze_data(action_data)
        
        # Create Byzantine commitment for the action
        commitment, validation_result = self.byzantine_validator.validate_and_commit(action_data)
        
        # Create validation proof
        validation_proof = self.byzantine_validator.create_validation_proof(
            commitment,
            validation_result,
            {
                "agent_role": self.agent_role,
                "secret_types": detection_result.audit_data.get("secret_types", []),
                "secrets_count": detection_result.audit_data.get("secrets_count", 0),
                "risk_score": detection_result.risk_score
            }
        )
        
        # Add to audit chain
        audit_entry = self.audit_chain.add_entry(
            commitment=commitment,
            validation_proof=validation_proof,
            additional_data={"agent_role": self.agent_role}
        )
        
        # Determine validity
        is_valid = (
            not detection_result.blocked and 
            validation_result == ValidationResult.VALIDATED
        )
        
        result = {
            "is_valid": is_valid,
            "secrets_found": detection_result.secrets_found,
            "risk_score": detection_result.risk_score,
            "commitment": commitment,
            "validation_result": validation_result,
            "audit_entry_id": audit_entry.entry_id,
            "agent_role": self.agent_role
        }
        
        return is_valid, result
    
    def create_accountability_report(self, 
                                   actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create accountability report for multiple agent actions
        
        Args:
            actions: List of agent actions to analyze
            
        Returns:
            Comprehensive accountability report
        """
        total_actions = len(actions)
        valid_actions = 0
        total_secrets = 0
        total_risk_score = 0
        validation_results = []
        
        for action in actions:
            is_valid, result = self.validate_agent_action(action)
            
            if is_valid:
                valid_actions += 1
            
            total_secrets += len(result["secrets_found"])
            total_risk_score += result["risk_score"]
            validation_results.append(result)
        
        # Get audit chain statistics
        chain_stats = self.audit_chain.get_chain_stats()
        
        return {
            "agent_role": self.agent_role,
            "security_level": self.security_level.value,
            "total_actions": total_actions,
            "valid_actions": valid_actions,
            "invalid_actions": total_actions - valid_actions,
            "success_rate": valid_actions / total_actions if total_actions > 0 else 0,
            "total_secrets_detected": total_secrets,
            "total_risk_score": total_risk_score,
            "average_risk_score": total_risk_score / total_actions if total_actions > 0 else 0,
            "byzantine_quorum": self.byzantine_validator.byzantine_quorum,
            "audit_chain_stats": chain_stats,
            "validation_results": validation_results
        }
    
    def get_agent_description(self) -> str:
        """Get agent description for CrewAI integration"""
        return f"""
        Role: {self.agent_role}
        
        I am a Byzantine fault tolerance agent that provides recursive AI accountability 
        for multi-agent systems. I validate agent actions using cryptographic commitments 
        and consensus mechanisms to ensure zero-trust security.
        
        Capabilities:
        - Secret detection with {len(self.secret_detector.patterns)} pattern types
        - Byzantine consensus with {self.byzantine_validator.byzantine_quorum} validators
        - Tamper-proof audit trails with hash chaining
        - {self.security_level.value} security enforcement
        
        I create cryptographic proofs for all agent actions and maintain an immutable 
        audit chain for accountability and compliance.
        """
    
    def get_agent_tools(self) -> List[Dict[str, Any]]:
        """Get tools available to this agent"""
        return [
            {
                "name": "validate_action",
                "description": "Validate an agent action with Byzantine consensus",
                "parameters": {
                    "action_data": "Dictionary containing agent action to validate"
                }
            },
            {
                "name": "create_accountability_report", 
                "description": "Generate comprehensive accountability report for multiple actions",
                "parameters": {
                    "actions": "List of agent actions to analyze"
                }
            },
            {
                "name": "verify_audit_chain",
                "description": "Verify integrity of the audit chain",
                "parameters": {}
            }
        ]
    
    def verify_audit_chain(self) -> Dict[str, Any]:
        """Verify audit chain integrity"""
        is_valid, errors = self.audit_chain.verify_chain_integrity()
        stats = self.audit_chain.get_chain_stats()
        
        return {
            "chain_valid": is_valid,
            "integrity_errors": errors,
            "chain_statistics": stats,
            "verification_timestamp": self.audit_chain._get_last_hash()
        }