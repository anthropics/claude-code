"""
AppDater - Validator Tests
Tests for filename validation and safety checks.
"""

import unittest
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.validator import FilenameValidator


class TestFilenameValidator(unittest.TestCase):
    """Test FilenameValidator class"""

    def setUp(self):
        """Set up test fixtures"""
        self.validator = FilenameValidator()

    def test_has_version_tag(self):
        """Test detection of existing version tags"""
        # Should detect _v pattern
        self.assertTrue(self.validator.has_version_tag("Transmit.5.11.0_v5.11.dmg"))
        self.assertTrue(self.validator.has_version_tag("App_v1.0.0.pkg"))
        self.assertTrue(self.validator.has_version_tag("Product_v2.5.dmg"))

        # Should NOT detect in files without _v
        self.assertFalse(self.validator.has_version_tag("Transmit 5.11.0 [atb].dmg"))
        self.assertFalse(self.validator.has_version_tag("Stats.dmg"))
        self.assertFalse(self.validator.has_version_tag("Adobe Photoshop 27.0.0.dmg"))

    def test_extract_product_name(self):
        """Test product name extraction"""
        # Test various filename formats
        self.assertEqual(
            self.validator.extract_product_name("Transmit 5.11.0 [atb].dmg"),
            "Transmit"
        )

        self.assertEqual(
            self.validator.extract_product_name("Adobe.Photoshop.27.0.0.dmg"),
            "Adobe.Photoshop"
        )

        # Test with underscores
        result = self.validator.extract_product_name("A_Better_Finder_Attributes_7_7.40_[TNT].dmg")
        # Should remove version numbers and clean up
        self.assertIn("Better", result)

    def test_validate_new_filename_already_processed(self):
        """CRITICAL: Test that files with _v tags are rejected"""
        # This prevents Bug #1 (duplicate version tags)

        is_valid, error = self.validator.validate_new_filename("Transmit.5.11.0_v5.11.dmg")
        self.assertFalse(is_valid)
        self.assertIn("already processed", error.lower())

        is_valid, error = self.validator.validate_new_filename("App_v1.0_v2.0.dmg")
        self.assertFalse(is_valid)
        self.assertIn("already processed", error.lower())

    def test_validate_new_filename_valid(self):
        """Test validation of valid new filenames"""
        is_valid, error = self.validator.validate_new_filename("Adobe.Photoshop_v27.0.0.dmg")
        # This should fail because it has _v tag!
        self.assertFalse(is_valid)

        # Test a filename without _v tag
        is_valid, error = self.validator.validate_new_filename("Adobe.Photoshop.27.0.0.dmg")
        self.assertTrue(is_valid)
        self.assertEqual(error, "")

    def test_validate_filename_too_long(self):
        """Test rejection of overly long filenames"""
        long_name = "A" * 300 + ".dmg"
        is_valid, error = self.validator.validate_new_filename(long_name)
        self.assertFalse(is_valid)
        self.assertIn("too long", error.lower())

    def test_validate_invalid_extension(self):
        """Test rejection of invalid extensions"""
        is_valid, error = self.validator.validate_new_filename("App.exe")
        self.assertFalse(is_valid)
        self.assertIn("extension", error.lower())

    def test_is_intel_file(self):
        """Test Intel file detection"""
        self.assertTrue(self.validator.is_intel_file("App_Intel.dmg"))
        self.assertTrue(self.validator.is_intel_file("Tool_x64.pkg"))
        self.assertTrue(self.validator.is_intel_file("Software_x86.dmg"))

        # Universal binaries should NOT be marked as Intel
        self.assertFalse(self.validator.is_intel_file("App_Universal.dmg"))
        self.assertFalse(self.validator.is_intel_file("Tool_ARM.dmg"))

    def test_is_safe_to_process(self):
        """Test comprehensive safety check"""
        # Should be safe
        is_safe, reason = self.validator.is_safe_to_process("App.dmg")
        self.assertTrue(is_safe)

        # Already processed (has _v tag)
        is_safe, reason = self.validator.is_safe_to_process("App_v1.0.dmg")
        self.assertFalse(is_safe)

        # System file
        is_safe, reason = self.validator.is_safe_to_process(".DS_Store")
        self.assertFalse(is_safe)

        # Invalid extension
        is_safe, reason = self.validator.is_safe_to_process("App.exe")
        self.assertFalse(is_safe)


if __name__ == '__main__':
    unittest.main()
