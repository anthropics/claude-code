"""
Zero-Trust Security Library
==========================
Enterprise-grade security framework with Byzantine fault tolerance
extracted from proven Claude Code and CrewAI implementations.

Key Features:
- Client-side secret detection before transmission
- Byzantine fault tolerance with cryptographic commitments  
- Tamper-proof audit trails with hash chaining
- Configurable security models (fail-safe vs fail-secure)
- Production-tested across multiple AI systems

Usage:
    from zero_trust_security import SecretDetector, ByzantineValidator
    
    # Basic secret detection (fail-safe)
    detector = SecretDetector()
    result = detector.analyze_data({"command": "export API_KEY=..."})
    
    # Byzantine fault tolerance (fail-secure)
    validator = ByzantineValidator()
    commitment = validator.create_commitment(data)
    if validator.validate_commitment(commitment):
        # Proceed with cryptographic proof of safety
        pass
"""

__version__ = "0.1.0"
__author__ = "Jonathan Hill"

from .core.secret_detector import SecretDetector, SecretPattern
from .core.byzantine_validator import ByzantineValidator, SecurityCommitment
from .core.audit_chain import AuditChain, AuditEntry
from .integrations.claude_code import ClaudeCodeHook
from .integrations.crewai_agent import CrewAIAccountabilityAgent

__all__ = [
    "SecretDetector",
    "SecretPattern", 
    "ByzantineValidator",
    "SecurityCommitment",
    "AuditChain",
    "AuditEntry",
    "ClaudeCodeHook",
    "CrewAIAccountabilityAgent"
]