"""Base types for verifiers."""

from dataclasses import dataclass
from typing import Any


@dataclass
class VerificationResult:
    """Result of a verification check."""
    passed: bool
    message: str
    details: dict[str, Any]
