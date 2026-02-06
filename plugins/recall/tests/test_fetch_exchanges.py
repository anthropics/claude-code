#!/usr/bin/env python3
"""Unit tests for fetch_exchanges.py"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from fetch_exchanges import (
    search_exchanges_full_content,
    parse_last_n,
    format_exchanges,
    get_session_dates,
)
from utils import (
    truncate_text,
    MAX_CHARS_PER_MESSAGE,
)


class TestParseLastN(unittest.TestCase):
    """Tests for parse_last_n function."""

    def test_last5(self):
        """Test parsing 'last5'."""
        result = parse_last_n('last5', 100)
        self.assertEqual(result, {96, 97, 98, 99, 100})

    def test_last10(self):
        """Test parsing 'last10'."""
        result = parse_last_n('last10', 100)
        self.assertEqual(result, {91, 92, 93, 94, 95, 96, 97, 98, 99, 100})

    def test_last_exceeds_total(self):
        """Test 'lastN' when N > total exchanges."""
        result = parse_last_n('last10', 5)
        self.assertEqual(result, {1, 2, 3, 4, 5})

    def test_invalid_format(self):
        """Test with invalid format."""
        result = parse_last_n('invalid', 100)
        self.assertEqual(result, set())

    def test_last_without_number(self):
        """Test 'last' without a number."""
        result = parse_last_n('last', 100)
        self.assertEqual(result, set())


class TestSearchExchangesFullContent(unittest.TestCase):
    """Tests for search_exchanges_full_content function."""

    def test_search_in_user_text(self):
        """Test searching finds match in user text."""
        exchanges = [
            {'idx': 1, 'user_text': 'Help with authentication', 'assistant_text': 'Sure'},
            {'idx': 2, 'user_text': 'Fix bug', 'assistant_text': 'Done'},
        ]
        result = search_exchanges_full_content(exchanges, 'authentication')
        self.assertEqual(result, {1})

    def test_search_in_assistant_text(self):
        """Test searching finds match in assistant text."""
        exchanges = [
            {'idx': 1, 'user_text': 'Help', 'assistant_text': 'Use authentication flow'},
            {'idx': 2, 'user_text': 'Fix bug', 'assistant_text': 'Done'},
        ]
        result = search_exchanges_full_content(exchanges, 'authentication')
        self.assertEqual(result, {1})

    def test_search_case_insensitive(self):
        """Test search is case insensitive."""
        exchanges = [
            {'idx': 1, 'user_text': 'AUTHENTICATION issue', 'assistant_text': 'Fixed'},
        ]
        result = search_exchanges_full_content(exchanges, 'authentication')
        self.assertEqual(result, {1})

    def test_search_no_matches(self):
        """Test search with no matches."""
        exchanges = [
            {'idx': 1, 'user_text': 'Help with login', 'assistant_text': 'Done'},
        ]
        result = search_exchanges_full_content(exchanges, 'authentication')
        self.assertEqual(result, set())

    def test_search_fallback_to_preview(self):
        """Test search falls back to preview if user_text missing."""
        exchanges = [
            {'idx': 1, 'preview': 'authentication issue', 'assistant_text': 'Fixed'},
        ]
        result = search_exchanges_full_content(exchanges, 'authentication')
        self.assertEqual(result, {1})


class TestFormatExchanges(unittest.TestCase):
    """Tests for format_exchanges function."""

    def test_format_single_exchange(self):
        """Test formatting a single exchange."""
        exchanges = [{
            'idx': 1,
            'user_text': 'Hello',
            'assistant_text': 'Hi there!',
            'timestamp': '2025-01-05T09:00:00Z'
        }]
        result = format_exchanges(exchanges)

        self.assertIn('Exchange #1', result)
        self.assertIn('Hello', result)
        self.assertIn('Hi there!', result)

    def test_format_empty_list(self):
        """Test formatting empty exchange list."""
        result = format_exchanges([])
        self.assertIn('No exchanges found', result)


class TestGetSessionDates(unittest.TestCase):
    """Tests for get_session_dates function."""

    def test_single_date(self):
        """Test with exchanges from single date."""
        exchanges = [
            {'idx': 1, 'timestamp': '2025-01-05T09:00:00Z'},
            {'idx': 2, 'timestamp': '2025-01-05T10:00:00Z'},
        ]
        result = get_session_dates(exchanges)
        self.assertEqual(result, ['2025-01-05'])

    def test_multiple_dates(self):
        """Test with exchanges from multiple dates."""
        exchanges = [
            {'idx': 1, 'timestamp': '2025-01-05T09:00:00Z'},
            {'idx': 2, 'timestamp': '2025-01-06T10:00:00Z'},
            {'idx': 3, 'timestamp': '2025-01-07T11:00:00Z'},
        ]
        result = get_session_dates(exchanges)
        self.assertEqual(result, ['2025-01-05', '2025-01-06', '2025-01-07'])

    def test_empty_exchanges(self):
        """Test with empty exchanges list."""
        result = get_session_dates([])
        self.assertEqual(result, [])


class TestTruncateText(unittest.TestCase):
    """Tests for truncate_text function."""

    def test_short_text_unchanged(self):
        """Test that short text is not truncated."""
        text = 'Short text'
        result = truncate_text(text, MAX_CHARS_PER_MESSAGE)
        self.assertEqual(result, text)

    def test_long_text_truncated(self):
        """Test that long text is truncated."""
        text = 'x' * 2000
        result = truncate_text(text, MAX_CHARS_PER_MESSAGE)

        self.assertLess(len(result), 2000)
        self.assertIn('[...truncated...]', result)


if __name__ == '__main__':
    unittest.main()
