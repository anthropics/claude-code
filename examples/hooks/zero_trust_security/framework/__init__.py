# Claude Code Zero-Trust Security Framework

__version__ = "1.0.0"
__author__ = "Claude Code Team"
__description__ = "Zero-trust security framework for Claude Code"

from .processor import ZeroTrustProcessor
from .hooks import ClaudeCodeHook
from .verification import VerificationEngine

__all__ = [
    "ZeroTrustProcessor",
    "ClaudeCodeHook", 
    "VerificationEngine"
]