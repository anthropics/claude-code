# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Pattern Matchers
# https://github.com/dp-web4/web4
"""
Pattern Matchers for Policy Rules.

Provides glob/regex matching for targets and temporal matching for time windows.

Usage:
    from governance.matchers import matches_time_window, matches_target, glob_to_regex

    # Check if current time is within business hours
    window = TimeWindow(allowed_hours=(9, 17), allowed_days=[1,2,3,4,5])
    if matches_time_window(window):
        print("Within business hours")

    # Check if target matches patterns
    if matches_target("/path/.env", ["**/.env*"], use_regex=False):
        print("Matches credential pattern")
"""

import re
import fnmatch
from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from .presets import TimeWindow


def matches_time_window(time_window: TimeWindow, now: Optional[datetime] = None) -> bool:
    """
    Check if the current time falls within a time window.

    Args:
        time_window: TimeWindow with allowed_hours, allowed_days, timezone
        now: Current time (defaults to now)

    Returns:
        True if within the allowed window, False otherwise
    """
    if now is None:
        now = datetime.now()

    # Convert to specified timezone if provided
    if time_window.timezone:
        try:
            tz = ZoneInfo(time_window.timezone)
            now = now.astimezone(tz)
        except Exception:
            # Invalid timezone, use local time
            pass

    hours = now.hour
    day_of_week = now.weekday()  # Monday=0, Sunday=6
    # Convert to JS-style: Sunday=0, Monday=1, ... Saturday=6
    day_of_week = (day_of_week + 1) % 7

    # Check allowed hours
    if time_window.allowed_hours:
        start_hour, end_hour = time_window.allowed_hours
        # Handle overnight windows (e.g., [22, 6] for 10pm-6am)
        if start_hour <= end_hour:
            if hours < start_hour or hours >= end_hour:
                return False
        else:
            # Overnight: valid if >= start OR < end
            if hours < start_hour and hours >= end_hour:
                return False

    # Check allowed days
    if time_window.allowed_days:
        if day_of_week not in time_window.allowed_days:
            return False

    return True


def glob_to_regex(pattern: str) -> re.Pattern:
    """
    Convert a glob pattern to a regex.

    Supports:
    - * (any chars except /)
    - ** (any chars including /)
    - ? (single char)

    Args:
        pattern: Glob pattern string

    Returns:
        Compiled regex pattern
    """
    result = ""
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "*":
            if i + 1 < len(pattern) and pattern[i + 1] == "*":
                result += ".*"
                i += 2
                # Skip trailing slash after **
                if i < len(pattern) and pattern[i] == "/":
                    i += 1
            else:
                result += "[^/]*"
                i += 1
        elif ch == "?":
            result += "[^/]"
            i += 1
        elif ch in ".+^${}()|[]\\":
            result += "\\" + ch
            i += 1
        else:
            result += ch
            i += 1

    return re.compile("^" + result + "$")


def matches_target(
    target: Optional[str],
    patterns: List[str],
    use_regex: bool = False
) -> bool:
    """
    Check if a target string matches any of the given patterns.

    Args:
        target: Target string to match
        patterns: List of glob or regex patterns
        use_regex: If True, treat patterns as regex; if False, treat as glob

    Returns:
        True if target matches any pattern
    """
    if target is None:
        return False

    for pattern in patterns:
        if use_regex:
            if re.search(pattern, target):
                return True
        else:
            if glob_to_regex(pattern).search(target):
                return True

    return False


def validate_regex_pattern(pattern: str) -> tuple:
    """
    Validate a regex pattern for potential ReDoS vulnerabilities.

    Checks for common ReDoS patterns:
    - Nested quantifiers: (a+)+, (a*)*
    - Overlapping alternations with quantifiers
    - Excessive quantifier chains

    Args:
        pattern: Regex pattern to validate

    Returns:
        Tuple of (valid: bool, reason: str or None)
    """
    # Check for nested quantifiers
    if re.search(r"\([^)]*[*+]\)[*+?]|\([^)]*[*+?]\)\{", pattern):
        return (False, "Nested quantifiers detected (potential ReDoS)")

    # Check for overlapping alternations with wildcards
    match = re.search(r"\(([^|)]+)\|([^|)]+)\)[*+]", pattern)
    if match:
        alt1, alt2 = match.group(1), match.group(2)
        if alt1 in (".*", ".+") or alt2 in (".*", ".+"):
            return (False, "Overlapping alternations with wildcards (potential ReDoS)")

    # Check for quantifier chains
    if re.search(r"\{[^}]+\}\s*\{", pattern):
        return (False, "Chained quantifiers detected (potential ReDoS)")

    # Check pattern length
    if len(pattern) > 500:
        return (False, "Pattern too long (max 500 characters)")

    # Try to compile the regex
    try:
        re.compile(pattern)
    except re.error as e:
        return (False, f"Invalid regex: {e}")

    return (True, None)
