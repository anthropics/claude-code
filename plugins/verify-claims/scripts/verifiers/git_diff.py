"""Verify bug fix/change claims by checking git status."""

import os
import subprocess
from typing import Any

from .base import VerificationResult


def verify_changes_made(claim_value: str | None, cwd: str,
                        config: dict[str, Any]) -> VerificationResult:
    """
    Verify that changes were made to the codebase (for bug fix claims).

    This checks that there are actual code changes that could constitute a fix.

    Args:
        claim_value: Not used for this verification
        cwd: Current working directory
        config: Verifier configuration

    Returns:
        VerificationResult indicating if changes were made
    """
    # Check if this is a git repository
    git_dir = os.path.join(cwd, ".git")
    if not os.path.exists(git_dir):
        return VerificationResult(
            passed=True,
            message="Not a git repository, skipping change verification",
            details={"skipped": True, "reason": "not_git_repo"}
        )

    try:
        # Check for staged changes
        staged_result = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10
        )
        staged_files = [f for f in staged_result.stdout.strip().split('\n') if f]

        # Check for unstaged changes
        unstaged_result = subprocess.run(
            ["git", "diff", "--name-only"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10
        )
        unstaged_files = [f for f in unstaged_result.stdout.strip().split('\n') if f]

        # Check for untracked files (new files)
        untracked_result = subprocess.run(
            ["git", "ls-files", "--others", "--exclude-standard"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=10
        )
        untracked_files = [f for f in untracked_result.stdout.strip().split('\n') if f]

        # Filter to code files only
        code_extensions = {'.py', '.js', '.ts', '.tsx', '.jsx', '.rs', '.go',
                          '.java', '.c', '.cpp', '.h', '.hpp', '.rb', '.php',
                          '.swift', '.kt', '.scala', '.vue', '.svelte'}

        def is_code_file(f):
            _, ext = os.path.splitext(f)
            return ext.lower() in code_extensions

        code_staged = [f for f in staged_files if is_code_file(f)]
        code_unstaged = [f for f in unstaged_files if is_code_file(f)]
        code_untracked = [f for f in untracked_files if is_code_file(f)]

        all_code_changes = code_staged + code_unstaged + code_untracked
        total_changes = len(staged_files) + len(unstaged_files) + len(untracked_files)

        if all_code_changes:
            return VerificationResult(
                passed=True,
                message=f"Code changes detected: {len(all_code_changes)} file(s)",
                details={
                    "staged_files": code_staged,
                    "unstaged_files": code_unstaged,
                    "new_files": code_untracked,
                    "total_code_changes": len(all_code_changes)
                }
            )
        elif total_changes > 0:
            # Changes exist but not in code files
            return VerificationResult(
                passed=True,
                message=f"Changes detected (non-code): {total_changes} file(s)",
                details={
                    "staged_files": staged_files,
                    "unstaged_files": unstaged_files,
                    "untracked_files": untracked_files,
                    "note": "No code files changed, but other files modified"
                }
            )
        else:
            # Check if there are recent commits
            log_result = subprocess.run(
                ["git", "log", "-1", "--format=%H", "--since=5 minutes ago"],
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=10
            )

            if log_result.stdout.strip():
                return VerificationResult(
                    passed=True,
                    message="Recent commit found (changes already committed)",
                    details={
                        "commit": log_result.stdout.strip()[:8],
                        "note": "Changes were likely already committed"
                    }
                )

            return VerificationResult(
                passed=False,
                message="No code changes detected for bug fix claim",
                details={
                    "staged_files": staged_files,
                    "unstaged_files": unstaged_files,
                    "untracked_files": untracked_files,
                    "note": "Expected code changes for a bug fix claim"
                }
            )

    except subprocess.TimeoutExpired:
        return VerificationResult(
            passed=False,
            message="Git command timed out",
            details={"error": "timeout"}
        )
    except Exception as e:
        return VerificationResult(
            passed=False,
            message=f"Failed to check git status: {str(e)}",
            details={"error": str(e)}
        )
