"""
AppDater - Filename Validator
Validates filenames and prevents naming errors like duplicate version tags.
"""

import re
from typing import Tuple


class FilenameValidator:
    """Validates filenames and prevents naming errors"""

    def __init__(self):
        self.max_filename_bytes = 250  # macOS HFS+ limit
        self.invalid_chars = ['/', '\x00', '|', ':', '*', '?', '"', '<', '>']

    def has_version_tag(self, filename: str) -> bool:
        """
        Check if filename ALREADY has _vX pattern

        This is CRITICAL to prevent bug #1 (duplicate version tags)

        Args:
            filename: The filename to check

        Returns:
            True if filename contains _vX.X or similar pattern

        Examples:
            >>> validator = FilenameValidator()
            >>> validator.has_version_tag("Transmit.5.11.0_v5.11.dmg")
            True
            >>> validator.has_version_tag("Transmit 5.11.0 [atb].dmg")
            False
        """
        return bool(re.search(r'_v[\d.]+', filename))

    def extract_product_name(self, filename: str) -> str:
        """
        Extract CLEAN product name from messy filename

        Args:
            filename: Original filename

        Returns:
            Cleaned product name

        Examples:
            'Transmit 5.11.0 [atb].dmg' → 'Transmit'
            'Adobe.Photoshop.27.0.0.dmg' → 'Adobe.Photoshop'
            'A_Better_Finder_Attributes_7_7.40_[TNT].dmg' → 'A.Better.Finder.Attributes'
        """
        # Remove extension first
        name_only = filename.rsplit('.', 1)[0] if '.' in filename else filename

        # Remove brackets and their contents
        clean = re.sub(r'\[.*?\]', '', name_only)

        # Remove common suffixes (MAS, Intel, ARM, etc.)
        clean = re.sub(r'(_| )(MAS|In-App|UB|Intel|x64|x86|ARM|TNT|atb)(_| |$)', ' ', clean, flags=re.I)

        # Remove version numbers and everything after
        clean = re.sub(r'\s+\d+[\d.]+.*$', '', clean)
        clean = re.sub(r'[._]\d+[\d.]+.*$', '', clean)

        # Normalize separators: replace underscores with dots
        clean = clean.replace('_', '.').replace(' ', '.')

        # Remove multiple dots
        clean = re.sub(r'\.+', '.', clean)

        # Remove trailing/leading dots
        clean = clean.strip('.')

        # Split and take first meaningful parts (usually 1-3 words)
        parts = [p for p in clean.split('.') if p and not p[0].isdigit()]

        # Take up to 3 parts for product name
        product_name = '.'.join(parts[:3]) if parts else "Unknown"

        return product_name

    def validate_new_filename(self, filename: str, allow_version_tag: bool = False) -> Tuple[bool, str]:
        """
        Validate filename BEFORE rename

        Args:
            filename: Proposed new filename
            allow_version_tag: If True, allow _v tags in filename (for newly generated names)

        Returns:
            Tuple of (is_valid, error_message)

        Examples:
            >>> validator = FilenameValidator()
            >>> validator.validate_new_filename("Adobe.Photoshop_v27.0.0.dmg", allow_version_tag=True)
            (True, "")
            >>> validator.validate_new_filename("Already_v1.0_v2.0.dmg")
            (False, "File already processed (has _v tag)")
        """
        # Check 1: Not too long (macOS HFS+ limit)
        if len(filename.encode('utf-8')) > self.max_filename_bytes:
            return (False, f"Filename too long ({len(filename.encode('utf-8'))} bytes, max {self.max_filename_bytes})")

        # Check 2: Already has _vX (CRITICAL - prevents duplicate version tags)
        # Skip this check if allow_version_tag=True (when validating newly generated names)
        if not allow_version_tag and self.has_version_tag(filename):
            return (False, "File already processed (has _v tag)")

        # Check 3: No invalid characters
        for char in self.invalid_chars:
            if char in filename:
                return (False, f"Invalid character '{char}' in filename")

        # Check 4: Must have extension
        if '.' not in filename:
            return (False, "Filename must have an extension")

        # Check 5: Extension must be valid
        ext = filename.rsplit('.', 1)[-1].lower()
        valid_extensions = ['dmg', 'pkg', 'iso', 'app', 'zip']
        if ext not in valid_extensions:
            return (False, f"Invalid extension '.{ext}' (expected: {', '.join(valid_extensions)})")

        return (True, "")

    def is_intel_file(self, filename: str) -> bool:
        """
        Check if filename indicates Intel-only architecture

        Args:
            filename: The filename to check

        Returns:
            True if file is Intel-only (should be deleted)

        Examples:
            >>> validator = FilenameValidator()
            >>> validator.is_intel_file("App_Intel.dmg")
            True
            >>> validator.is_intel_file("App_x64.dmg")
            True
            >>> validator.is_intel_file("App_Universal.dmg")
            False
        """
        # Intel markers - match with underscores, spaces, or dots
        intel_markers = [
            r'[_\s.-]Intel[_\s.-]',
            r'[_\s.-]Intel\.',
            r'_Intel$',
            r'[_\s.-]x64[_\s.-]',
            r'[_\s.-]x86[_\s.-]',
            r'[_\s.-]64bit[_\s.-]',
        ]

        for marker in intel_markers:
            if re.search(marker, filename, re.IGNORECASE):
                # Make sure it's not marked as Universal Binary
                if not re.search(r'(Universal|UB|ARM)', filename, re.IGNORECASE):
                    return True

        return False

    def is_safe_to_process(self, filename: str) -> Tuple[bool, str]:
        """
        Comprehensive safety check before processing

        Args:
            filename: The filename to check

        Returns:
            Tuple of (is_safe, reason)
        """
        # Check if already processed
        if self.has_version_tag(filename):
            return (False, "Already processed (has version tag)")

        # Check if it's a system file
        system_prefixes = ['.', '_']
        if any(filename.startswith(prefix) for prefix in system_prefixes):
            return (False, "System or hidden file")

        # Check extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        valid_extensions = ['dmg', 'pkg', 'iso']
        if ext not in valid_extensions:
            return (False, f"Not a supported file type (.{ext})")

        return (True, "")
