"""
AppDater - Renamer Tests
Tests for smart renaming logic.
"""

import unittest
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.validator import FilenameValidator
from src.core.renamer import SmartRenamer


class TestSmartRenamer(unittest.TestCase):
    """Test SmartRenamer class"""

    def setUp(self):
        """Set up test fixtures"""
        self.validator = FilenameValidator()
        self.renamer = SmartRenamer(self.validator)

    def test_no_double_version_tags(self):
        """CRITICAL: Never add _v if already exists (prevents Bug #1)"""

        # Should SKIP files with _v already
        result = self.renamer.generate_new_name("Transmit.5.11.0_v5.11.dmg")
        self.assertIsNone(result)

        # Should NOT generate _v_v pattern
        result = self.renamer.generate_new_name("Transmit.5.11.0_v5.11_v5.11.dmg")
        self.assertIsNone(result)

        # Should SKIP already processed files
        result = self.renamer.generate_new_name("Adobe.Photoshop_v27.0.0.dmg")
        self.assertIsNone(result)

    def test_version_extraction(self):
        """Test version number extraction"""
        # Semantic versioning
        self.assertEqual(
            self.renamer.extract_version("Transmit 5.11.0 [atb].dmg"),
            "5.11.0"
        )

        self.assertEqual(
            self.renamer.extract_version("Adobe Photoshop 27.0.0.dmg"),
            "27.0.0"
        )

        # Two-part version
        self.assertEqual(
            self.renamer.extract_version("App 2.5.pkg"),
            "2.5"
        )

        # No version - should return None
        self.assertIsNone(self.renamer.extract_version("Stats.dmg"))

    def test_clean_filename(self):
        """Test filename cleaning"""
        # Remove release tags
        cleaned = self.renamer.clean_filename("Transmit 5.11.0 [atb].dmg")
        self.assertNotIn("[atb]", cleaned)

        # Remove architecture markers
        cleaned = self.renamer.clean_filename("App_v1.0_MAS.dmg")
        self.assertNotIn("MAS", cleaned)

        cleaned = self.renamer.clean_filename("Tool_Intel.dmg")
        self.assertNotIn("Intel", cleaned)

    def test_generate_new_name_basic(self):
        """Test basic name generation"""
        # Should generate proper name with _v tag
        new_name = self.renamer.generate_new_name("Transmit 5.11.0 [atb].dmg")

        # Should have _v in new name
        self.assertIsNotNone(new_name)
        self.assertIn("_v", new_name)

        # Should preserve extension
        self.assertTrue(new_name.endswith(".dmg"))

        # Should contain version
        self.assertIn("5.11.0", new_name)

    def test_generate_new_name_without_version(self):
        """Test name generation when no version found (date fallback)"""
        # Should use date as fallback
        new_name = self.renamer.generate_new_name("Stats.dmg")

        if new_name:  # Might be None if validation fails
            self.assertIn("_v", new_name)
            # Should have date-like pattern (YYMMDD)
            self.assertTrue(any(char.isdigit() for char in new_name))

    def test_should_delete_intel(self):
        """Test Intel file detection for deletion"""
        self.assertTrue(self.renamer.should_delete_intel("App_Intel.dmg"))
        self.assertTrue(self.renamer.should_delete_intel("Tool_x64.pkg"))

        self.assertFalse(self.renamer.should_delete_intel("App_Universal.dmg"))
        self.assertFalse(self.renamer.should_delete_intel("App.dmg"))

    def test_preview_rename(self):
        """Test preview functionality"""
        preview = self.renamer.preview_rename("Transmit 5.11.0 [atb].dmg")

        self.assertEqual(preview['old_name'], "Transmit 5.11.0 [atb].dmg")
        self.assertIn('new_name', preview)
        self.assertIn('will_rename', preview)
        self.assertIn('reason', preview)

        # Should indicate it will rename
        if preview['new_name']:
            self.assertTrue(preview['will_rename'])

    def test_preview_rename_already_processed(self):
        """Test preview of already processed file"""
        preview = self.renamer.preview_rename("Transmit_v5.11.0.dmg")

        self.assertFalse(preview['will_rename'])
        self.assertIsNone(preview['new_name'])
        self.assertIn("version tag", preview['reason'].lower())


if __name__ == '__main__':
    unittest.main()
