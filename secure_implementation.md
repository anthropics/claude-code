import os
import logging
from typing import List, Optional, Tuple, Union
from pathlib import Path
import stat

logger = logging.getLogger(__name__)

# Constants
GUIDANCE_BASENAME = "claude-security-guidance.md"
MAX_GUIDANCE_FILE_SIZE = 8192  # 8KB
ALLOWED_USER_CONFIG_DIR = ".claude"
S_IFREG = 0o100000  # Regular file mode constant


def _normalize_path(path: Union[str, Path]) -> str:
    """
    Normalize a path by expanding user home directory and resolving symlinks.
    
    Args:
        path: Path to normalize
        
    Returns:
        Normalized absolute path string
        
    Raises:
        ValueError: If path is empty or invalid
        OSError: If path resolution fails
    """
    if not path:
        raise ValueError("Path cannot be empty")
    
    path_obj = Path(path).expanduser()
    
    # Resolve symlinks if path exists, otherwise resolve parent directories
    if path_obj.exists():
        return str(path_obj.resolve())
    else:
        # For non-existent paths, resolve the parent directory
        parent = path_obj.parent
        if parent.exists():
            resolved_parent = str(parent.resolve())
            return os.path.join(resolved_parent, path_obj.name)
        return str(path_obj.absolute())


def _get_allowed_directories(cwd: str) -> List[str]:
    """
    Get list of allowed directories for guidance file resolution.
    
    Args:
        cwd: Current working directory (project root)
        
    Returns:
        List of normalized allowed directory paths with trailing separators
    """
    allowed_dirs: List[str] = []
    
    # Project root directory
    if cwd:
        try:
            project_dir = _normalize_path(cwd)
            allowed_dirs.append(project_dir.rstrip(os.sep) + os.sep)
        except (ValueError, OSError) as e:
            logger.error("Failed to normalize project directory %s: %s", cwd, str(e))
    
    # User config directory
    try:
        user_config_dir = os.path.join(os.path.expanduser("~"), ALLOWED_USER_CONFIG_DIR)
        user_dir_normalized = _normalize_path(user_config_dir)
        allowed_dirs.append(user_dir_normalized.rstrip(os.sep) + os.sep)
    except (ValueError, OSError) as e:
        logger.error("Failed to normalize user config directory: %s", str(e))
    
    return allowed_dirs


def _is_path_within_allowed_directories(
    resolved_path: str,
    allowed_dirs: List[str]
) -> bool:
    """
    Check if a resolved path is within any of the allowed directories.
    
    Uses strict prefix matching with directory separator awareness to prevent
    partial directory name matches (e.g., /home/user/project-extra matching
    /home/user/project).
    
    Args:
        resolved_path: The resolved absolute path to check
        allowed_dirs: List of normalized allowed directory paths with trailing separators
        
    Returns:
        True if path is within allowed directories, False otherwise
    """
    if not resolved_path or not allowed_dirs:
        return False
    
    resolved_normalized = resolved_path.rstrip(os.sep)
    
    for allowed_dir in allowed_dirs:
        # Check if resolved path starts with allowed directory
        if resolved_normalized.startswith(allowed_dir.rstrip(os.sep)):
            # Ensure exact match or directory boundary
            remainder = resolved_normalized[len(allowed_dir.rstrip(os.sep)):]
            if not remainder or remainder.startswith(os.sep):
                return True
    
    return False


def _resolve_and_validate_path(
    path: str,
    allowed_dirs: List[str]
) -> Optional[str]:
    """
    Resolve symlinks and validate that the resolved path stays within
    allowed directory boundaries.
    
    This prevents symlink traversal attacks where a malicious repository
    could create a symlink pointing to sensitive files outside the project.
    
    Args:
        path: The path to validate
        allowed_dirs: List of allowed directory paths with trailing separators
        
    Returns:
        Resolved path if valid, None otherwise
    """
    try:
        if not path:
            logger.debug("Empty path provided for validation")
            return None
        
        # Resolve all symlinks and relative path components
        resolved_path = _normalize_path(path)
        
        # Validate the resolved path is within allowed directories
        if not _is_path_within_allowed_directories(resolved_path, allowed_dirs):
            logger.debug(
                "Path validation failed: %s resolved to %s, "
                "which is outside allowed directories: %s",
                path,
                resolved_path,
                allowed_dirs
            )
            return None
        
        return resolved_path
        
    except (OSError, ValueError, RuntimeError) as e:
        logger.error("Path resolution error for %s: %s", path, str(e))
        return None


def _validate_file_safety(file_path: str) -> bool:
    """
    Validate that the file is safe to read (regular file, not a special device).
    
    Performs comprehensive checks including:
    - File existence and regular file type verification
    - Permission checks to ensure readability
    - Device and inode validation to prevent reading special files
    
    Args:
        file_path: Path to the file to validate
        
    Returns:
        True if file is safe to read, False otherwise
    """
    try:
        if not file_path:
            logger.debug("Empty file path provided for safety validation")
            return False
        
        # Check if path exists
        if not os.path.exists(file_path):
            logger.debug("File does not exist: %s", file_path)
            return False
        
        # Check if it's a regular file (not a device, socket, FIFO, etc.)
        try:
            file_mode = os.stat(file_path).st_mode
            if not stat.S_ISREG(file_mode):
                logger.warning(
                    "File %s is not a regular file (mode: %o)",
                    file_path,
                    file_mode
                )
                return False
        except OSError as e:
            logger.error("Error checking file type for %s: %s", file_path, str(e))
            return False
        
        # Check read permissions
        if not os.access(file_path, os.R_OK):
            logger.warning("File %s is not readable", file_path)
            return False
        
        return True
        
    except (OSError, AttributeError) as e:
        logger.error("Error checking file safety for %s: %s", file_path, str(e))
        return False


