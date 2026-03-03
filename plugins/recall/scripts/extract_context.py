#!/usr/bin/env python3
"""Extract recent conversation context from saved snapshots.

This script reads from context snapshots saved by the UserPromptSubmit hook.
The hook saves the last 5 exchanges to ~/.claude/context-recall/current.json
on every prompt, so this script always has fresh data to read from.

Usage:
    Called via !` syntax in recall.md command.
    Reads from ~/.claude/context-recall/current.json
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict


def load_snapshot() -> Dict:
    """Load the most recent context snapshot."""
    snapshot_file = Path.home() / '.claude' / 'context-recall' / 'current.json'

    if not snapshot_file.exists():
        return {}

    try:
        with open(snapshot_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def format_exchanges_as_markdown(exchanges: List[Dict]) -> str:
    """Format exchanges as readable markdown.

    Note: Messages are already truncated at save time by the hook
    (max 1000 chars per message, max 8000 chars total).
    """
    if not exchanges:
        return "*No previous conversation history found. Make sure the context-recall plugin hooks are active.*"

    output = []
    for idx, exchange in enumerate(exchanges, 1):
        user_text = exchange.get('user', '')
        assistant_text = exchange.get('assistant', '')
        output.append(f"### Exchange {idx}\n\n**User:**\n{user_text}\n\n**Assistant:**\n{assistant_text}")

    return "\n\n---\n\n".join(output)


def main():
    """Main entry point."""
    snapshot = load_snapshot()

    if not snapshot:
        print("*No context snapshot found. The context-recall hook may not be active yet.*")
        print("*Try sending another message first, then run /recall again.*")
        return

    exchanges = snapshot.get('exchanges', [])
    message_count = snapshot.get('message_count', 0)
    timestamp = snapshot.get('timestamp', 'unknown')

    if not exchanges:
        print("*No conversation exchanges found in the current session.*")
        return

    print(f"*Context snapshot from {timestamp} ({message_count} messages in session)*\n")
    formatted = format_exchanges_as_markdown(exchanges)
    print(formatted)


if __name__ == '__main__':
    main()
