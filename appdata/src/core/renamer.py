"""
AppDater - Smart Renamer
Renames files with safety checks and prevents duplicate version tags.
"""

import re
from typing import Optional
from datetime import datetime
from pathlib import Path

from .validator import FilenameValidator


class SmartRenamer:
    """Renames files with safety checks and validation"""

    def __init__(self, validator: Optional[FilenameValidator] = None):
        self.validator = validator or FilenameValidator()

    def extract_version(self, filename: str) -> Optional[str]:
        """
        Extract version number from filename

        Args:
            filename: Original filename

        Returns:
            Version string or None if not found

        Examples:
            'Transmit 5.11.0 [atb].dmg' → '5.11.0'
            'Adobe_Photoshop_27.0.dmg' → '27.0'
            'Stats.dmg' → None (use date fallback)
        """
        # Remove extension for cleaner matching
        name_only = filename.rsplit('.', 1)[0] if '.' in filename else filename

        # Remove brackets first
        clean = re.sub(r'\[.*?\]', '', name_only)

        # Pattern 1: Semantic versioning (x.y.z or x.y)
        match = re.search(r'\b(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)\b', clean)
        if match:
            return match.group(1)

        # Pattern 2: Single version number followed by extension
        match = re.search(r'\b(\d+)\s*$', clean)
        if match:
            return match.group(1)

        return None

    def clean_filename(self, filename: str) -> str:
        """
        Remove junk from filename (release groups, architecture markers, etc.)

        Args:
            filename: Original filename

        Returns:
            Cleaned filename

        Examples:
            'Transmit 5.11.0 [atb].dmg' → 'Transmit 5.11.0'
            'App_v1.0_MAS.dmg' → 'App 1.0'
        """
        # Remove extension
        name_only = filename.rsplit('.', 1)[0] if '.' in filename else filename

        # Remove release group tags in brackets
        clean = re.sub(r'\[.*?\]', '', name_only)

        # Remove common markers (MAS, In-App, Intel, etc.)
        markers = [
            r'[_\s-](MAS|In-App|UB|Intel|x64|x86|ARM|Universal)',
            r'[_\s-](TNT|atb|CORE|CRACKSNOw)',
        ]
        for marker in markers:
            clean = re.sub(marker, '', clean, flags=re.IGNORECASE)

        # Remove multiple spaces/underscores
        clean = re.sub(r'[\s_]+', ' ', clean)

        # Remove trailing/leading whitespace
        clean = clean.strip()

        return clean

    def extract_manufacturer_and_product(self, filename: str) -> tuple[str, str]:
        """
        Extract manufacturer and product name from filename

        Args:
            filename: Cleaned filename (without version)

        Returns:
            Tuple of (manufacturer, product)

        Examples:
            'Adobe Photoshop' → ('Adobe', 'Photoshop')
            'Final Cut Pro' → ('Apple', 'Final.Cut.Pro')  # Assume Apple if single word
            'Transmit' → ('Panic', 'Transmit')  # Would need config for this
        """
        # Remove version numbers first
        clean = re.sub(r'\d+[\d.]*', '', filename).strip()

        # Split by spaces/dots/underscores
        parts = re.split(r'[\s._-]+', clean)
        parts = [p for p in parts if p]

        if len(parts) >= 2:
            # First part is manufacturer, rest is product
            manufacturer = parts[0]
            product = '.'.join(parts[1:])
        elif len(parts) == 1:
            # Only product name, use generic manufacturer
            manufacturer = parts[0]
            product = parts[0]
        else:
            manufacturer = "Unknown"
            product = "Unknown"

        return manufacturer, product

    def generate_new_name(self, old_name: str, file_path: Optional[Path] = None) -> Optional[str]:
        """
        Generate NEW filename following: Manufacturer.Product_vVersion.ext

        WITH SAFETY CHECKS to prevent duplicate version tags!

        Args:
            old_name: Original filename
            file_path: Path to file (for mtime fallback)

        Returns:
            New filename or None if should skip

        Examples:
            'Transmit 5.11.0 [atb].dmg' → 'Panic.Transmit_v5.11.0.dmg'
            'Adobe Photoshop 27.0.0.dmg' → 'Adobe.Photoshop_v27.0.0.dmg'
            'Stats.dmg' → 'Stats_v241117.dmg' (date fallback)
        """
        # CRITICAL CHECK #1: Skip if already processed
        if self.validator.has_version_tag(old_name):
            print(f"⏭️  SKIP: Already has _v tag: {old_name}")
            return None

        # Extract extension
        if '.' not in old_name:
            print(f"❌ REJECT: No extension: {old_name}")
            return None

        ext = old_name.rsplit('.', 1)[-1]
        name_only = old_name.rsplit('.', 1)[0]

        # Clean up filename
        clean_name = self.clean_filename(old_name)

        # Extract version
        version = self.extract_version(old_name)

        if not version:
            # Fallback: Use modification date if available
            if file_path and file_path.exists():
                mtime = file_path.stat().st_mtime
                version = datetime.fromtimestamp(mtime).strftime('%y%m%d')
            else:
                # Last resort: Use current date
                version = datetime.now().strftime('%y%m%d')

        # Extract product name (without version)
        product_name = self.validator.extract_product_name(old_name)

        # Build new name: Product_vVersion.ext
        new_name = f"{product_name}_v{version}.{ext}"

        # VALIDATE before returning (allow _v tag since we just added it!)
        is_valid, error = self.validator.validate_new_filename(new_name, allow_version_tag=True)
        if not is_valid:
            print(f"❌ REJECT: {error}: {new_name}")
            return None

        return new_name

    def preview_rename(self, old_name: str, file_path: Optional[Path] = None) -> dict:
        """
        Preview what would happen during rename (for dry-run mode)

        Args:
            old_name: Original filename
            file_path: Path to file

        Returns:
            Dictionary with preview information
        """
        new_name = self.generate_new_name(old_name, file_path)

        result = {
            'old_name': old_name,
            'new_name': new_name,
            'will_rename': new_name is not None,
            'reason': ''
        }

        if new_name is None:
            if self.validator.has_version_tag(old_name):
                result['reason'] = 'Already has version tag'
            else:
                result['reason'] = 'Validation failed'
        else:
            result['reason'] = 'OK'

        return result

    def should_delete_intel(self, filename: str) -> bool:
        """
        Check if file should be deleted (Intel-only builds)

        Args:
            filename: The filename to check

        Returns:
            True if file should be deleted
        """
        return self.validator.is_intel_file(filename)
