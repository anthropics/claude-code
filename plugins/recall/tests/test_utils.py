#!/usr/bin/env python3
"""Tests for the shared utils module."""

import unittest
import sys
from pathlib import Path
from datetime import datetime

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))

from utils import (
    extract_text_content,
    make_preview,
    truncate_text,
    parse_time_query,
    parse_date_time_query,
    format_timestamp,
    format_date,
    format_short_date,
    get_date_from_timestamp,
    search_in_text,
    find_exchanges_by_time,
    build_exchanges_from_messages,
)


class TestExtractTextContent(unittest.TestCase):
    """Tests for extract_text_content function."""

    def test_string_content(self):
        """Test extracting from string content."""
        message = {'content': 'Hello world'}
        self.assertEqual(extract_text_content(message), 'Hello world')

    def test_array_content(self):
        """Test extracting from array content."""
        message = {
            'content': [
                {'type': 'text', 'text': 'Hello'},
                {'type': 'text', 'text': 'world'}
            ]
        }
        self.assertEqual(extract_text_content(message), 'Hello\nworld')

    def test_mixed_array_content(self):
        """Test extracting from mixed array content."""
        message = {
            'content': [
                {'type': 'text', 'text': 'Hello'},
                {'type': 'image', 'url': 'http://example.com'},
                {'type': 'text', 'text': 'world'}
            ]
        }
        self.assertEqual(extract_text_content(message), 'Hello\nworld')

    def test_empty_content(self):
        """Test extracting from empty content."""
        self.assertEqual(extract_text_content({}), '')
        self.assertEqual(extract_text_content({'content': []}), '')


class TestMakePreview(unittest.TestCase):
    """Tests for make_preview function."""

    def test_short_text(self):
        """Test preview of short text."""
        self.assertEqual(make_preview('Hello'), 'Hello')

    def test_long_text(self):
        """Test preview of long text."""
        long_text = 'A' * 100
        preview = make_preview(long_text, max_length=80)
        self.assertEqual(len(preview), 80)
        self.assertTrue(preview.endswith('...'))

    def test_multiline_text(self):
        """Test preview collapses newlines."""
        text = 'Hello\nworld\ntest'
        preview = make_preview(text)
        self.assertNotIn('\n', preview)
        self.assertEqual(preview, 'Hello world test')


class TestTruncateText(unittest.TestCase):
    """Tests for truncate_text function."""

    def test_short_text(self):
        """Test truncating short text (no change)."""
        self.assertEqual(truncate_text('Hello', 100), 'Hello')

    def test_long_text(self):
        """Test truncating long text."""
        long_text = 'A' * 200
        truncated = truncate_text(long_text, 100)
        self.assertIn('[...truncated...]', truncated)
        self.assertLess(len(truncated), 200)


class TestParseTimeQuery(unittest.TestCase):
    """Tests for parse_time_query function."""

    def test_12_hour_format(self):
        """Test 12-hour format parsing."""
        result = parse_time_query('2pm')
        self.assertIsNotNone(result)
        self.assertEqual(result.hour, 14)

    def test_12_hour_with_minutes(self):
        """Test 12-hour format with minutes."""
        result = parse_time_query('2:30pm')
        self.assertIsNotNone(result)
        self.assertEqual(result.hour, 14)
        self.assertEqual(result.minute, 30)

    def test_24_hour_format(self):
        """Test 24-hour format parsing."""
        result = parse_time_query('14:30')
        self.assertIsNotNone(result)
        self.assertEqual(result.hour, 14)
        self.assertEqual(result.minute, 30)

    def test_invalid_format(self):
        """Test invalid format returns None."""
        self.assertIsNone(parse_time_query('invalid'))
        self.assertIsNone(parse_time_query(''))


class TestParseDateTimeQuery(unittest.TestCase):
    """Tests for parse_date_time_query function."""

    def test_time_only(self):
        """Test time-only query."""
        result = parse_date_time_query('2pm')
        self.assertIsNotNone(result)
        time, date = result
        self.assertEqual(time.hour, 14)
        self.assertIsNone(date)

    def test_with_date(self):
        """Test query with date."""
        result = parse_date_time_query('jan 5 2pm')
        self.assertIsNotNone(result)
        time, date = result
        self.assertEqual(time.hour, 14)
        self.assertEqual(time.month, 1)
        self.assertEqual(time.day, 5)

    def test_yesterday(self):
        """Test yesterday keyword."""
        result = parse_date_time_query('yesterday 2pm')
        self.assertIsNotNone(result)
        time, date = result
        self.assertEqual(time.hour, 14)
        self.assertIsNotNone(date)


