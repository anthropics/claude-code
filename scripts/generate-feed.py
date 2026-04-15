#!/usr/bin/env python3
"""Generate an Atom feed (feed.xml) from CHANGELOG.md.

Each version section becomes a feed entry with the full list of changes
as the entry content. This produces a feed that RSS readers (including
Slack's /feed integration) can display without truncation.

Usage:
    python3 scripts/generate-feed.py
"""

import re
import html
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

    # Don't forget the last section
    if current_version and current_lines:
        entries.append({"version": current_version, "lines": current_lines})

    return entries[:MAX_ENTRIES]


def lines_to_html(lines: list[str]) -> str:
    """Convert markdown bullet lines to simple HTML."""
    html_parts = ["<ul>"]
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Remove leading "- " bullet marker
        if stripped.startswith("- "):
            stripped = stripped[2:]
        # Escape HTML entities first, then convert backtick code spans
        escaped = html.escape(stripped)
        escaped = re.sub(
            r"`([^`]+)`", r"<code>\1</code>", escaped
        )
        html_parts.append(f"  <li>{escaped}</li>")
    html_parts.append("</ul>")
    return "\n".join(html_parts)


def build_feed(entries: list[dict]) -> str:
    """Build an Atom XML feed from parsed changelog entries."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    feed_entries = []
    for entry in entries:
        version = entry["version"]
        tag = f"v{version}"
        content_html = lines_to_html(entry["lines"])
        escaped_content = html.escape(content_html)

        feed_entries.append(
            f"""  <entry>
    <id>{REPO_URL}/releases/tag/{tag}</id>
    <title>Claude Code {tag}</title>
    <link rel="alternate" type="text/html" href="{REPO_URL}/releases/tag/{tag}"/>
    <updated>{now}</updated>
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
    feed_xml = build_feed(entries)
    FEED_PATH.write_text(feed_xml, encoding="utf-8")
    print(f"Generated feed.xml with {len(entries)} entries")


if __name__ == "__main__":
    main()
