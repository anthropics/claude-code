#!/usr/bin/env python3
"""Fetch full exchange content using intuitive arguments.

This script reads the index to get full content for exchanges
based on user-friendly queries.

Usage:
    python3 fetch_exchanges.py last5              # Fetch last 5 exchanges
    python3 fetch_exchanges.py last10             # Fetch last 10 exchanges
    python3 fetch_exchanges.py around 2pm         # Fetch exchanges around 2pm
    python3 fetch_exchanges.py around "jan 5 2pm" # Fetch exchanges around 2pm on Jan 5
    python3 fetch_exchanges.py search auth        # Search for "auth" in full content
    python3 fetch_exchanges.py search "PAI dim"   # Search for phrase in full content

Improvements over original:
- Full-content search (not just previews)
- Date-aware time search for multi-day sessions
- Uses shared utils module
- Reads from index (which now stores full content) instead of re-parsing transcript
"""

import sys
from pathlib import Path
from typing import List, Dict, Set

# Add scripts directory to path for utils import
sys.path.insert(0, str(Path(__file__).parent))

from utils import (
    load_index,
    truncate_text,
    format_timestamp,
    format_short_date,
    parse_time_query,
    parse_date_time_query,
    find_exchanges_by_time,
    get_date_from_timestamp,
    search_in_text,
    MAX_CHARS_PER_MESSAGE,
    MAX_TOTAL_CHARS,
    AROUND_TIME_WINDOW,
)


def search_exchanges_full_content(exchanges: List[Dict], keyword: str) -> Set[int]:
    """Search exchanges for keyword in FULL content (user + assistant text).

    This searches the actual content, not just the preview.
    """
    matching = set()

    for ex in exchanges:
        # Search in user text
        user_text = ex.get('user_text', ex.get('preview', ''))
        if search_in_text(user_text, keyword):
            matching.add(ex['idx'])
            continue

        # Search in assistant text
        assistant_text = ex.get('assistant_text', '')
        if search_in_text(assistant_text, keyword):
            matching.add(ex['idx'])

    return matching


def parse_last_n(arg: str, total_exchanges: int) -> Set[int]:
    """Parse lastN argument into set of exchange indices."""
    if arg.lower().startswith('last'):
        try:
            n = int(arg[4:])
            start = max(1, total_exchanges - n + 1)
            return set(range(start, total_exchanges + 1))
        except ValueError:
            pass
    return set()


def format_exchanges(exchanges: List[Dict], query_type: str = "") -> str:
    """Format exchanges as markdown for recall."""
    if not exchanges:
        return "*No exchanges found.*"

    output = []
    total_chars = 0

    for ex in exchanges:
        idx = ex.get('idx', '?')
        time = format_timestamp(ex.get('timestamp', ''))
        date = format_short_date(ex.get('timestamp', ''))
        time_str = f" [{date} {time}]" if date and time else (f" [{time}]" if time else "")

        # Use full content if available, fall back to preview
        user_text = ex.get('user_text', ex.get('preview', ''))
        assistant_text = ex.get('assistant_text', '')

        # Truncate for display
        user_text = truncate_text(user_text, MAX_CHARS_PER_MESSAGE)
        assistant_text = truncate_text(assistant_text, MAX_CHARS_PER_MESSAGE)

        exchange_chars = len(user_text) + len(assistant_text)
        if total_chars + exchange_chars > MAX_TOTAL_CHARS:
            remaining = len(exchanges) - len([l for l in output if l.startswith('### Exchange')])
            output.append(f"\n*[Reached size limit - {remaining} more exchanges not shown]*")
            break

        output.append(f"### Exchange #{idx}{time_str}")
        output.append("")
        output.append(f"**User:**\n{user_text}")
        output.append("")
        if assistant_text:
            output.append(f"**Assistant:**\n{assistant_text}")
            output.append("")
        output.append("---")
        output.append("")

        total_chars += exchange_chars

    return "\n".join(output)


