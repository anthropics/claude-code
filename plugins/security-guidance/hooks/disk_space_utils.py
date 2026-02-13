#!/usr/bin/env python3
"""
Disk space utilities for Claude Code hooks.

Provides helper functions to detect and handle disk space issues (ENOSPC errors)
in a user-friendly manner.
"""

import errno
import os
import sys
from typing import Optional, Tuple


# ENOSPC errno value (28 on Linux/Mac)
ENOSPC_ERRNO = errno.ENOSPC


def is_disk_space_error(exception: Exception) -> bool:
    """Check if an exception is related to disk space issues.

    Args:
        exception: The exception to check

    Returns:
        True if the exception indicates a disk space issue
    """
    # Check for OSError with ENOSPC errno
    if isinstance(exception, OSError):
        if hasattr(exception, 'errno') and exception.errno == ENOSPC_ERRNO:
            return True
        # Also check strerror for various disk space error messages
        if hasattr(exception, 'strerror') and exception.strerror:
            strerror_lower = exception.strerror.lower()
            disk_space_indicators = [
                'no space left on device',
                'disk quota exceeded',
                'not enough space',
                'insufficient disk space',
            ]
            if any(indicator in strerror_lower for indicator in disk_space_indicators):
                return True

    # Check error message string as fallback
    error_str = str(exception).lower()
    if 'enospc' in error_str or 'no space left' in error_str:
        return True

    return False


def get_disk_space_warning() -> str:
    """Get a user-friendly warning message for disk space issues.

    Returns:
        Warning message string
    """
    return (
        "WARNING: Disk space issue detected. Your disk may be full or nearly full.\n"
        "This can cause Claude Code to become unresponsive or crash.\n"
        "\n"
        "Recommended actions:\n"
        "  1. Free up disk space by deleting unnecessary files\n"
        "  2. Check available space with: df -h\n"
        "  3. Clean up temporary files: sudo rm -rf /tmp/* (use with caution)\n"
        "  4. Empty trash/recycle bin\n"
        "  5. Consider removing old Docker images: docker system prune"
    )


def check_available_disk_space(path: str = None, min_bytes: int = 10 * 1024 * 1024) -> Tuple[bool, Optional[str]]:
    """Check if there's sufficient disk space available.

    Args:
        path: Path to check (defaults to home directory)
        min_bytes: Minimum required bytes (default: 10MB)

    Returns:
        Tuple of (has_space, warning_message)
        - has_space: True if sufficient space available
        - warning_message: Warning string if low on space, None otherwise
    """
    if path is None:
        path = os.path.expanduser("~")

    try:
        # Get disk usage statistics
        stat = os.statvfs(path)
        available_bytes = stat.f_frsize * stat.f_bavail

        if available_bytes < min_bytes:
            available_mb = available_bytes / (1024 * 1024)
            required_mb = min_bytes / (1024 * 1024)
            return False, (
                f"Low disk space warning: Only {available_mb:.1f}MB available "
                f"(recommended minimum: {required_mb:.1f}MB)\n"
                f"{get_disk_space_warning()}"
            )

        return True, None

    except (OSError, AttributeError):
        # os.statvfs not available on all platforms (e.g., Windows)
        # Return True and let actual write operations fail if there's no space
        return True, None


def safe_write_file(path: str, content: str, warn_on_disk_error: bool = True) -> Tuple[bool, Optional[str]]:
    """Safely write content to a file with disk space error handling.

    Args:
        path: Path to write to
        content: Content to write
        warn_on_disk_error: If True, print warning to stderr on disk space errors

    Returns:
        Tuple of (success, error_message)
        - success: True if write succeeded
        - error_message: Error description if failed, None otherwise
    """
    try:
        # Ensure directory exists
        dir_path = os.path.dirname(path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)

        with open(path, 'w') as f:
            f.write(content)

        return True, None

    except Exception as e:
        if is_disk_space_error(e):
            error_msg = f"Disk space error writing to {path}: {e}\n{get_disk_space_warning()}"
            if warn_on_disk_error:
                print(error_msg, file=sys.stderr)
            return False, error_msg
        else:
            return False, f"Error writing to {path}: {e}"


def safe_append_file(path: str, content: str, warn_on_disk_error: bool = True) -> Tuple[bool, Optional[str]]:
    """Safely append content to a file with disk space error handling.

    Args:
        path: Path to append to
        content: Content to append
        warn_on_disk_error: If True, print warning to stderr on disk space errors

    Returns:
        Tuple of (success, error_message)
        - success: True if append succeeded
        - error_message: Error description if failed, None otherwise
    """
    try:
        # Ensure directory exists
        dir_path = os.path.dirname(path)
        if dir_path:
            os.makedirs(dir_path, exist_ok=True)

        with open(path, 'a') as f:
            f.write(content)

        return True, None

    except Exception as e:
        if is_disk_space_error(e):
            error_msg = f"Disk space error appending to {path}: {e}\n{get_disk_space_warning()}"
            if warn_on_disk_error:
                print(error_msg, file=sys.stderr)
            return False, error_msg
        else:
            return False, f"Error appending to {path}: {e}"
