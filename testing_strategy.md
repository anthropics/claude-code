"""
Security Guidance Plugin - Extensibility Module

This module provides secure file reading capabilities for the security guidance plugin,
with comprehensive path traversal protection and input validation.
"""

import logging
import os
from pathlib import Path
from typing import Generator, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Constants
GUIDANCE_BASENAME = "claude-security-guidance.md"
MAX_FILE_SIZE_BYTES = 8192  # 8KB limit
ALLOWED_EXTENSIONS = {".md", ".markdown"}
ENCODING = "utf-8"
MAX_PATH_DEPTH = 10  # Maximum symlink resolution depth


class PathTraversalError(Exception):
    """Raised when a path traversal attempt is detected."""
    pass


class FileReadError(Exception):
    """Raised when file reading fails for security or I/O reasons."""
    pass


class PathResolutionError(Exception):
    """Raised when path resolution fails."""
    pass


def _validate_path_safety(
    resolved_path: Path,
    allowed_directories: List[Path],
    label: str
) -> None:
    """
    Validate that a resolved path is within allowed directories.
    
    Args:
        resolved_path: The resolved absolute path to validate
        allowed_directories: List of allowed parent directories
        label: Label for logging purposes
        
    Raises:
        PathTraversalError: If the path escapes allowed directories
    """
    try:
        resolved_str = str(resolved_path.resolve())
    except (OSError, RuntimeError) as e:
        logger.error("Failed to resolve path %s: %s", resolved_path, e)
        raise PathTraversalError(f"Path resolution failed: {e}") from e
    
    for allowed_dir in allowed_directories:
        try:
            allowed_str = str(allowed_dir.resolve())
        except (OSError, RuntimeError) as e:
            logger.warning("Failed to resolve allowed directory %s: %s", allowed_dir, e)
            continue
            
        if resolved_str.startswith(allowed_str + os.sep) or resolved_str == allowed_str:
            return
    
    logger.warning(
        "Path traversal detected for %s: %s resolves outside allowed directories",
        label,
        resolved_path
    )
    raise PathTraversalError(
        f"Path {resolved_path} resolves outside allowed directories"
    )


def _validate_file_extension(file_path: Path) -> None:
    """
    Validate that the file has an allowed extension.
    
    Args:
        file_path: Path to validate
        
    Raises:
        FileReadError: If the file extension is not allowed
    """
    suffix = file_path.suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise FileReadError(
            f"File extension '{suffix}' is not allowed. "
            f"Allowed extensions: {ALLOWED_EXTENSIONS}"
        )


def _validate_file_size(file_path: Path) -> None:
    """
    Validate that the file size is within acceptable limits.
    
    Args:
        file_path: Path to the file to check
        
    Raises:
        FileReadError: If the file exceeds maximum size
    """
    try:
        file_size = file_path.stat().st_size
        if file_size > MAX_FILE_SIZE_BYTES:
            raise FileReadError(
                f"File size {file_size} bytes exceeds maximum of {MAX_FILE_SIZE_BYTES} bytes"
            )
    except OSError as e:
        raise FileReadError(f"Failed to check file size: {e}") from e


def _validate_symlink_depth(file_path: Path, max_depth: int = MAX_PATH_DEPTH) -> None:
    """
    Validate that symlink resolution depth is within limits.
    
    Args:
        file_path: Path to validate
        max_depth: Maximum allowed symlink resolution depth
        
    Raises:
        PathTraversalError: If symlink depth exceeds maximum
    """
    depth = 0
    current = file_path
    
    while current.is_symlink():
        depth += 1
        if depth > max_depth:
            raise PathTraversalError(
                f"Symlink depth {depth} exceeds maximum of {max_depth}"
            )
        try:
            target = os.readlink(str(current))
            if not os.path.isabs(target):
                target = os.path.join(os.path.dirname(str(current)), target)
            current = Path(target)
        except OSError as e:
            raise PathTraversalError(f"Failed to read symlink: {e}") from e


def _get_allowed_directories(cwd: str) -> List[Path]:
    """
    Get the list of allowed directories for file reading.
    
    Args:
        cwd: Current working directory
        
    Returns:
        List of allowed Path objects
    """
    allowed_dirs: List[Path] = []
    
    # Project directory
    try:
        project_dir = Path(cwd).resolve()
        if project_dir.exists() and project_dir.is_dir():
            allowed_dirs.append(project_dir)
    except (OSError, RuntimeError) as e:
        logger.warning("Failed to resolve project directory %s: %s", cwd, e)
    
    # User's .claude directory
    try:
        user_claude_dir = Path.home() / ".claude"
        if user_claude_dir.exists() and user_claude_dir.is_dir():
            allowed_dirs.append(user_claude_dir.resolve())
    except (OSError, RuntimeError) as e:
        logger.warning("Failed to resolve user .claude directory: %s", e)
    
    return allowed_dirs


def _config_paths(cwd: str, basename: str) -> Generator[Tuple[str, Path], None, None]:
    """
    Generate configuration file paths to check.
    
    Args:
        cwd: Current working directory
        basename: Base filename to look for
        
    Yields:
        Tuple of (label, path) for each configuration location
    """
    # Check project-specific configuration first
    project_path = Path(cwd) / ".claude" / basename
    yield ("Project", project_path)
    
    # Check user-level configuration
    try:
        user_path = Path.home() / ".claude" / basename
        yield ("User", user_path)
    except (OSError, RuntimeError) as e:
        logger.warning("Failed to construct user path: %s", e)


