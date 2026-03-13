#!/usr/bin/env python3
"""Unit tests for show_index.py"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from datetime import datetime
from unittest.mock import patch

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from show_index import (
    find_page_for_time,
    search_exchanges,
    format_page,
)
from utils import (
    load_index,
    format_timestamp,
    format_date,
    parse_time_query,
    PAGE_SIZE,
)


class TestFormatTimestamp(unittest.TestCase):
    """Tests for format_timestamp function."""

    def test_valid_timestamp(self):
        """Test formatting a valid ISO timestamp."""
        result = format_timestamp("2025-01-05T14:30:00Z")
        # Should contain time in some format
        self.assertIn(':', result)

    def test_empty_timestamp(self):
        """Test with empty timestamp."""
        result = format_timestamp("")
        self.assertEqual(result, "")

    def test_invalid_timestamp(self):
        """Test with invalid timestamp."""
        result = format_timestamp("not-a-timestamp")
        self.assertEqual(result, "")


class TestParseTimeQuery(unittest.TestCase):
    """Tests for parse_time_query function."""

    def test_parse_12hour_format(self):
        """Test parsing 12-hour time format."""
        result = parse_time_query("2:30pm")
        self.assertIsNotNone(result)
        self.assertEqual(result.hour, 14)
        self.assertEqual(result.minute, 30)

    def test_parse_24hour_format(self):
        """Test parsing 24-hour time format."""
        result = parse_time_query("14:30")
        self.assertIsNotNone(result)
        self.assertEqual(result.hour, 14)
        self.assertEqual(result.minute, 30)

    def test_parse_simple_hour(self):
        """Test parsing simple hour like '3pm'."""
        result = parse_time_query("3pm")
        self.assertIsNotNone(result)
        self.assertEqual(result.hour, 15)

    def test_parse_around_prefix(self):
        """Test parsing with 'around' prefix."""
        result = parse_time_query("around 2pm")
        self.assertIsNotNone(result)
        self.assertEqual(result.hour, 14)

    def test_invalid_time(self):
        """Test with invalid time string."""
        result = parse_time_query("not a time")
        self.assertIsNone(result)


class TestSearchExchanges(unittest.TestCase):
    """Tests for search_exchanges function."""

    def test_search_finds_match(self):
        """Test searching finds matching exchanges."""
        exchanges = [
            {'idx': 1, 'preview': 'Help me with authentication'},
            {'idx': 2, 'preview': 'Fix the bug in login'},
            {'idx': 3, 'preview': 'Update authentication flow'},
        ]
        results = search_exchanges(exchanges, 'authentication')
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]['idx'], 1)
        self.assertEqual(results[1]['idx'], 3)

    def test_search_case_insensitive(self):
        """Test search is case insensitive."""
        exchanges = [
            {'idx': 1, 'preview': 'AUTHENTICATION issue'},
        ]
        results = search_exchanges(exchanges, 'authentication')
        self.assertEqual(len(results), 1)

    def test_search_no_matches(self):
        """Test search with no matches."""
        exchanges = [
            {'idx': 1, 'preview': 'Help me with login'},
        ]
        results = search_exchanges(exchanges, 'authentication')
        self.assertEqual(len(results), 0)


class TestFindPageForTime(unittest.TestCase):
    """Tests for find_page_for_time function."""

    def test_finds_correct_page(self):
        """Test finding page for a specific time."""
        # Create exchanges spread across time
        exchanges = []
        for i in range(50):
            hour = 9 + (i // 5)  # 9am, 10am, etc.
            minute = (i % 5) * 10
            exchanges.append({
                'idx': i + 1,
                'preview': f'Exchange {i + 1}',
                'timestamp': f'2025-01-05T{hour:02d}:{minute:02d}:00Z'
            })

        target = datetime.now().replace(hour=11, minute=0)
        page = find_page_for_time(exchanges, target)

        # Should return a valid page number
        self.assertGreaterEqual(page, 1)

    def test_empty_exchanges(self):
        """Test with empty exchanges list."""
        page = find_page_for_time([], datetime.now())
        self.assertEqual(page, 1)


class TestFormatPage(unittest.TestCase):
    """Tests for format_page function."""

    def test_format_single_page(self):
        """Test formatting a page with exchanges."""
        exchanges = [
            {'idx': 1, 'preview': 'First exchange', 'timestamp': '2025-01-05T09:00:00Z'},
            {'idx': 2, 'preview': 'Second exchange', 'timestamp': '2025-01-05T09:05:00Z'},
        ]
        result = format_page(exchanges, 1, 2, '2025-01-05T09:00:00Z')

        self.assertIn('Session started', result)
        self.assertIn('Total exchanges', result)
        self.assertIn('First exchange', result)

    def test_format_empty_page(self):
        """Test formatting with no exchanges."""
        result = format_page([], 1, 0, '')
        self.assertIn('No exchanges found', result)

    def test_pagination_info(self):
        """Test that pagination info is included."""
        # Create enough exchanges for multiple pages
        exchanges = [
            {'idx': i, 'preview': f'Exchange {i}', 'timestamp': f'2025-01-05T09:{i:02d}:00Z'}
            for i in range(1, 50)
        ]
        result = format_page(exchanges, 1, 49, '2025-01-05T09:00:00Z')

        self.assertIn('page', result.lower())


class TestLoadIndex(unittest.TestCase):
    """Tests for load_index function."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.index_dir = Path(self.temp_dir) / '.claude' / 'context-recall'
        self.index_dir.mkdir(parents=True)

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_load_valid_index(self):
        """Test loading a valid index file."""
        import utils

        index_data = {
            'session_id': 'test-123',
            'total_exchanges': 10,
            'exchanges': [
                {'idx': 1, 'preview': 'Test', 'timestamp': '2025-01-05T09:00:00Z'}
            ]
        }

        index_file = self.index_dir / 'index.json'
        with open(index_file, 'w') as f:
            json.dump(index_data, f)

        # Patch the INDEX_FILE constant directly
        original_index_file = utils.INDEX_FILE
        utils.INDEX_FILE = index_file
        try:
            result = load_index()
            self.assertIsNotNone(result)
            self.assertEqual(result['session_id'], 'test-123')
        finally:
            utils.INDEX_FILE = original_index_file

    def test_load_missing_index(self):
        """Test loading when index doesn't exist."""
        import utils

        # Point to a non-existent file
        original_index_file = utils.INDEX_FILE
        utils.INDEX_FILE = self.index_dir / 'nonexistent.json'
        try:
            result = load_index()
            self.assertIsNone(result)
        finally:
            utils.INDEX_FILE = original_index_file


if __name__ == '__main__':
    unittest.main()
