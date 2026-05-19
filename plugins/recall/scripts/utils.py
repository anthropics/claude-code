#!/usr/bin/env python3
"""Shared utilities for the recall plugin.

This module contains common functions used across multiple scripts
to avoid code duplication.
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple


# Configuration constants
PREVIEW_LENGTH = 80
MAX_CHARS_PER_MESSAGE = 1000
MAX_TOTAL_CHARS = 8000
PAGE_SIZE = 20
AROUND_TIME_WINDOW = 5

# File paths
INDEX_DIR = Path.home() / '.claude' / 'context-recall'
INDEX_FILE = INDEX_DIR / 'index.json'
LOG_FILE = Path.home() / '.claude' / 'recall-events.log'


def extract_text_content(message: Dict[str, Any]) -> str:
    """Extract text content from a message object.

    Handles both string content and array content formats.
    """
    content = message.get('content', [])
    if isinstance(content, str):
        return content

    text_parts = []
    for item in content:
        if isinstance(item, dict) and item.get('type') == 'text':
            text_parts.append(item.get('text', ''))
        elif isinstance(item, str):
            text_parts.append(item)

    return '\n'.join(text_parts)


def make_preview(text: str, max_length: int = PREVIEW_LENGTH) -> str:
    """Create a short preview of text for the index."""
    text = ' '.join(text.split())
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + '...'


def truncate_text(text: str, max_chars: int = MAX_CHARS_PER_MESSAGE) -> str:
    """Truncate text to max_chars, adding indicator if truncated."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[...truncated...]"


def parse_time_query(time_str: str) -> Optional[datetime]:
    """Parse a time query like '2:30pm', '14:30', 'around 3pm'.

    Returns a datetime with today's date and the parsed time.
    """
    time_str = time_str.lower().strip()
    time_str = re.sub(r'^around\s+', '', time_str)

    formats = [
        "%I:%M%p",   # 2:30pm
        "%I:%M %p",  # 2:30 pm
        "%I%p",      # 2pm
        "%I %p",     # 2 pm
        "%H:%M",     # 14:30
    ]

    for fmt in formats:
        try:
            parsed = datetime.strptime(time_str, fmt)
            today = datetime.now()
            return parsed.replace(year=today.year, month=today.month, day=today.day)
        except ValueError:
            continue

    return None


def parse_date_time_query(time_str: str, reference_dates: List[str] = None) -> Optional[Tuple[datetime, Optional[str]]]:
    """Parse a time query with optional date awareness.

    Args:
        time_str: Time string like '2pm', '2pm yesterday', 'jan 5 2pm'
        reference_dates: List of ISO date strings from the session to help resolve ambiguity

    Returns:
        Tuple of (datetime, matched_date_str) or None if parsing fails
    """
    time_str = time_str.lower().strip()
    time_str = re.sub(r'^around\s+', '', time_str)

    # Check for relative date keywords
    target_date = None
    if 'yesterday' in time_str:
        target_date = datetime.now().date() - __import__('datetime').timedelta(days=1)
        time_str = time_str.replace('yesterday', '').strip()
    elif 'today' in time_str:
        target_date = datetime.now().date()
        time_str = time_str.replace('today', '').strip()

    # Check for date patterns like "jan 5" or "1/5"
    date_patterns = [
        (r'(\w{3})\s+(\d{1,2})', '%b %d'),  # jan 5
        (r'(\d{1,2})/(\d{1,2})', '%m/%d'),   # 1/5
    ]

    current_year = datetime.now().year
    for pattern, date_fmt in date_patterns:
        match = re.search(pattern, time_str)
        if match:
            try:
                date_str = match.group(0)
                # Add year to avoid Python 3.15 deprecation warning
                parsed_date = datetime.strptime(f"{date_str} {current_year}", f"{date_fmt} %Y")
                target_date = parsed_date.date()
                time_str = time_str.replace(date_str, '').strip()
                break
            except ValueError:
                continue

    # Parse the time portion
    parsed_time = parse_time_query(time_str)
    if not parsed_time:
        return None

    # Combine date and time
    if target_date:
        result = parsed_time.replace(year=target_date.year, month=target_date.month, day=target_date.day)
        return (result, target_date.isoformat())

    return (parsed_time, None)


def format_timestamp(iso_timestamp: str) -> str:
    """Format ISO timestamp as human-readable time (e.g., '2:30 pm')."""
    if not iso_timestamp:
        return ""

    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        local_dt = dt.astimezone()
        return local_dt.strftime("%-I:%M %p").lower()
    except Exception:
        return ""


def format_date(iso_timestamp: str) -> str:
    """Format ISO timestamp as human-readable date (e.g., 'Jan 5, 2026 at 2:30 PM')."""
    if not iso_timestamp:
        return "Unknown date"

    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        local_dt = dt.astimezone()
        return local_dt.strftime("%b %d, %Y at %-I:%M %p")
    except Exception:
        return "Unknown date"


