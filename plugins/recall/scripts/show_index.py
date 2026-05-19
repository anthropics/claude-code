#!/usr/bin/env python3
"""Display paginated conversation index for the /recall command.

This script reads the index built by the hook and displays it
in a paginated format for user browsing.

Usage:
    python3 show_index.py                    # Show most recent page (default)
    python3 show_index.py --page 1           # Show specific page (1-indexed)
    python3 show_index.py --around "2:30pm"  # Show exchanges around a time
    python3 show_index.py --search "keyword" # Search for exchanges containing keyword

Improvements:
- Uses shared utils module
- Full-content search (not just preview)
- Groups exchanges by date in multi-day sessions
- Shows date range info
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict

# Add scripts directory to path for utils import
sys.path.insert(0, str(Path(__file__).parent))

from utils import (
    load_index,
    format_timestamp,
    format_date,
    format_short_date,
    parse_time_query,
    get_date_from_timestamp,
    search_in_text,
    PAGE_SIZE,
)


def find_page_for_time(exchanges: List[Dict], target_time: datetime) -> int:
    """Find the page number containing exchanges closest to target_time."""
    if not exchanges:
        return 1

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

    total = len(exchanges)
    pos_from_end = total - 1 - best_idx
    page = (pos_from_end // PAGE_SIZE) + 1
    return page


def search_exchanges(exchanges: List[Dict], keyword: str) -> List[Dict]:
    """Search exchanges for keyword in preview AND full content."""
    results = []
    for ex in exchanges:
        # Search preview
        if search_in_text(ex.get('preview', ''), keyword):
            results.append(ex)
            continue
        # Search full content if available
        if search_in_text(ex.get('user_text', ''), keyword):
            results.append(ex)
            continue
        if search_in_text(ex.get('assistant_text', ''), keyword):
            results.append(ex)
    return results


def get_session_date_range(exchanges: List[Dict]) -> str:
    """Get human-readable date range for the session."""
    if not exchanges:
        return ""

    dates = set()
    for ex in exchanges:
        date = get_date_from_timestamp(ex.get('timestamp', ''))
        if date:
            dates.add(date)

    if len(dates) == 0:
        return ""
    elif len(dates) == 1:
        return format_short_date(list(dates)[0] + 'T00:00:00Z')
    else:
        sorted_dates = sorted(dates)
        start = format_short_date(sorted_dates[0] + 'T00:00:00Z')
        end = format_short_date(sorted_dates[-1] + 'T00:00:00Z')
        return f"{start} - {end}"


def format_page(
    exchanges: List[Dict],
    page: int,
    total_exchanges: int,
    session_start: str
) -> str:
    """Format a page of exchanges as markdown."""
    total_pages = (total_exchanges + PAGE_SIZE - 1) // PAGE_SIZE

    if not exchanges:
        return "*No exchanges found in this session.*"

    start_from_end = (page - 1) * PAGE_SIZE
    end_from_end = start_from_end + PAGE_SIZE

    page_exchanges = list(reversed(exchanges))
    page_slice = page_exchanges[start_from_end:end_from_end]

    if not page_slice:
        return f"*Page {page} is empty. Total pages: {total_pages}*"

    # Get date range info
    date_range = get_session_date_range(exchanges)
    date_info = f" ({date_range})" if date_range else ""

    lines = []
    lines.append(f"**Session started:** {format_date(session_start)}{date_info}")
    lines.append(f"**Total exchanges:** {total_exchanges}")
    lines.append("")
    lines.append(f"**Showing page {page} of {total_pages}** (most recent first):")
    lines.append("")

    # Group by date if multi-day session
    current_date = None
    for ex in page_slice:
        ex_date = get_date_from_timestamp(ex.get('timestamp', ''))

        # Show date header if date changed
        if ex_date != current_date:
            current_date = ex_date
            if ex_date:
                lines.append(f"\n**{format_short_date(ex_date + 'T00:00:00Z')}:**")

        idx = ex.get('idx', '?')
        time = format_timestamp(ex.get('timestamp', ''))
        preview = ex.get('preview', '(no preview)')
        lines.append(f"**#{idx}** [{time}] \"{preview}\"")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("**Navigation:**")
    if page > 1:
        lines.append(f"- Show newer: page {page - 1}")
    if page < total_pages:
        lines.append(f"- Show older: page {page + 1}")
    lines.append("- Jump to time: e.g., \"around 2pm\" or \"around jan 5 2pm\"")
    lines.append("- Search: e.g., \"search authentication\"")

    return "\n".join(lines)


def format_search_results(results: List[Dict], keyword: str, total_exchanges: int) -> str:
    """Format search results as markdown."""
    if not results:
        return f"*No exchanges found matching \"{keyword}\"*\n*Search looks in both user prompts AND assistant responses.*"

    lines = []
    lines.append(f"**Search results for \"{keyword}\":** ({len(results)} matches)")
    lines.append("")

    # Group by date
    current_date = None
    for ex in results[:20]:
        ex_date = get_date_from_timestamp(ex.get('timestamp', ''))
        if ex_date != current_date:
            current_date = ex_date
            if ex_date:
                lines.append(f"\n**{format_short_date(ex_date + 'T00:00:00Z')}:**")

        idx = ex.get('idx', '?')
        time = format_timestamp(ex.get('timestamp', ''))
        preview = ex.get('preview', '(no preview)')
        lines.append(f"**#{idx}** [{time}] \"{preview}\"")

    if len(results) > 20:
        lines.append(f"*... and {len(results) - 20} more matches*")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description='Display conversation index')
    parser.add_argument('--page', type=int, default=1, help='Page number (1-indexed)')
    parser.add_argument('--around', type=str, help='Show exchanges around a time')
    parser.add_argument('--search', type=str, help='Search for keyword')

    args = parser.parse_args()

    index = load_index()

    if not index:
        print("*No conversation index found. The recall hook may not be active yet.*")
        print("*Try sending another message first, then run /recall again.*")
        return

    exchanges = index.get('exchanges', [])
    total_exchanges = index.get('total_exchanges', len(exchanges))
    session_start = index.get('session_start', '')

    if not exchanges:
        print("*No exchanges found in the current session.*")
        return

    # Handle search
    if args.search:
        results = search_exchanges(exchanges, args.search)
        print(format_search_results(results, args.search, total_exchanges))
        return

    # Handle time-based navigation
    page = args.page
    if args.around:
        target_time = parse_time_query(args.around)
        if target_time:
            page = find_page_for_time(exchanges, target_time)
        else:
            print(f"*Could not parse time: {args.around}. Try formats like '2:30pm' or '14:30'*")
            return

    print(format_page(exchanges, page, total_exchanges, session_start))


if __name__ == '__main__':
    main()
