"""
AppDater - Ultra-Smart Duplicate Detector
Finds duplicate versions of the same product, keeps newest by modification time.
"""

import re
import os
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict


class UltraSmartDuplicateDetector:
    """Finds duplicates by product name, keeps NEWEST by mtime"""

    def __init__(self):
        self.supported_extensions = ['.dmg', '.pkg', '.iso']

    def extract_product_key(self, filename: str) -> str:
        """
        Extract product identifier (ignoring version numbers)

        Both of these → same product:
        'Adobe.Photoshop_v27.0.0.dmg' → 'Adobe.Photoshop'
        'Adobe.Photoshop_v28.0.0.dmg' → 'Adobe.Photoshop'

        Args:
            filename: The filename to analyze

        Returns:
            Product key (name without version)

        Examples:
            >>> detector = UltraSmartDuplicateDetector()
            >>> detector.extract_product_key("Adobe.Photoshop_v27.0.0.dmg")
            'Adobe.Photoshop'
            >>> detector.extract_product_key("Transmit_v5.11.0.dmg")
            'Transmit'
        """
        # Remove extension
        name_only = filename.rsplit('.', 1)[0] if '.' in filename else filename

        # Remove _vX.X.X patterns (version tags)
        clean = re.sub(r'_v[\d.]+', '', name_only)

        # Remove any remaining version-like patterns
        clean = re.sub(r'[\s._-]\d+[\d.]*', '', clean)

        # Remove brackets and their contents
        clean = re.sub(r'\[.*?\]', '', clean)

        # Remove common markers
        clean = re.sub(r'[_\s-](MAS|In-App|UB|Intel|x64|x86|ARM)', '', clean, flags=re.IGNORECASE)

        # Normalize separators
        clean = re.sub(r'[\s_-]+', '.', clean)

        # Remove multiple dots
        clean = re.sub(r'\.+', '.', clean)

        # Remove trailing/leading dots
        clean = clean.strip('.')

        return clean

    def find_duplicates(self, directory: Path, recursive: bool = True) -> Dict[str, List[Tuple[Path, float]]]:
        """
        Group files by product, track modification times

        Args:
            directory: Directory to search
            recursive: Whether to search subdirectories

        Returns:
            Dictionary mapping product_key → [(file_path, mtime), ...]
            Only includes products with 2+ versions

        Examples:
            {
                'Adobe.Photoshop': [
                    (Path('Adobe.Photoshop_v27.0.0.dmg'), 1699000000.0),
                    (Path('Adobe.Photoshop_v28.0.0.dmg'), 1700000000.0)
                ],
                'Transmit': [
                    (Path('Transmit_v5.10.0.dmg'), 1698000000.0),
                    (Path('Transmit_v5.11.0.dmg'), 1699500000.0)
                ]
            }
        """
        products = defaultdict(list)

        # Determine which files to process
        if recursive:
            file_iterator = directory.rglob('*')
        else:
            file_iterator = directory.glob('*')

        for file_path in file_iterator:
            # Skip directories
            if not file_path.is_file():
                continue

            # Check if supported extension
            if file_path.suffix.lower() not in self.supported_extensions:
                continue

            # Skip hidden files
            if file_path.name.startswith('.'):
                continue

            # Extract product key
            product_key = self.extract_product_key(file_path.name)

            # Get modification time
            try:
                mtime = os.path.getmtime(file_path)
            except OSError:
                continue

            # Add to products dictionary
            products[product_key].append((file_path, mtime))

        # Filter: only keep products with 2+ versions
        duplicates = {k: v for k, v in products.items() if len(v) > 1}

        return duplicates

    def get_files_to_delete(self, duplicates_dict: Dict[str, List[Tuple[Path, float]]]) -> List[Tuple[Path, str, int]]:
        """
        Find OLD files to delete (keep NEWEST by mtime)

        Args:
            duplicates_dict: Output from find_duplicates()

        Returns:
            List of tuples: [(file_to_delete, product_name, file_size), ...]

        Examples:
            [
                (Path('Adobe.Photoshop_v27.0.0.dmg'), 'Adobe.Photoshop', 2147483648),
                (Path('Transmit_v5.10.0.dmg'), 'Transmit', 52428800)
            ]
        """
        to_delete = []

        for product_name, files_list in duplicates_dict.items():
            # Sort by mtime: NEWEST FIRST
            sorted_files = sorted(files_list, key=lambda x: x[1], reverse=True)

            # First file is newest (keep it)
            newest_file, newest_mtime = sorted_files[0]

            # All others are old (delete them)
            old_files = sorted_files[1:]

            for old_file, old_mtime in old_files:
                try:
                    file_size = old_file.stat().st_size
                except OSError:
                    file_size = 0

                to_delete.append((old_file, product_name, file_size))

        return to_delete

    def get_files_to_keep(self, duplicates_dict: Dict[str, List[Tuple[Path, float]]]) -> List[Tuple[Path, str, int]]:
        """
        Find files to KEEP (newest versions)

        Args:
            duplicates_dict: Output from find_duplicates()

        Returns:
            List of tuples: [(file_to_keep, product_name, file_size), ...]
        """
        to_keep = []

        for product_name, files_list in duplicates_dict.items():
            # Sort by mtime: NEWEST FIRST
            sorted_files = sorted(files_list, key=lambda x: x[1], reverse=True)

            # First file is newest (keep it)
            newest_file, newest_mtime = sorted_files[0]

            try:
                file_size = newest_file.stat().st_size
            except OSError:
                file_size = 0

            to_keep.append((newest_file, product_name, file_size))

        return to_keep

    def calculate_space_to_free(self, files_to_delete: List[Tuple[Path, str, int]]) -> int:
        """
        Calculate total disk space that will be freed

        Args:
            files_to_delete: Output from get_files_to_delete()

        Returns:
            Total bytes to be freed
        """
        return sum(file_size for _, _, file_size in files_to_delete)

    def generate_report(self, duplicates_dict: Dict[str, List[Tuple[Path, float]]]) -> dict:
        """
        Generate comprehensive duplicate report

        Args:
            duplicates_dict: Output from find_duplicates()

        Returns:
            Dictionary with summary statistics
        """
        files_to_delete = self.get_files_to_delete(duplicates_dict)
        files_to_keep = self.get_files_to_keep(duplicates_dict)
        space_to_free = self.calculate_space_to_free(files_to_delete)

        report = {
            'total_products_with_duplicates': len(duplicates_dict),
            'total_files_to_delete': len(files_to_delete),
            'total_files_to_keep': len(files_to_keep),
            'space_to_free_bytes': space_to_free,
            'space_to_free_mb': space_to_free / (1024 * 1024),
            'space_to_free_gb': space_to_free / (1024 * 1024 * 1024),
            'products': {}
        }

        for product_name, files_list in duplicates_dict.items():
            sorted_files = sorted(files_list, key=lambda x: x[1], reverse=True)

            product_info = {
                'total_versions': len(files_list),
                'newest': str(sorted_files[0][0].name),
                'oldest': str(sorted_files[-1][0].name),
                'versions': [
                    {
                        'filename': str(f.name),
                        'path': str(f),
                        'mtime': mtime,
                        'keep': i == 0
                    }
                    for i, (f, mtime) in enumerate(sorted_files)
                ]
            }

            report['products'][product_name] = product_info

        return report
