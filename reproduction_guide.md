"""
Security Guidance Plugin - Extensibility Module

Provides secure file reading capabilities for security guidance configuration
with comprehensive path traversal protection and symlink validation.
"""

from __future__ import annotations

import logging
import os
import stat
from pathlib import Path
from typing import Generator, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Maximum file size to read (8KB)
MAX_FILE_SIZE: int = 8192

# Allowed path prefixes for security guidance files
ALLOWED_PROJECT_DIR: str = ".claude"
ALLOWED_USER_DIR: str = os.path.join(os.path.expanduser("~"), ".claude")

# Guidance filename constant
GUIDANCE_BASENAME: str = "claude-security-guidance.md"


class PathTraversalError(Exception):
    """Raised when a path traversal attempt is detected."""

    def __init__(self, path: str, resolved_path: str, allowed_base: str) -> None:
        self.path = path
        self.resolved_path = resolved_path
        self.allowed_base = allowed_base
        super().__init__(
            f"Path traversal detected: {path} resolves to {resolved_path}, "
            f"which is outside allowed base directory: {allowed_base}"
        )


class FileReadError(Exception):
    """Raised when a file cannot be read securely."""

    def __init__(self, path: str, reason: str) -> None:
        self.path = path
        self.reason = reason
        super().__init__(f"Cannot read file {path}: {reason}")


def _is_symlink(path: str) -> bool:
    """
    Check if the given path is a symbolic link.

    Args:
        path: Filesystem path to check.

    Returns:
        True if the path is a symlink, False otherwise.
    """
    try:
        return os.path.islink(path)
    except OSError as e:
        logger.warning("Failed to check symlink status for %s: %s", path, e)
        return False


def _resolve_path_safely(path: str, allowed_base: str) -> str:
    """
    Resolve a path and verify it stays within the allowed base directory.

    Args:
        path: The path to resolve.
        allowed_base: The allowed base directory that the resolved path must be within.

    Returns:
        The resolved real path if it's within the allowed base.

    Raises:
        PathTraversalError: If the resolved path escapes the allowed base directory.
        FileReadError: If the path cannot be resolved.
    """
    try:
        resolved_path = os.path.realpath(path)
    except OSError as e:
        raise FileReadError(path, f"Failed to resolve path: {e}") from e

    # Normalize paths for comparison
    resolved_path_norm = os.path.normpath(resolved_path)
    allowed_base_norm = os.path.normpath(allowed_base)

    # Ensure the resolved path starts with the allowed base directory
    if not resolved_path_norm.startswith(allowed_base_norm + os.sep) and resolved_path_norm != allowed_base_norm:
        raise PathTraversalError(path, resolved_path, allowed_base)

    return resolved_path


def _validate_file_permissions(path: str) -> None:
    """
    Validate that the file has secure permissions.

    Args:
        path: Path to the file to validate.

    Raises:
        FileReadError: If the file has insecure permissions.
    """
    try:
        file_stat = os.stat(path)
    except OSError as e:
        raise FileReadError(path, f"Failed to stat file: {e}") from e

    # Check if the file is world-writable
    if file_stat.st_mode & stat.S_IWOTH:
        raise FileReadError(path, "File is world-writable, refusing to read")

    # Check if the file is group-writable (optional strictness)
    if file_stat.st_mode & stat.S_IWGRP:
        logger.warning("File %s is group-writable, which may be insecure", path)


def _read_file_secure(path: str, max_size: int = MAX_FILE_SIZE) -> str:
    """
    Read a file securely with size limits and encoding validation.

    Args:
        path: Path to the file to read.
        max_size: Maximum number of bytes to read.

    Returns:
        The contents of the file as a string.

    Raises:
        FileReadError: If the file cannot be read or exceeds size limits.
    """
    try:
        # Check file size before reading
        file_size = os.path.getsize(path)
        if file_size > max_size:
            raise FileReadError(
                path,
                f"File size {file_size} bytes exceeds maximum {max_size} bytes"
            )

        # Read the file with explicit encoding
        with open(path, "r", encoding="utf-8", errors="strict") as f:
            content = f.read()

        # Validate content is not empty after stripping
        stripped_content = content.strip()
        if not stripped_content:
            logger.debug("File %s is empty after stripping whitespace", path)

        return stripped_content

    except UnicodeDecodeError as e:
        raise FileReadError(path, f"File is not valid UTF-8: {e}") from e
    except OSError as e:
        raise FileReadError(path, f"Failed to read file: {e}") from e


def _config_paths(cwd: str, basename: str) -> Generator[Tuple[str, str], None, None]:
    """
    Generate configuration file paths to check.

    Yields tuples of (label, path) for user and project configuration files.

    Args:
        cwd: Current working directory (project root).
        basename: The configuration filename.

    Yields:
        Tuples of (label, path) for each configuration location.
    """
    # User-level configuration
    user_path = os.path.join(ALLOWED_USER_DIR, basename)
    yield ("User", user_path)

    # Project-level configuration
    project_path = os.path.join(cwd, ALLOWED_PROJECT_DIR, basename)
    yield ("Project", project_path)


def read_security_guidance(cwd: str) -> List[Tuple[str, str]]:
    """
    Read security guidance configuration files securely.

    Reads configuration from both user and project locations, with comprehensive
    security validation including symlink protection and path traversal prevention.

    Args:
        cwd: Current working directory (project root).

    Returns:
        List of tuples containing (label, content) for each valid configuration found.

    Raises:
        ValueError: If cwd is invalid or empty.
    """
    if not cwd or not isinstance(cwd, str):
        raise ValueError("Current working directory must be a non-empty string")

    if not os.path.isdir(cwd):
        logger.warning("Provided cwd is not a valid directory: %s", cwd)
        return []

    results: List[Tuple[str, str]] = []

    for label, path in _config_paths(cwd, GUIDANCE_BASENAME):
        try:
            # Determine the allowed base directory based on label
            if label == "User":
                allowed_base = ALLOWED_USER_DIR
            else:
                allowed_base = os.path.join(cwd, ALLOWED_PROJECT_DIR)

            # Check if the path exists
            if not os.path.exists(path):
                logger.debug("Configuration file not found: %s", path)
                continue

            # Log if path is a symlink (for audit purposes)
            if _is_symlink(path):
                logger.info(
                    "Configuration file %s is a symlink, validating target...",
                    path
                )

            # Resolve path safely to prevent traversal
            resolved_path = _resolve_path_safely(path, allowed_base)

            # Validate file permissions
            _validate_file_permissions(resolved_path)

            # Read the file content securely
            content = _read_file_secure(resolved_path)

            if content:
                results.append((label, content))
                logger.debug(
                    "Successfully read security guidance from %s (%s)",
                    label,
                    resolved_path
                )
            else:
                logger.debug(
                    "Skipping empty configuration file: %s",
                    resolved_path
                )

        except PathTraversalError as e:
            logger.error(
                "Security violation: %s",
                str(e)
            )
            continue

        except FileReadError as e:
            logger.warning(
                "Failed to read configuration file: %s",
                str(e)
            )
            continue

        except OSError as e:
            logger.error(
                "Unexpected filesystem error while processing %s: %s",
                path,
                str(e)
            )
            continue

    return results