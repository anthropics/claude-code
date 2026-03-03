#!/usr/bin/env python3
"""Unit tests for extract_context.py"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from extract_context import load_snapshot, format_exchanges_as_markdown


class TestLoadSnapshot(unittest.TestCase):
    """Tests for load_snapshot function."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.snapshot_dir = Path(self.temp_dir) / '.claude' / 'context-recall'
        self.snapshot_dir.mkdir(parents=True)

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_load_valid_snapshot(self):
        """Test loading a valid snapshot file."""
        from unittest.mock import patch

        snapshot_data = {
            'session_id': 'test-123',
            'timestamp': '2025-01-04T12:00:00Z',
            'message_count': 10,
            'exchanges': [
                {'user': 'Hello', 'assistant': 'Hi there!'}
            ]
        }

        snapshot_file = self.snapshot_dir / 'current.json'
        with open(snapshot_file, 'w') as f:
            json.dump(snapshot_data, f)

        with patch.object(Path, 'home', return_value=Path(self.temp_dir)):
            result = load_snapshot()

        self.assertEqual(result['session_id'], 'test-123')
        self.assertEqual(len(result['exchanges']), 1)

    def test_load_missing_snapshot(self):
        """Test loading when snapshot file doesn't exist."""
        from unittest.mock import patch

        with patch.object(Path, 'home', return_value=Path(self.temp_dir)):
            # Remove the current.json file
            result = load_snapshot()

        self.assertEqual(result, {})

    def test_load_invalid_json(self):
        """Test loading when snapshot contains invalid JSON."""
        from unittest.mock import patch

        snapshot_file = self.snapshot_dir / 'current.json'
        with open(snapshot_file, 'w') as f:
            f.write('not valid json')

        with patch.object(Path, 'home', return_value=Path(self.temp_dir)):
            result = load_snapshot()

        self.assertEqual(result, {})


class TestFormatExchangesAsMarkdown(unittest.TestCase):
    """Tests for format_exchanges_as_markdown function."""

    def test_empty_exchanges(self):
        """Test formatting with no exchanges."""
        result = format_exchanges_as_markdown([])
        self.assertIn('No previous conversation history', result)

    def test_single_exchange(self):
        """Test formatting a single exchange."""
        exchanges = [
            {'user': 'Hello', 'assistant': 'Hi there!'}
        ]
        result = format_exchanges_as_markdown(exchanges)

        self.assertIn('Exchange 1', result)
        self.assertIn('Hello', result)
        self.assertIn('Hi there!', result)

    def test_multiple_exchanges(self):
        """Test formatting multiple exchanges."""
        exchanges = [
            {'user': 'First question', 'assistant': 'First answer'},
            {'user': 'Second question', 'assistant': 'Second answer'},
        ]
        result = format_exchanges_as_markdown(exchanges)

        self.assertIn('Exchange 1', result)
        self.assertIn('Exchange 2', result)
        self.assertIn('First question', result)
        self.assertIn('Second answer', result)

    def test_preserves_truncation_indicator(self):
        """Test that truncation indicators from the hook are preserved.

        Note: Truncation happens at save time in the hook, not here.
        The hook uses '[...truncated...]' as the indicator.
        """
        truncated_text = 'x' * 1000 + '\n\n[...truncated...]'
        exchanges = [
            {'user': truncated_text, 'assistant': 'Short response'}
        ]
        result = format_exchanges_as_markdown(exchanges)

        self.assertIn('[...truncated...]', result)
        self.assertIn('Short response', result)

    def test_handles_missing_fields(self):
        """Test handling of exchanges with missing fields."""
        exchanges = [
            {'user': 'Hello'},  # Missing assistant
            {'assistant': 'Response'},  # Missing user
        ]
        result = format_exchanges_as_markdown(exchanges)

        # Should not crash
        self.assertIn('Exchange', result)


if __name__ == '__main__':
    unittest.main()