def _safe_read_file(file_path: Path, max_size: int = MAX_FILE_SIZE_BYTES) -> Optional[str]:
    """
    Safely read a file with size and encoding validation.
    
    Args:
        file_path: Path to the file to read
        max_size: Maximum number of bytes to read
        
    Returns:
        File contents as string, or None if read fails
    """
    try:
        with open(file_path, "r", encoding=ENCODING) as f:
            content = f.read(max_size).strip()
        return content
    except UnicodeDecodeError as e:
        logger.error("Encoding error reading %s: %s", file_path, e)
        return None
    except IOError as e:
        logger.error("I/O error reading %s: %s", file_path, e)
        return None
    except Exception as e:
        logger.error("Unexpected error reading %s: %s", file_path, e)
        return None


def read_guidance_file(
    file_path: Path,
    label: str,
    allowed_directories: List[Path]
) -> Optional[str]:
    """
    Securely read a guidance file with comprehensive validation.
    
    This function implements multiple security checks:
    1. Path traversal protection via realpath resolution
    2. File extension validation
    3. File size limits
    4. Symlink resolution and validation
    5. Symlink depth limits
    
    Args:
        file_path: Path to the guidance file
        label: Label for logging (e.g., "Project", "User")
        allowed_directories: List of directories the file must reside in
        
    Returns:
        File contents as string if valid, None if file doesn't exist or is invalid
        
    Raises:
        FileReadError: If file exists but fails security validation
    """
    try:
        # Check if file exists
        if not file_path.exists():
            logger.debug("Guidance file not found at %s: %s", label, file_path)
            return None
        
        # Validate symlink depth before resolution
        try:
            _validate_symlink_depth(file_path)
        except PathTraversalError as e:
            logger.warning(
                "Skipping %s guidance file due to symlink depth: %s - %s",
                label,
                file_path,
                e
            )
            return None
        
        # Resolve symlinks and get real path
        try:
            resolved_path = file_path.resolve(strict=True)
        except (OSError, RuntimeError) as e:
            logger.error("Failed to resolve path %s: %s", file_path, e)
            raise FileReadError(f"Path resolution failed: {e}") from e
        
        # Validate path safety (prevents symlink attacks)
        _validate_path_safety(resolved_path, allowed_directories, label)
        
        # Validate file extension
        _validate_file_extension(resolved_path)
        
        # Validate file size before reading
        _validate_file_size(resolved_path)
        
        # Read file content with size limit
        content = _safe_read_file(resolved_path)
        
        if content is None:
            logger.error("Failed to read %s guidance file: %s", label, resolved_path)
            return None
        
        if not content:
            logger.debug("Empty guidance file at %s: %s", label, resolved_path)
            return None
        
        logger.info(
            "Successfully read %s guidance file (%d bytes): %s",
            label,
            len(content),
            resolved_path
        )
        
        return content
        
    except PathTraversalError:
        logger.warning(
            "Skipping %s guidance file due to path traversal detection: %s",
            label,
            file_path
        )
        return None
    except FileReadError as e:
        logger.error(
            "Failed to read %s guidance file: %s - %s",
            label,
            file_path,
            e
        )
        return None


def load_guidance(cwd: str) -> Optional[str]:
    """
    Load security guidance from configuration files.
    
    Searches for guidance files in order of priority:
    1. Project-specific (.claude/claude-security-guidance.md in cwd)
    2. User-level (~/.claude/claude-security-guidance.md)
    
    All files are validated for security before reading.
    
    Args:
        cwd: Current working directory path
        
    Returns:
        Combined guidance content as string, or None if no valid guidance found
        
    Raises:
        ValueError: If cwd is invalid or empty
    """
    if not cwd or not isinstance(cwd, str):
        raise ValueError("Current working directory must be a non-empty string")
    
    # Validate and resolve cwd
    try:
        cwd_path = Path(cwd).resolve()
        if not cwd_path.exists():
            raise ValueError(f"Directory does not exist: {cwd}")
        if not cwd_path.is_dir():
            raise ValueError(f"Path is not a directory: {cwd}")
    except (OSError, RuntimeError) as e:
        raise ValueError(f"Invalid directory path: {e}") from e
    
    # Get allowed directories
    allowed_directories = _get_allowed_directories(cwd)
    
    if not allowed_directories:
        logger.warning("No allowed directories configured for guidance file reading")
        return None
    
    # Collect guidance content from all sources
    guidance_parts: List[str] = []
    
    for label, path in _config_paths(cwd, GUIDANCE_BASENAME):
        try:
            content = read_guidance_file(path, label, allowed_directories)
            if content:
                guidance_parts.append(content)
        except Exception as e:
            logger.error(
                "Unexpected error processing %s guidance file %s: %s",
                label,
                path,
                e
            )
            continue
    
    if not guidance_parts:
        logger.debug("No valid guidance files found")
        return None
    
    # Combine guidance from multiple sources
    combined_guidance = "\n\n".join(guidance_parts)
    
    logger.info(
        "Loaded guidance from %d source(s) (%d total characters)",
        len(guidance_parts),
        len(combined_guidance)
    )
    
    return combined_guidance