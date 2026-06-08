"""
Security-guidance plugin extensibility module.

Provides safe file reading capabilities with symlink protection
and path traversal prevention for project configuration files.
"""

import logging
import os
from pathlib import Path
from typing import Optional, Tuple, List, Final

logger = logging.getLogger(__name__)

# Maximum file size to read (8KB)
MAX_FILE_SIZE: Final[int] = 8192

# Expected configuration directory names
USER_CONFIG_DIR: Final[str] = ".claude"
GUIDANCE_BASENAME: Final[str] = "claude-security-guidance.md"


class PathTraversalError(Exception):
    """Raised when a resolved path escapes the expected directory boundary."""
    pass


class FileSizeExceededError(Exception):
    """Raised when a file exceeds the maximum allowed size."""
    pass


class FileReadError(Exception):
    """Raised when a file cannot be read due to encoding or I/O errors."""
    pass


def _validate_path_containment(resolved_path: Path, base_dir: Path) -> None:
    """
    Validate that a resolved path remains within the expected directory boundary.

    Args:
        resolved_path: The resolved absolute path to validate.
        base_dir: The expected parent directory (must be absolute).

    Raises:
        PathTraversalError: If the resolved path escapes the base directory.
        ValueError: If base_dir is not absolute.
    """
    if not base_dir.is_absolute():
        raise ValueError(f"base_dir must be absolute, got: {base_dir}")

    try:
        resolved_path.relative_to(base_dir)
    except ValueError:
        raise PathTraversalError(
            f"Path traversal detected: {resolved_path} is not within {base_dir}"
        )


def _safe_read_file(file_path: Path, max_size: int = MAX_FILE_SIZE) -> Optional[str]:
    """
    Safely read a file with size limits and encoding validation.

    Args:
        file_path: Path to the file to read (must be validated beforehand).
        max_size: Maximum file size in bytes.

    Returns:
        File contents as a stripped string, or None if reading fails.

    Raises:
        FileSizeExceededError: If the file exceeds max_size.
        FileReadError: If the file cannot be read.
    """
    try:
        file_size = file_path.stat().st_size
        if file_size > max_size:
            raise FileSizeExceededError(
                f"File {file_path} exceeds maximum size of {max_size} bytes "
                f"(actual: {file_size} bytes)"
            )

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip()

        return content

    except (OSError, UnicodeDecodeError) as e:
        logger.warning("Failed to read file %s: %s", file_path, e)
        raise FileReadError(f"Failed to read file {file_path}: {e}") from e


def read_guidance_file(base_dir: Path, basename: str = GUIDANCE_BASENAME) -> Optional[str]:
    """
    Read a security guidance file with symlink protection and path validation.

    Resolves the path, validates it stays within the expected directory,
    and reads the content with size limits.

    Args:
        base_dir: The expected parent directory (must be absolute).
        basename: The filename to look for in the .claude subdirectory.

    Returns:
        File contents as a string, or None if validation fails or file doesn't exist.

    Raises:
        ValueError: If base_dir is not absolute.

    Example:
        >>> content = read_guidance_file(Path("/home/user/project"))
        >>> if content:
        ...     print("Guidance loaded successfully")
    """
    if not base_dir.is_absolute():
        raise ValueError(f"base_dir must be absolute, got: {base_dir}")

    config_dir = base_dir / USER_CONFIG_DIR
    config_path = config_dir / basename

    try:
        # Resolve symlinks to get the real path
        resolved_path = config_path.resolve(strict=False)

        # Validate the resolved path stays within the project directory
        _validate_path_containment(resolved_path, base_dir)

        # Check if the file actually exists
        if not resolved_path.is_file():
            logger.debug("Guidance file not found: %s", resolved_path)
            return None

        # Read the file safely
        content = _safe_read_file(resolved_path)
        if content is None:
            return None

        logger.info("Successfully read guidance file: %s", resolved_path)
        return content

    except PathTraversalError as e:
        logger.warning(
            "Security warning: Skipping guidance file due to path traversal: %s -> %s",
            config_path,
            e,
        )
        return None

    except FileSizeExceededError as e:
        logger.warning(
            "Security warning: Skipping guidance file due to size limit: %s",
            e,
        )
        return None

    except FileReadError as e:
        logger.warning(
            "Failed to read guidance file: %s",
            e,
        )
        return None

    except (OSError, ValueError) as e:
        logger.error("Error accessing guidance file %s: %s", config_path, e)
        return None


def _config_paths(cwd: str, basename: str) -> List[Tuple[str, Path]]:
    """
    Generate configuration file paths for both user and project locations.

    Args:
        cwd: Current working directory path.
        basename: The filename to look for.

    Returns:
        List of (label, Path) tuples for user and project config locations.
    """
    paths: List[Tuple[str, Path]] = []

    # User-level configuration
    user_home = Path.home()
    user_config_path = user_home / USER_CONFIG_DIR / basename
    paths.append(("User", user_config_path))

    # Project-level configuration
    project_dir = Path(cwd).resolve()
    project_config_path = project_dir / USER_CONFIG_DIR / basename
    paths.append(("Project", project_config_path))

    return paths


def load_guidance_config(cwd: str) -> Optional[str]:
    """
    Load security guidance configuration from user and project locations.

    Attempts to read from user config first, then project config.
    Returns the first successfully read configuration.

    Args:
        cwd: Current working directory path.

    Returns:
        Configuration content as string, or None if no valid config found.
    """
    cwd_path = Path(cwd).resolve()

    for label, path in _config_paths(cwd, GUIDANCE_BASENAME):
        logger.debug("Attempting to load %s guidance from: %s", label, path)

        try:
            if label == "Project":
                content = read_guidance_file(cwd_path)
            else:
                # For user config, validate against user home directory
                content = read_guidance_file(Path.home())

            if content is not None:
                logger.info("Loaded %s guidance configuration", label)
                return content

        except ValueError as e:
            logger.error("Invalid path configuration for %s: %s", label, e)
            continue

    logger.debug("No guidance configuration found")
    return None