class TestFormatFunctions(unittest.TestCase):
    """Tests for formatting functions."""

    def test_format_timestamp(self):
        """Test timestamp formatting."""
        result = format_timestamp('2026-01-05T14:30:00Z')
        self.assertIn(':', result)
        # Just check it contains am or pm (timezone dependent)
        self.assertTrue('am' in result.lower() or 'pm' in result.lower())

    def test_format_date(self):
        """Test date formatting."""
        result = format_date('2026-01-05T14:30:00Z')
        self.assertIn('Jan', result)
        self.assertIn('2026', result)

    def test_format_short_date(self):
        """Test short date formatting."""
        result = format_short_date('2026-01-05T14:30:00Z')
        self.assertIn('Jan', result)
        self.assertIn('5', result)

    def test_get_date_from_timestamp(self):
        """Test extracting date from timestamp."""
        result = get_date_from_timestamp('2026-01-05T14:30:00Z')
        self.assertEqual(result, '2026-01-05')

    def test_empty_timestamp(self):
        """Test formatting empty timestamp."""
        self.assertEqual(format_timestamp(''), '')
        self.assertEqual(format_date(''), 'Unknown date')
        self.assertIsNone(get_date_from_timestamp(''))


class TestSearchInText(unittest.TestCase):
    """Tests for search_in_text function."""

    def test_basic_search(self):
        """Test basic keyword search."""
        self.assertTrue(search_in_text('Hello world', 'world'))
        self.assertTrue(search_in_text('Hello world', 'WORLD'))  # case insensitive
        self.assertFalse(search_in_text('Hello world', 'foo'))

    def test_empty_search(self):
        """Test empty text search."""
        self.assertFalse(search_in_text('', 'test'))
        self.assertTrue(search_in_text('test', ''))  # empty keyword matches


class TestFindExchangesByTime(unittest.TestCase):
    """Tests for find_exchanges_by_time function."""

    def test_find_closest(self):
        """Test finding exchanges closest to target time."""
        exchanges = [
            {'idx': 1, 'timestamp': '2026-01-05T10:00:00Z'},
            {'idx': 2, 'timestamp': '2026-01-05T14:00:00Z'},
            {'idx': 3, 'timestamp': '2026-01-05T18:00:00Z'},
        ]
        target = datetime(2026, 1, 5, 14, 30)
        result = find_exchanges_by_time(exchanges, target, window=3)
        self.assertIn(2, result)  # 2pm should be closest to 2:30pm

    def test_empty_exchanges(self):
        """Test with empty exchanges list."""
        result = find_exchanges_by_time([], datetime.now())
        self.assertEqual(result, [])


class TestBuildExchangesFromMessages(unittest.TestCase):
    """Tests for build_exchanges_from_messages function."""

    def test_build_exchanges(self):
        """Test building exchanges from messages."""
        messages = [
            {'role': 'user', 'text': 'Hello', 'timestamp': '2026-01-05T10:00:00Z'},
            {'role': 'assistant', 'text': 'Hi there', 'timestamp': '2026-01-05T10:00:01Z'},
            {'role': 'user', 'text': 'How are you?', 'timestamp': '2026-01-05T10:01:00Z'},
            {'role': 'assistant', 'text': 'I am well', 'timestamp': '2026-01-05T10:01:01Z'},
        ]
        exchanges = build_exchanges_from_messages(messages)
        self.assertEqual(len(exchanges), 2)
        self.assertEqual(exchanges[0]['idx'], 1)
        self.assertEqual(exchanges[0]['user_text'], 'Hello')
        self.assertEqual(exchanges[1]['idx'], 2)

    def test_incomplete_exchange(self):
        """Test handling incomplete exchange (user without assistant)."""
        messages = [
            {'role': 'user', 'text': 'Hello', 'timestamp': '2026-01-05T10:00:00Z'},
        ]
        exchanges = build_exchanges_from_messages(messages)
        self.assertEqual(len(exchanges), 0)


if __name__ == '__main__':
    unittest.main()
