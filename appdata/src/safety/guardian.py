"""
AppDater - Safety Guardian
Monitors disk space, RAM, and prevents system crashes.
"""

import shutil
import sys
from pathlib import Path
from typing import Tuple


try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


class SafetyGuardian:
    """Monitors system resources and prevents crashes"""

    # Safety thresholds
    MIN_DISK_FREE_GB = 10
    WARN_DISK_FREE_GB = 20
    MAX_RAM_USAGE_PCT = 85
    WARN_RAM_USAGE_PCT = 75

    def __init__(self, min_disk_free_gb: float = None):
        """
        Initialize Safety Guardian

        Args:
            min_disk_free_gb: Minimum free disk space in GB (default: 10)
        """
        if min_disk_free_gb is not None:
            self.MIN_DISK_FREE_GB = min_disk_free_gb

    def check_disk_space(self, target_path: str) -> Tuple[bool, str, dict]:
        """
        Check if enough disk space is available

        Args:
            target_path: Path to check disk space for

        Returns:
            Tuple of (is_safe, message, stats)

        Examples:
            >>> guardian = SafetyGuardian()
            >>> is_safe, msg, stats = guardian.check_disk_space("/path/to/files")
            >>> print(f"Safe: {is_safe}, Free: {stats['free_gb']:.1f}GB")
        """
        try:
            total, used, free = shutil.disk_usage(target_path)

            free_gb = free / (1024**3)
            total_gb = total / (1024**3)
            used_gb = used / (1024**3)
            used_pct = (used / total) * 100

            stats = {
                'total_gb': total_gb,
                'used_gb': used_gb,
                'free_gb': free_gb,
                'used_pct': used_pct
            }

            # CRITICAL: Check minimum threshold
            if free_gb < self.MIN_DISK_FREE_GB:
                message = (
                    f"🛑 CRITICAL: Only {free_gb:.1f}GB free! "
                    f"Need minimum {self.MIN_DISK_FREE_GB}GB. "
                    f"Operation ABORTED to prevent system crash."
                )
                return (False, message, stats)

            # WARNING: Check warning threshold
            if free_gb < self.WARN_DISK_FREE_GB:
                message = (
                    f"⚠️  WARNING: Only {free_gb:.1f}GB free. "
                    f"Recommended minimum is {self.WARN_DISK_FREE_GB}GB. "
                    f"Proceeding with caution..."
                )
                return (True, message, stats)

            # OK
            message = f"✓ Disk space OK: {free_gb:.1f}GB free ({used_pct:.1f}% used)"
            return (True, message, stats)

        except Exception as e:
            message = f"❌ Error checking disk space: {e}"
            return (False, message, {})

    def check_ram_usage(self) -> Tuple[bool, str, dict]:
        """
        Check RAM usage

        Returns:
            Tuple of (is_ok, message, stats)
        """
        if not PSUTIL_AVAILABLE:
            return (True, "⚠️  psutil not available, skipping RAM check", {})

        try:
            mem = psutil.virtual_memory()

            stats = {
                'total_gb': mem.total / (1024**3),
                'available_gb': mem.available / (1024**3),
                'used_pct': mem.percent
            }

            # CRITICAL: RAM usage too high
            if mem.percent > self.MAX_RAM_USAGE_PCT:
                message = (
                    f"🛑 CRITICAL: RAM at {mem.percent:.1f}%! "
                    f"Consider closing apps before continuing."
                )
                return (False, message, stats)

            # WARNING: RAM usage getting high
            if mem.percent > self.WARN_RAM_USAGE_PCT:
                message = (
                    f"⚠️  WARNING: RAM at {mem.percent:.1f}%. "
                    f"Monitor system performance."
                )
                return (True, message, stats)

            # OK
            message = f"✓ RAM OK: {mem.percent:.1f}% used"
            return (True, message, stats)

        except Exception as e:
            message = f"❌ Error checking RAM: {e}"
            return (True, message, {})  # Don't block on RAM check errors

    def pre_flight_check(self, target_dir: str) -> bool:
        """
        ABORT if system in danger

        Called BEFORE any file operations to prevent system crashes

        Args:
            target_dir: Directory where operations will be performed

        Returns:
            True if safe to proceed, False if should abort

        Examples:
            >>> guardian = SafetyGuardian()
            >>> if not guardian.pre_flight_check("/path/to/files"):
            ...     print("ABORTING: System safety check failed")
            ...     sys.exit(1)
        """
        print("\n🔍 Running pre-flight safety checks...\n")

        all_safe = True

        # Check 1: Disk space
        disk_safe, disk_msg, disk_stats = self.check_disk_space(target_dir)
        print(disk_msg)
        if not disk_safe:
            all_safe = False

        # Check 2: RAM usage
        ram_safe, ram_msg, ram_stats = self.check_ram_usage()
        print(ram_msg)
        if not ram_safe:
            print("   (You can continue, but system may slow down)")

        print()

        if not all_safe:
            print("🛑 SAFETY CHECK FAILED - ABORTING OPERATION")
            print("   Please free up disk space and try again.")
            return False

        print("✓ All safety checks passed - proceeding with operation\n")
        return True

    def estimate_operation_size(self, num_files: int, avg_file_size: int = 1024*1024*100) -> float:
        """
        Estimate disk space needed for operation (including logs, temp files)

        Args:
            num_files: Number of files to process
            avg_file_size: Average file size in bytes (default: 100MB)

        Returns:
            Estimated space needed in GB
        """
        # Estimate log files (1KB per file operation)
        log_size = num_files * 1024

        # Estimate temp files (assume 10% of total files might need temp space)
        temp_size = (num_files * 0.1) * avg_file_size

        # Total
        total_bytes = log_size + temp_size

        return total_bytes / (1024**3)

    def can_handle_operation(self, target_dir: str, num_files: int) -> Tuple[bool, str]:
        """
        Check if system can handle the planned operation

        Args:
            target_dir: Target directory
            num_files: Number of files to process

        Returns:
            Tuple of (can_handle, message)
        """
        # Check current disk space
        disk_safe, disk_msg, disk_stats = self.check_disk_space(target_dir)

        if not disk_safe:
            return (False, disk_msg)

        # Estimate space needed
        estimated_gb = self.estimate_operation_size(num_files)

        # Check if we have enough headroom
        available_gb = disk_stats.get('free_gb', 0)
        needed_gb = self.MIN_DISK_FREE_GB + estimated_gb

        if available_gb < needed_gb:
            message = (
                f"⚠️  WARNING: May not have enough space. "
                f"Available: {available_gb:.1f}GB, "
                f"Estimated needed: {needed_gb:.1f}GB "
                f"(including {self.MIN_DISK_FREE_GB}GB safety buffer)"
            )
            return (False, message)

        message = (
            f"✓ Sufficient space: {available_gb:.1f}GB available, "
            f"estimated {estimated_gb:.1f}GB needed for {num_files} files"
        )
        return (True, message)

    def continuous_monitor(self, target_dir: str) -> Tuple[bool, str]:
        """
        Monitor during operation (call periodically)

        Args:
            target_dir: Directory being operated on

        Returns:
            Tuple of (is_safe, message)
        """
        disk_safe, disk_msg, disk_stats = self.check_disk_space(target_dir)

        if not disk_safe:
            return (False, disk_msg)

        # Check if we're getting close to minimum
        free_gb = disk_stats.get('free_gb', 0)
        if free_gb < self.MIN_DISK_FREE_GB + 5:  # 5GB buffer
            message = f"⚠️  LOW DISK SPACE: {free_gb:.1f}GB remaining"
            return (True, message)

        return (True, "")
