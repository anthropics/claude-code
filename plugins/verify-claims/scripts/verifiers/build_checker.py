"""Verify build success claims by running builds."""

import shlex
import subprocess
from typing import Any

from .base import VerificationResult
from .command_detection import file_exists, read_package_json


def detect_build_command(cwd: str) -> tuple[str, str] | None:
    """
    Detect the appropriate build command for the project.

    Args:
        cwd: Current working directory

    Returns:
        Tuple of (command, build_tool_name) or None if not detected
    """
    # Node.js/npm projects
    pkg = read_package_json(cwd)
    if pkg:
        scripts = pkg.get("scripts", {})
        if "build" in scripts:
            return ("npm run build", "npm")
        if "compile" in scripts:
            return ("npm run compile", "npm")

    # TypeScript projects
    if file_exists(cwd, "tsconfig.json"):
        return ("npx tsc --noEmit", "typescript")

    # Rust projects
    if file_exists(cwd, "Cargo.toml"):
        return ("cargo build", "cargo")

    # Go projects
    if file_exists(cwd, "go.mod"):
        return ("go build ./...", "go")

    # Java/Maven projects
    if file_exists(cwd, "pom.xml"):
        return ("mvn compile", "maven")

    # Java/Gradle projects
    if file_exists(cwd, "build.gradle", "build.gradle.kts"):
        return ("./gradlew build", "gradle")

    # Make projects
    if file_exists(cwd, "Makefile"):
        return ("make", "make")

    # CMake projects
    if file_exists(cwd, "CMakeLists.txt"):
        return ("cmake --build .", "cmake")

    return None


def verify_build_success(claim_value: str | None, cwd: str,
                         config: dict[str, Any]) -> VerificationResult:
    """
    Verify that the project builds successfully.

    Args:
        claim_value: Not used for build verification
        cwd: Current working directory
        config: Verifier configuration

    Returns:
        VerificationResult indicating if build succeeds
    """
    timeout = config.get("timeout", 120)
    custom_command = config.get("command")

    # Use custom command if specified
    if custom_command:
        build_command = custom_command
        build_tool = "custom"
    else:
        # Auto-detect build command
        detected = detect_build_command(cwd)
        if detected is None:
            return VerificationResult(
                passed=True,
                message="No build system detected, skipping verification",
                details={"skipped": True, "reason": "no_build_system"}
            )
        build_command, build_tool = detected

    try:
        result = subprocess.run(
            shlex.split(build_command),
            shell=False,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        if result.returncode == 0:
            return VerificationResult(
                passed=True,
                message=f"Build succeeded ({build_tool})",
                details={
                    "command": build_command,
                    "build_tool": build_tool,
                    "exit_code": result.returncode
                }
            )
        else:
            # Extract build errors
            output = result.stdout + result.stderr
            output_tail = output[-1500:] if output else "No output"

            return VerificationResult(
                passed=False,
                message=f"Build failed ({build_tool})",
                details={
                    "command": build_command,
                    "build_tool": build_tool,
                    "exit_code": result.returncode,
                    "output_tail": output_tail
                }
            )

    except subprocess.TimeoutExpired:
        return VerificationResult(
            passed=False,
            message=f"Build timed out after {timeout}s",
            details={
                "command": build_command,
                "build_tool": build_tool,
                "timeout": timeout,
                "error": "timeout"
            }
        )
    except Exception as e:
        return VerificationResult(
            passed=False,
            message=f"Failed to run build: {str(e)}",
            details={
                "command": build_command,
                "build_tool": build_tool,
                "error": str(e)
            }
        )
