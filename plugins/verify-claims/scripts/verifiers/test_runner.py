"""Verify test passing claims by running tests."""

import shlex
import subprocess
from typing import Any

from .base import VerificationResult
from .command_detection import (
    file_exists,
    read_package_json,
    read_pyproject_toml,
)


def detect_test_command(cwd: str) -> tuple[str, str] | None:
    """
    Detect the appropriate test command for the project.

    Args:
        cwd: Current working directory

    Returns:
        Tuple of (command, framework_name) or None if not detected
    """
    # Node.js/npm projects
    pkg = read_package_json(cwd)
    if pkg:
        scripts = pkg.get("scripts", {})
        if "test" in scripts:
            return ("npm test", "npm")
        if "test:unit" in scripts:
            return ("npm run test:unit", "npm")

    # Python projects
    if file_exists(cwd, "pytest.ini", "pyproject.toml", "setup.py"):
        # Check for pytest
        if file_exists(cwd, "pytest.ini"):
            return ("pytest", "pytest")
        # Check pyproject.toml for pytest
        content = read_pyproject_toml(cwd)
        if content and ("pytest" in content or "[tool.pytest" in content):
            return ("pytest", "pytest")
        # Default to pytest if tests directory exists
        if file_exists(cwd, "tests"):
            return ("pytest", "pytest")

    # Rust projects
    if file_exists(cwd, "Cargo.toml"):
        return ("cargo test", "cargo")

    # Go projects
    if file_exists(cwd, "go.mod"):
        return ("go test ./...", "go")

    # Ruby projects
    if file_exists(cwd, "Gemfile"):
        if file_exists(cwd, "spec"):
            return ("bundle exec rspec", "rspec")
        if file_exists(cwd, "test"):
            return ("bundle exec rake test", "rake")

    # Java/Maven projects
    if file_exists(cwd, "pom.xml"):
        return ("mvn test", "maven")

    # Java/Gradle projects
    if file_exists(cwd, "build.gradle", "build.gradle.kts"):
        return ("./gradlew test", "gradle")

    return None


def verify_tests_pass(claim_value: str | None, cwd: str,
                      config: dict[str, Any]) -> VerificationResult:
    """
    Verify that tests pass by running the test suite.

    Args:
        claim_value: Not used for test verification
        cwd: Current working directory
        config: Verifier configuration

    Returns:
        VerificationResult indicating if tests pass
    """
    timeout = config.get("timeout", 60)
    custom_command = config.get("command")

    # Use custom command if specified
    if custom_command:
        test_command = custom_command
        framework = "custom"
    else:
        # Auto-detect test command
        detected = detect_test_command(cwd)
        if detected is None:
            return VerificationResult(
                passed=True,
                message="No test framework detected, skipping verification",
                details={"skipped": True, "reason": "no_test_framework"}
            )
        test_command, framework = detected

    try:
        result = subprocess.run(
            shlex.split(test_command),
            shell=False,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode == 0:
            return VerificationResult(
                passed=True,
                message=f"Tests passed ({framework})",
                details={
                    "command": test_command,
                    "framework": framework,
                    "exit_code": result.returncode,
                    "stdout_tail": result.stdout[-500:] if result.stdout else ""
                }
            )
        else:
            # Extract relevant failure info
            output = result.stdout + result.stderr
            # Get last 1000 chars which usually contains failure summary
            output_tail = output[-1000:] if output else "No output"

            return VerificationResult(
                passed=False,
                message=f"Tests failed ({framework})",
                details={
                    "command": test_command,
                    "framework": framework,
                    "exit_code": result.returncode,
                    "output_tail": output_tail
                }
            )

    except subprocess.TimeoutExpired:
        return VerificationResult(
            passed=False,
            message=f"Test run timed out after {timeout}s",
            details={
                "command": test_command,
                "framework": framework,
                "timeout": timeout,
                "error": "timeout"
            }
        )
    except Exception as e:
        return VerificationResult(
            passed=False,
            message=f"Failed to run tests: {str(e)}",
            details={
                "command": test_command,
                "framework": framework,
                "error": str(e)
            }
        )