def _read_file_with_size_limit(
    file_path: str,
    max_size: int = MAX_GUIDANCE_FILE_SIZE
) -> Optional[str]:
    """
    Read a file with size limit to prevent memory exhaustion.
    
    Implements safe file reading with:
    - Size limit enforcement to prevent memory exhaustion
    - UTF-8 encoding with error replacement for robustness
    - Proper resource management via context manager
    - Truncation detection and logging
    
    Args:
        file_path: Path to the file to read
        max_size: Maximum number of bytes to read (default: 8KB)
        
    Returns:
        File contents as string if successful, None otherwise
    """
    try:
        if not file_path:
            logger.debug("Empty file path provided for reading")
            return None
        
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            # Read only up to max_size bytes
            content = f.read(max_size)
            
            # Check if file was truncated (read less than file size)
            if len(content) >= max_size:
                logger.warning(
                    "Guidance file %s exceeds maximum size of %d bytes, content truncated",
                    file_path,
                    max_size
                )
            
            return content.strip()
            
    except (IOError, OSError, UnicodeDecodeError) as e:
        logger.error("Error reading guidance file %s: %s", file_path, str(e))
        return None


def _config_paths(cwd: str, basename: str) -> List[Tuple[str, str]]:
    """
    Get configuration file paths for guidance files.
    
    Generates paths for both project-level and user-level configuration files.
    Project-level paths are relative to the current working directory.
    User-level paths are relative to the user's home directory.
    
    Args:
        cwd: Current working directory (project root)
        basename: Base filename to look for
        
    Returns:
        List of (label, path) tuples in priority order (project first)
    """
    paths: List[Tuple[str, str]] = []
    
    # Project-level configuration (higher priority)
    if cwd:
        project_path = os.path.join(cwd, ".claude", basename)
        paths.append(("Project", project_path))
    
    # User-level configuration (lower priority)
    user_path = os.path.join(os.path.expanduser("~"), ".claude", basename)
    paths.append(("User", user_path))
    
    return paths


def read_guidance_file_safe(
    cwd: str,
    basename: str = GUIDANCE_BASENAME
) -> List[Tuple[str, str]]:
    """
    Safely read guidance files with symlink validation and security checks.
    
    This function reads guidance configuration files while preventing
    symlink traversal attacks. It validates that all resolved paths
    remain within allowed directory boundaries and performs comprehensive
    security checks before reading file contents.
    
    Security features:
    - Symlink resolution and validation
    - Directory boundary enforcement
    - File type verification (regular files only)
    - Size limit enforcement
    - Permission checks
    
    Args:
        cwd: Current working directory (project root)
        basename: Base filename to look for (default: GUIDANCE_BASENAME)
        
    Returns:
        List of (label, content) tuples for successfully read files
        
    Raises:
        ValueError: If basename is empty or invalid
        
    Example:
        >>> results = read_guidance_file_safe("/path/to/project")
        >>> for label, content in results:
        ...     print(f"{label}: {content[:50]}...")
    """
    # Input validation
    if not basename or not isinstance(basename, str):
        raise ValueError("Basename must be a non-empty string")
    
    if cwd and not os.path.isdir(cwd):
        logger.warning("Invalid working directory: %s", cwd)
        return []
    
    # Get allowed directories
    allowed_dirs = _get_allowed_directories(cwd)
    
    if not allowed_dirs:
        logger.warning("No allowed directories configured")
        return []
    
    # Get configuration paths
    config_paths = _config_paths(cwd, basename)
    
    results: List[Tuple[str, str]] = []
    
    for label, path in config_paths:
        try:
            # Skip if path doesn't exist
            if not os.path.exists(path):
                logger.debug("Guidance file not found: %s (%s)", path, label)
                continue
            
            # Resolve and validate path
            validated_path = _resolve_and_validate_path(path, allowed_dirs)
            if validated_path is None:
                logger.warning(
                    "Skipping guidance file %s (%s): path validation failed",
                    path,
                    label
                )
                continue
            
            # Validate file safety
            if not _validate_file_safety(validated_path):
                logger.warning(
                    "Skipping guidance file %s (%s): file safety validation failed",
                    validated_path,
                    label
                )
                continue
            
            # Read file with size limit
            content = _read_file_with_size_limit(validated_path)
            if content is None:
                logger.warning(
                    "Failed to read guidance file %s (%s)",
                    validated_path,
                    label
                )
                continue
            
            # Only add non-empty content
            if content:
                results.append((label, content))
                logger.debug(
                    "Successfully read guidance file %s (%s): %d characters",
                    validated_path,
                    label,
                    len(content)
                )
            else:
                logger.debug(
                    "Guidance file %s (%s) is empty, skipping",
                    validated_path,
                    label
                )
                
        except Exception as e:
            logger.error(
                "Unexpected error processing guidance file %s (%s): %s",
                path,
                label,
                str(e),
                exc_info=True
            )
            continue
    
    return results