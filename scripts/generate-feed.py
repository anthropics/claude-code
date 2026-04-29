#!/usr/bin/env python3
"""Generate an Atom feed (feed.xml) from CHANGELOG.md.

Each version section (up to the 20 most recent) becomes a feed entry
with the full list of changes as the entry content. This produces a
feed that RSS readers (including Slack's /feed integration) can
display cleanly.

Usage:
    python3 scripts/generate-feed.py
"""

import re
import html
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

REPO_URL = "https://github.com/anthropics/claude-code"
CHANGELOG_PATH = Path(__file__).resolve().parent.parent / "CHANGELOG.md"
FEED_PATH = Path(__file__).resolve().parent.parent / "feed.xml"
MAX_ENTRIES = 20


def parse_changelog(text: str) -> list[dict]:
    """Parse CHANGELOG.md into a list of version entries."""
    entries = []
    current_version = None
    current_lines: list[str] = []

    for line in text.splitlines():
        # Matches "## X.Y.Z" headers (three-component semver only)
        header_match = re.match(r"^## (\d+\.\d+\.\d+)", line)
        if header_match:
            if current_version and current_lines:
                entries.append(
                    {"version": current_version, "lines": current_lines}
                )
            current_version = header_match.group(1)
            current_lines = []
        elif current_version:
            current_lines.append(line)

    # Flush the final section (the loop only appends when it hits the next header)
    if current_version and current_lines:
        entries.append({"version": current_version, "lines": current_lines})

    return entries[:MAX_ENTRIES]


def lines_to_html(lines: list[str]) -> str:
    """Convert changelog lines to HTML paragraphs for Slack RSS rendering.

    Slack's RSS bot strips <ul>/<li> into flat indented text and drops
    <code> tags entirely. Using <p> tags with bullet characters produces
    cleaner output. Backticks pass through as literal characters since
    html.escape does not alter them.
    """
    html_parts = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("- "):
            stripped = stripped[2:]
        escaped = html.escape(stripped)
        html_parts.append(f"<p>• {escaped}</p>")
    return "\n".join(html_parts)


def get_release_dates() -> dict[str, str]:
    """Fetch release publish dates from git tags.

    Returns a dict mapping version strings to ISO 8601 timestamps.
    Falls back to an empty dict if git is unavailable.
    """
    try:
        result = subprocess.run(
            ["git", "tag", "-l", "v*", "--format=%(refname:short) %(creatordate:iso-strict)"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            return {}
        dates = {}
        for line in result.stdout.strip().splitlines():
            parts = line.split(" ", 1)
            if len(parts) == 2:
                tag, date = parts
                version = tag.lstrip("v")
                # Normalize to Atom-compatible format
                dates[version] = date.replace("+00:00", "Z")
        return dates
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {}


def build_feed(entries: list[dict]) -> str:
    """Build an Atom XML feed from parsed changelog entries.

    Uses actual git tag dates for each entry's <updated> timestamp
    when available, falling back to the current time. This prevents
    RSS readers from re-notifying for all entries on every regeneration.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    release_dates = get_release_dates()

    feed_entries = []
    for entry in entries:
        version = entry["version"]
        tag = f"v{version}"
        content_html = lines_to_html(entry["lines"])
        escaped_content = html.escape(content_html)
        entry_updated = release_dates.get(version, now)

        feed_entries.append(
            f"""  <entry>
    <id>{REPO_URL}/releases/tag/{tag}</id>
    <title>Claude Code {tag}</title>
    <link rel="alternate" type="text/html" href="{REPO_URL}/releases/tag/{tag}"/>
    <updated>{entry_updated}</updated>
    <content type="html">{escaped_content}</content>
  </entry>"""
        )

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>{REPO_URL}/blob/main/CHANGELOG.md</id>
  <title>Claude Code Changelog</title>
  <subtitle>Release notes for Claude Code</subtitle>
  <link rel="alternate" type="text/html" href="{REPO_URL}/blob/main/CHANGELOG.md"/>
  <link rel="self" type="application/atom+xml" href="https://raw.githubusercontent.com/anthropics/claude-code/main/feed.xml"/>
  <updated>{now}</updated>
{chr(10).join(feed_entries)}
</feed>
"""


def main():
    changelog_text = CHANGELOG_PATH.read_text(encoding="utf-8")
    entries = parse_changelog(changelog_text)

    if not entries:
        print(
            f"ERROR: No version entries found in CHANGELOG.md at {CHANGELOG_PATH}",
            file=sys.stderr,
        )
        print("Expected '## X.Y.Z' section headers.", file=sys.stderr)
        sys.exit(1)

    feed_xml = build_feed(entries)

    # Validate well-formed XML before writing
    try:
        ET.fromstring(feed_xml)
    except ET.ParseError as e:
        print(f"ERROR: Generated feed is malformed XML: {e}", file=sys.stderr)
        sys.exit(1)

    FEED_PATH.write_text(feed_xml, encoding="utf-8")
    print(f"Generated feed.xml with {len(entries)} entries")


if __name__ == "__main__":
    main()
