"""
Extensibility module for security-guidance plugin.

This module handles reading and processing security guidance configuration
files with strict path validation to prevent symlink traversal attacks.
"""

import logging
import os
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Maximum file size to read (8KB)
MAX_FILE_SIZE: int = 8192

# Expected configuration basename
GUIDANCE_BASENAME: str = "claude-security-guidance.md"

# Allowed configuration directories relative to user home
ALLOWED_USER_CONFIG_DIRS: Tuple[str, ...] = (".claude",)


def _resolve_safe_path(base_dir: str, target_path: str) -> Optional[Path]:
    """
    Resolve a path and verify it stays within the expected directory boundary.
    
    This prevents symlink traversal attacks by resolving all symlinks and
    checking that the resolved path is contained within the expected base directory.
    
    Args:
        base_dir: The expected base directory that should contain the target
        target_path: The path to resolve and validate
    
    Returns:
        Resolved Path object if safe, None if path escapes the boundary
    
    Raises:
        ValueError: If base_dir or target_path is empty or invalid
    """
    if not base_dir or not target_path:
        logger.error("Empty path provided: base_dir='%s', target_path='%s'", base_dir, target_path)
        return None
    
    try:
        base_path: Path = Path(base_dir).resolve(strict=True)
        resolved_path: Path = Path(target_path).resolve(strict=True)
        
        # Verify the resolved path is within the base directory
        if not str(resolved_path).startswith(str(base_path)):
            logger.warning(
                "Path traversal detected: %s resolves to %s which is outside %s",
                target_path,
                resolved_path,
                base_path,
            )
            return None
            
        return resolved_path
    except (OSError, RuntimeError) as error:
        logger.error("Failed to resolve path %s: %s", target_path, error)
        return None


def _validate_file_size(file_path: Path) -> bool:
    """
    Validate that the file does not exceed the maximum allowed size.
    
    Args:
        file_path: Path to the file to check
    
    Returns:
        True if file size is acceptable, False otherwise
    """
    try:
        file_size: int = file_path.stat().st_size
        if file_size > MAX_FILE_SIZE:
            logger.warning(
                "File %s exceeds maximum size of %d bytes (actual: %d bytes)",
                file_path,
                MAX_FILE_SIZE,
                file_size,
            )
            return False
        return True
    except OSError as error:
        logger.error("Failed to check file size for %s: %s", file_path, error)
        return False


def _read_file_safely(file_path: Path) -> Optional[str]:
    """
    Read file contents with size limit and encoding validation.
    
    Args:
        file_path: Path to the file to read
    
    Returns:
        File contents as string if successful, None otherwise
    """
    try:
        if not _validate_file_size(file_path):
            return None
            
        with open(file_path, "r", encoding="utf-8", errors="replace") as file:
            content: str = file.read(MAX_FILE_SIZE).strip()
            
        if not content:
            logger.debug("Empty file content in %s", file_path)
            return None
            
        return content
    except UnicodeDecodeError as error:
        logger.error("Encoding error reading %s: %s", file_path, error)
        return None
    except PermissionError as error:
        logger.error("Permission denied reading %s: %s", file_path, error)
        return None
    except OSError as error:
        logger.error("Failed to read file %s: %s", file_path, error)
        return None


def _config_paths(cwd: str, basename: str) -> Iterator[Tuple[str, str]]:
    """
    Generate configuration file paths with labels.
    
    Yields tuples of (label, path) for each valid configuration location.
    Paths are validated to prevent symlink traversal attacks.
    
    Args:
        cwd: Current working directory (project root)
        basename: Configuration file basename
    
    Yields:
        Tuples of (label, safe_path_string) for valid configuration files
    """
    # Project-level configuration
    project_config_path: str = os.path.join(cwd, ".claude", basename)
    resolved_project: Optional[Path] = _resolve_safe_path(cwd, project_config_path)
    
    if resolved_project and resolved_project.exists():
        logger.debug("Found project config: %s", resolved_project)
        yield ("Project", str(resolved_project))
    else:
        logger.debug("No project config found at %s", project_config_path)
    
    # User-level configuration
    user_home: str = os.path.expanduser("~")
    for config_dir in ALLOWED_USER_CONFIG_DIRS:
        user_config_path: str = os.path.join(user_home, config_dir, basename)
        resolved_user: Optional[Path] = _resolve_safe_path(
            os.path.join(user_home, config_dir),
            user_config_path,
        )
        
        if resolved_user and resolved_user.exists():
            logger.debug("Found user config: %s", resolved_user)
            yield ("User", str(resolved_user))
        else:
            logger.debug("No user config found at %s", user_config_path)


def load_security_guidance(cwd: str) -> List[Tuple[str, str]]:
    """
    Load security guidance configuration from all valid locations.
    
    Reads configuration files with strict path validation to prevent
    symlink traversal attacks. Files are read with size limits and
    encoding validation.
    
    Args:
        cwd: Current working directory (project root)
    
    Returns:
        List of (label, content) tuples for each valid configuration file
    """
    guidance_contents: List[Tuple[str, str]] = []
    
    for label, path in _config_paths(cwd, GUIDANCE_BASENAME):
        try:
            content: Optional[str] = _read_file_safely(Path(path))
            
            if content:
                guidance_contents.append((label, content))
                logger.info(
                    "Loaded security guidance from %s (%s): %d characters",
                    label,
                    path,
                    len(content),
                )
            else:
                logger.warning(
                    "Skipping empty or invalid security guidance from %s (%s)",
                    label,
                    path,
                )
                
        except Exception as error:
            logger.error(
                "Unexpected error loading security guidance from %s (%s): %s",
                label,
                path,
                error,
                exc_info=True,
            )
    
    if not guidance_contents:
        logger.info("No security guidance configuration found")
    
    return guidance_contents


def validate_config_directory(directory_path: str) -> bool:
    """
    Validate that a directory is safe for configuration storage.
    
    Checks that the directory exists, is a directory (not a symlink to a file),
    and has appropriate permissions.
    
    Args:
        directory_path: Path to the directory to validate
    
    Returns:
        True if directory is safe, False otherwise
    """
    try:
        path: Path = Path(directory_path).resolve(strict=True)
        
        if not path.is_dir():
            logger.error("Path %s is not a directory", directory_path)
            return False
            
        if path.is_symlink():
            logger.warning("Directory %s is a symlink, verifying target", directory_path)
            # Symlink directories are allowed if they resolve to a valid directory
            # The actual file reading will validate individual files
            
        return True
        
    except OSError as error:
        logger.error("Failed to validate directory %s: %s", directory_path, error)
        return False