def get_session_dates(exchanges: List[Dict]) -> List[str]:
    """Get list of unique dates in the session."""
    dates = set()
    for ex in exchanges:
        date = get_date_from_timestamp(ex.get('timestamp', ''))
        if date:
            dates.add(date)
    return sorted(dates)


def print_usage():
    """Print usage information."""
    print("**Usage:**")
    print("- `/recall last5` - Recall last 5 exchanges")
    print("- `/recall last10` - Recall last 10 exchanges")
    print("- `/recall around 2pm` - Recall exchanges around 2pm")
    print("- `/recall around \"jan 5 2pm\"` - Recall exchanges around 2pm on Jan 5")
    print("- `/recall search keyword` - Search for exchanges containing keyword")
    print("")
    print("Or just run `/recall` for the interactive menu.")


def main():
    args = sys.argv[1:]

    if not args:
        args = ['last5']

    index = load_index()

    if not index:
        print("*No conversation index found. The recall hook may not be active yet.*")
        print("*Try sending another message first, then run /recall again.*")
        return

    total_exchanges = index.get('total_exchanges', 0)
    exchanges_list = index.get('exchanges', [])

    if total_exchanges == 0:
        print("*No exchanges found in the current session.*")
        return

    target_indices = set()
    query_type = ""

    first_arg = args[0].lower()

    # Handle "lastN" format
    if first_arg.startswith('last'):
        target_indices = parse_last_n(first_arg, total_exchanges)
        query_type = first_arg
        if not target_indices:
            print(f"*Invalid format: {first_arg}. Try 'last5' or 'last10'.*")
            return

    # Handle "around TIME" format (with date awareness)
    elif first_arg == 'around':
        if len(args) < 2:
            print("*Please specify a time, e.g., 'around 2pm' or 'around \"jan 5 2pm\"'*")
            return

        time_str = ' '.join(args[1:])

        # Try date-aware parsing first
        result = parse_date_time_query(time_str, get_session_dates(exchanges_list))

        if result:
            target_time, target_date = result

            # Show which dates are available if multi-day session
            session_dates = get_session_dates(exchanges_list)
            if len(session_dates) > 1 and not target_date:
                print(f"*Note: Session spans {len(session_dates)} days: {', '.join(format_short_date(d + 'T00:00:00Z') for d in session_dates)}*")
                print(f"*Showing closest match to {time_str}. Specify date for precision (e.g., 'jan 5 2pm')*\n")

            target_idx_list = find_exchanges_by_time(exchanges_list, target_time, target_date)
            target_indices = set(target_idx_list)
            query_type = f"around {time_str}"

            if not target_indices:
                print(f"*No exchanges found around {time_str}*")
                return
        else:
            print(f"*Could not parse time: '{time_str}'. Try formats like '2pm', '2:30pm', 'jan 5 2pm'*")
            return

    # Handle "search KEYWORD" format (full-content search)
    elif first_arg == 'search':
        if len(args) < 2:
            print("*Please specify a search term, e.g., 'search authentication'*")
            return

        keyword = ' '.join(args[1:])
        target_indices = search_exchanges_full_content(exchanges_list, keyword)
        query_type = f"search '{keyword}'"

        if not target_indices:
            print(f"*No exchanges found matching '{keyword}'*")
            print("*Search looks in both user prompts AND assistant responses.*")
            return

        # Limit search results
        if len(target_indices) > 10:
            sorted_indices = sorted(target_indices, reverse=True)[:10]
            target_indices = set(sorted_indices)
            print(f"*Found many matches for '{keyword}', showing 10 most recent:*\n")

    else:
        print(f"*Unknown command: '{first_arg}'*\n")
        print_usage()
        return

    # Filter exchanges to target indices
    selected_exchanges = [ex for ex in exchanges_list if ex['idx'] in target_indices]
    selected_exchanges.sort(key=lambda x: x['idx'])

    if not selected_exchanges:
        print(f"*Could not fetch exchanges.*")
        return

    print(f"*Fetched {len(selected_exchanges)} exchange(s) ({query_type}):*\n")
    print(format_exchanges(selected_exchanges, query_type))


if __name__ == '__main__':
    main()