def format_short_date(iso_timestamp: str) -> str:
    """Format ISO timestamp as short date (e.g., 'Jan 5')."""
    if not iso_timestamp:
        return ""

    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        local_dt = dt.astimezone()
        return local_dt.strftime("%b %-d")
    except Exception:
        return ""


def get_date_from_timestamp(iso_timestamp: str) -> Optional[str]:
    """Extract just the date portion from an ISO timestamp."""
    if not iso_timestamp:
        return None
    try:
        dt = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
        return dt.date().isoformat()
    except Exception:
        return None


def load_index() -> Optional[Dict]:
    """Load the conversation index from disk."""
    if not INDEX_FILE.exists():
        return None

    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def save_index(index_data: Dict) -> bool:
    """Save the conversation index to disk."""
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    try:
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2)
        return True
    except Exception:
        return False


def parse_transcript_messages(transcript_path: str) -> List[Dict[str, Any]]:
    """Parse transcript file and extract messages with timestamps.

    Returns list of dicts with keys: role, text, timestamp
    """
    messages = []

    if not transcript_path or not os.path.exists(transcript_path):
        return messages

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    role = entry.get('type', '') or entry.get('role', '')
                    if role not in ('user', 'assistant'):
                        message_obj = entry.get('message', {})
                        role = message_obj.get('role', '')

                    if role in ('user', 'assistant'):
                        message_obj = entry.get('message', {})
                        text = extract_text_content(message_obj)
                        timestamp = entry.get('timestamp', '')

                        if text:
                            messages.append({
                                'role': role,
                                'text': text,
                                'timestamp': timestamp
                            })
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass

    return messages


def build_exchanges_from_messages(messages: List[Dict[str, Any]]) -> List[Dict]:
    """Build list of exchanges from parsed messages.

    Returns list of dicts with keys: idx, user_text, assistant_text, timestamp
    """
    exchanges = []
    i = 0
    exchange_idx = 1

    while i < len(messages):
        if messages[i]['role'] == 'user':
            user_msg = messages[i]
            if i + 1 < len(messages) and messages[i + 1]['role'] == 'assistant':
                assistant_msg = messages[i + 1]
                exchanges.append({
                    'idx': exchange_idx,
                    'user_text': user_msg['text'],
                    'assistant_text': assistant_msg['text'],
                    'timestamp': user_msg.get('timestamp', '')
                })
                exchange_idx += 1
                i += 2
            else:
                i += 1
        else:
            i += 1

    return exchanges


def find_exchanges_by_time(
    exchanges: List[Dict],
    target_time: datetime,
    target_date: Optional[str] = None,
    window: int = AROUND_TIME_WINDOW
) -> List[int]:
    """Find exchange indices around a target time.

    Args:
        exchanges: List of exchange dicts with 'timestamp' and 'idx' keys
        target_time: Target datetime to search around
        target_date: Optional specific date (ISO format) to match
        window: Number of exchanges to return around the match

    Returns:
        List of exchange indices
    """
    if not exchanges:
        return []

    # If target_date specified, filter to that date first
    if target_date:
        date_matches = [
            (i, ex) for i, ex in enumerate(exchanges)
            if get_date_from_timestamp(ex.get('timestamp', '')) == target_date
        ]
        if not date_matches:
            # No exact date match, fall back to time-only matching
            pass
        else:
            # Find closest time within that date
            best_idx = 0
            best_diff = float('inf')

            for list_idx, (orig_idx, ex) in enumerate(date_matches):
                try:
                    ex_time = datetime.fromisoformat(ex['timestamp'].replace('Z', '+00:00'))
                    ex_minutes = ex_time.hour * 60 + ex_time.minute
                    target_minutes = target_time.hour * 60 + target_time.minute
                    diff = abs(ex_minutes - target_minutes)
                    if diff < best_diff:
                        best_diff = diff
                        best_idx = list_idx
                except Exception:
                    continue

            # Return window around the match within date_matches
            start = max(0, best_idx - window // 2)
            end = min(len(date_matches), best_idx + window // 2 + 1)
            return [date_matches[i][1]['idx'] for i in range(start, end)]

    # Time-only matching (original behavior)
    best_idx = 0
    best_diff = float('inf')

    for i, ex in enumerate(exchanges):
        try:
            ex_time = datetime.fromisoformat(ex['timestamp'].replace('Z', '+00:00'))
            ex_minutes = ex_time.hour * 60 + ex_time.minute
            target_minutes = target_time.hour * 60 + target_time.minute
            diff = abs(ex_minutes - target_minutes)
            if diff < best_diff:
                best_diff = diff
                best_idx = i
        except Exception:
            continue

    start = max(0, best_idx - window // 2)
    end = min(len(exchanges), best_idx + window // 2 + 1)
    return [exchanges[i]['idx'] for i in range(start, end)]


def search_in_text(text: str, keyword: str) -> bool:
    """Check if keyword exists in text (case-insensitive)."""
    return keyword.lower() in text.lower()
