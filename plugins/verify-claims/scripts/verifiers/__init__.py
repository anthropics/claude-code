"""Verifiers for different claim types."""

from typing import Any

from .base import VerificationResult
from .build_checker import verify_build_success
from .file_exists import verify_file_exists
from .git_diff import verify_changes_made
from .lint_checker import verify_lint_clean
from .test_runner import verify_tests_pass

# Map claim types to verifier functions
VERIFIERS = {
    "file_created": verify_file_exists,
    "tests_pass": verify_tests_pass,
    "lint_clean": verify_lint_clean,
    "build_success": verify_build_success,
    "bug_fixed": verify_changes_made,
}


def verify_claim(claim_type: str, claim_value: str | None,
                 cwd: str, config: dict[str, Any]) -> VerificationResult:
    """
    Verify a claim using the appropriate verifier.

    Args:
        claim_type: Type of claim (e.g., "file_created", "tests_pass")
        claim_value: Extracted value from claim (e.g., file path)
        cwd: Current working directory
        config: Plugin configuration

    Returns:
        VerificationResult with pass/fail status and details
    """
    verifier = VERIFIERS.get(claim_type)

    if verifier is None:
        return VerificationResult(
            passed=True,
            message=f"No verifier for claim type: {claim_type}",
            details={"skipped": True}
        )

    verifier_config = config.get("verifiers", {}).get(claim_type, {})

    if not verifier_config.get("enabled", True):
        return VerificationResult(
            passed=True,
            message=f"Verifier disabled for: {claim_type}",
            details={"skipped": True, "reason": "disabled"}
        )

    try:
        return verifier(claim_value, cwd, verifier_config)
    except Exception as e:
        return VerificationResult(
            passed=False,
            message=f"Verification error: {str(e)}",
            details={"error": str(e), "claim_type": claim_type}
        )


__all__ = [
    'VerificationResult',
    'VERIFIERS',
    'verify_claim',
    'verify_file_exists',
    'verify_tests_pass',
    'verify_lint_clean',
    'verify_build_success',
    'verify_changes_made',
]
