"""Verify file creation claims."""

import os
from typing import Any

from .base import VerificationResult


def verify_file_exists(file_path: str | None, cwd: str,
                       config: dict[str, Any]) -> VerificationResult:
    """
    Verify that a claimed file was actually created.

    Args:
        file_path: Path to the file (relative or absolute)
        cwd: Current working directory
        config: Verifier configuration

    Returns:
        VerificationResult indicating if the file exists
    """
    if not file_path:
        return VerificationResult(
            passed=False,
            message="No file path provided to verify",
            details={"error": "missing_path"}
        )

    # Resolve relative paths
    if not os.path.isabs(file_path):
        full_path = os.path.join(cwd, file_path)
    else:
        full_path = file_path

    # Normalize the path
    full_path = os.path.normpath(full_path)

    if os.path.exists(full_path):
        # Check if it's a file (not a directory)
        if os.path.isfile(full_path):
            # Get file size for additional verification
            size = os.path.getsize(full_path)
            return VerificationResult(
                passed=True,
                message=f"File exists: {file_path}",
                details={
                    "path": full_path,
                    "size": size,
                    "is_file": True
                }
            )
        else:
            return VerificationResult(
                passed=False,
                message=f"Path exists but is not a file: {file_path}",
                details={
                    "path": full_path,
                    "is_directory": os.path.isdir(full_path)
                }
            )
    else:
        # Check if parent directory exists (helps diagnose issues)
        parent = os.path.dirname(full_path)
        parent_exists = os.path.exists(parent)

        return VerificationResult(
            passed=False,
            message=f"File does not exist: {file_path}",
            details={
                "path": full_path,
                "parent_exists": parent_exists,
                "cwd": cwd
            }
        )
