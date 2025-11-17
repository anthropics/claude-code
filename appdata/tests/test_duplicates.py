"""
AppDater - Duplicates Tests
Tests for duplicate detection logic.
"""

import unittest
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.duplicates import UltraSmartDuplicateDetector


class TestUltraSmartDuplicateDetector(unittest.TestCase):
    """Test UltraSmartDuplicateDetector class"""

    def setUp(self):
        """Set up test fixtures"""
        self.detector = UltraSmartDuplicateDetector()

    def test_extract_product_key(self):
        """Test product key extraction (ignoring versions)"""

        # Both should extract to same product
        key1 = self.detector.extract_product_key("Adobe.Photoshop_v27.0.0.dmg")
        key2 = self.detector.extract_product_key("Adobe.Photoshop_v28.0.0.dmg")
        self.assertEqual(key1, key2)
        self.assertEqual(key1, "Adobe.Photoshop")

        # Different versions of Transmit
        key1 = self.detector.extract_product_key("Transmit_v5.10.0.dmg")
        key2 = self.detector.extract_product_key("Transmit_v5.11.0.dmg")
        self.assertEqual(key1, key2)
        self.assertEqual(key1, "Transmit")

    def test_extract_product_key_removes_version(self):
        """Test that version numbers are removed"""
        key = self.detector.extract_product_key("App_v1.0.0.dmg")
        self.assertNotIn("1.0.0", key)
        self.assertNotIn("_v", key)

    def test_extract_product_key_removes_markers(self):
        """Test that markers (MAS, Intel, etc.) are removed"""
        key = self.detector.extract_product_key("App_v1.0_MAS.dmg")
        self.assertNotIn("MAS", key)

        key = self.detector.extract_product_key("Tool_v2.0_Intel.dmg")
        self.assertNotIn("Intel", key)

    def test_calculate_space_to_free(self):
        """Test space calculation"""
        files_to_delete = [
            (Path("file1.dmg"), "Product1", 1024 * 1024 * 100),  # 100 MB
            (Path("file2.dmg"), "Product2", 1024 * 1024 * 200),  # 200 MB
        ]

        total_bytes = self.detector.calculate_space_to_free(files_to_delete)

        expected_bytes = 1024 * 1024 * 300  # 300 MB
        self.assertEqual(total_bytes, expected_bytes)

    def test_generate_report_structure(self):
        """Test report generation structure"""
        # Create a mock duplicates dict
        duplicates = {
            'TestProduct': [
                (Path("TestProduct_v1.0.dmg"), 1000.0),
                (Path("TestProduct_v2.0.dmg"), 2000.0),
            ]
        }

        report = self.detector.generate_report(duplicates)

        # Check report structure
        self.assertIn('total_products_with_duplicates', report)
        self.assertIn('total_files_to_delete', report)
        self.assertIn('total_files_to_keep', report)
        self.assertIn('space_to_free_bytes', report)
        self.assertIn('space_to_free_mb', report)
        self.assertIn('space_to_free_gb', report)
        self.assertIn('products', report)

        # Check counts
        self.assertEqual(report['total_products_with_duplicates'], 1)
        self.assertEqual(report['total_files_to_delete'], 1)  # Keep newest
        self.assertEqual(report['total_files_to_keep'], 1)

    def test_get_files_to_delete_keeps_newest(self):
        """Test that newest file by mtime is kept"""
        duplicates = {
            'TestProduct': [
                (Path("TestProduct_v1.0.dmg"), 1000.0),  # Older
                (Path("TestProduct_v2.0.dmg"), 2000.0),  # Newer
                (Path("TestProduct_v1.5.dmg"), 1500.0),  # Middle
            ]
        }

        files_to_delete = self.detector.get_files_to_delete(duplicates)

        # Should delete 2 files (keep newest which is v2.0)
        self.assertEqual(len(files_to_delete), 2)

        # Newest (v2.0 with mtime 2000.0) should NOT be in delete list
        deleted_filenames = [f.name for f, _, _ in files_to_delete]
        self.assertNotIn("TestProduct_v2.0.dmg", deleted_filenames)

        # Older versions should be in delete list
        self.assertIn("TestProduct_v1.0.dmg", deleted_filenames)
        self.assertIn("TestProduct_v1.5.dmg", deleted_filenames)

    def test_get_files_to_keep(self):
        """Test that correct files are marked to keep"""
        duplicates = {
            'Product1': [
                (Path("Product1_v1.0.dmg"), 1000.0),
                (Path("Product1_v2.0.dmg"), 2000.0),
            ],
            'Product2': [
                (Path("Product2_v1.0.dmg"), 1500.0),
                (Path("Product2_v3.0.dmg"), 3000.0),
            ]
        }

        files_to_keep = self.detector.get_files_to_keep(duplicates)

        # Should keep 2 files (one per product, the newest)
        self.assertEqual(len(files_to_keep), 2)

        kept_filenames = [f.name for f, _, _ in files_to_keep]

        # Should keep newest of each product
        self.assertIn("Product1_v2.0.dmg", kept_filenames)
        self.assertIn("Product2_v3.0.dmg", kept_filenames)


if __name__ == '__main__':
    unittest.main()
