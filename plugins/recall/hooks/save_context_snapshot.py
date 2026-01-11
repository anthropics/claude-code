#!/usr/bin/env python3
"""Save context snapshots and build conversation index for the /recall command.

This hook runs on every UserPromptSubmit event. It:
1. Loads existing index (if any) for the current session
2. Incrementally adds only NEW exchanges (avoids re-parsing entire transcript)
3. Falls back to full rebuild if session changed or index corrupted
4. Logs /recall events for observability

Optimizations:
- Incremental updates: Only parses new messages since last update
- Single output file: Just index.json (no redundant files)
- Stores byte offset for efficient incremental reads
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

# Add scripts directory to path for utils import
sys.path.insert(0, str(Path(__file__).parent.parent / 'scripts'))

from utils import (
    extract_text_content,
    make_preview,
    truncate_text,
    INDEX_DIR,
    INDEX_FILE,
    LOG_FILE,
    PREVIEW_LENGTH,
    MAX_CHARS_PER_MESSAGE,
)


def get_transcript_size(transcript_path: str) -> int:
    """Get the current size of the transcript file."""
    try:
        return os.path.getsize(transcript_path)
    except Exception:
        return 0


def parse_transcript_from_offset(
    transcript_path: str,
    byte_offset: int = 0
) -> Tuple[List[Dict[str, Any]], int]:
    """Parse transcript file starting from byte offset.

    Returns:
        Tuple of (messages list, new byte offset)
    """
    messages = []
    new_offset = byte_offset

    if not transcript_path or not os.path.exists(transcript_path):
        return messages, new_offset

    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            # Seek to offset if provided
            if byte_offset > 0:
                f.seek(byte_offset)

            for line in f:
                line_stripped = line.strip()
                if not line_stripped:
                    continue

                try:
                    entry = json.loads(line_stripped)
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

            # Get final position
            new_offset = f.tell()

    except Exception:
        pass

    return messages, new_offset


def build_new_exchanges(
    messages: List[Dict[str, Any]],
    start_idx: int = 1
) -> List[Dict]:
    """Build exchanges from messages, starting at given index.

    Returns list of dicts with: idx, preview, timestamp, user_text, assistant_text
    """
    exchanges = []
    i = 0
    exchange_idx = start_idx

    while i < len(messages):
        if messages[i]['role'] == 'user':
            user_msg = messages[i]
            if i + 1 < len(messages) and messages[i + 1]['role'] == 'assistant':
                assistant_msg = messages[i + 1]
                exchanges.append({
                    'idx': exchange_idx,
                    'preview': make_preview(user_msg['text']),
                    'timestamp': user_msg.get('timestamp', ''),
                    # Store full text for search (truncated for size)
                    'user_text': truncate_text(user_msg['text'], MAX_CHARS_PER_MESSAGE),
                    'assistant_text': truncate_text(assistant_msg['text'], MAX_CHARS_PER_MESSAGE),
                })
                exchange_idx += 1
                i += 2
            else:
                i += 1
        else:
            i += 1

    return exchanges


def load_existing_index(session_id: str) -> Optional[Dict]:
    """Load existing index if it matches current session."""
    if not INDEX_FILE.exists():
        return None

    try:
        with open(INDEX_FILE, 'r', encoding='utf-8') as f:
            index = json.load(f)

        # Only use if same session
        if index.get('session_id') == session_id:
            return index

    except Exception:
        pass

    return None


def save_index(index_data: Dict) -> None:
    """Save the index to disk."""
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    try:
        with open(INDEX_FILE, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2)
    except Exception:
        pass


def log_recall_event(session_id: str, exchange_count: int) -> None:
    """Log recall event for observability."""
    timestamp = datetime.now(timezone.utc).isoformat()
    log_entry = f"{timestamp} | session={session_id} | exchanges={exchange_count} | CONTEXT_RECALL_TRIGGERED\n"

    print(f"[context-recall] Context recall triggered at exchange #{exchange_count}", file=sys.stderr)

    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    except Exception:
        pass


def main():
    """Main entry point for the hook."""
    try:
        input_data = json.load(sys.stdin)

        session_id = input_data.get('session_id', 'unknown')
        transcript_path = input_data.get('transcript_path', '')
        user_prompt = input_data.get('user_prompt', '')

        now = datetime.now(timezone.utc).isoformat()

        # Try to load existing index for incremental update
        existing_index = load_existing_index(session_id)

        if existing_index:
            # Incremental update
            last_offset = existing_index.get('_byte_offset', 0)
            current_size = get_transcript_size(transcript_path)

            # Only parse if transcript has grown
            if current_size > last_offset:
                new_messages, new_offset = parse_transcript_from_offset(
                    transcript_path, last_offset
                )

                if new_messages:
                    # Build new exchanges starting after existing ones
                    start_idx = existing_index.get('total_exchanges', 0) + 1
                    new_exchanges = build_new_exchanges(new_messages, start_idx)

                    # Append to existing exchanges
                    existing_index['exchanges'].extend(new_exchanges)
                    existing_index['total_exchanges'] = len(existing_index['exchanges'])
                    existing_index['updated_at'] = now
                    existing_index['_byte_offset'] = new_offset

                    save_index(existing_index)
                    index_data = existing_index
                else:
                    # No new complete exchanges yet
                    existing_index['_byte_offset'] = new_offset
                    save_index(existing_index)
                    index_data = existing_index
            else:
                index_data = existing_index
        else:
            # Full rebuild (new session or no existing index)
            messages, byte_offset = parse_transcript_from_offset(transcript_path, 0)
            exchanges = build_new_exchanges(messages, 1)

            session_start = exchanges[0]['timestamp'] if exchanges else now

            index_data = {
                'session_id': session_id,
                'session_start': session_start,
                'updated_at': now,
                'total_exchanges': len(exchanges),
                'transcript_path': transcript_path,
                'exchanges': exchanges,
                '_byte_offset': byte_offset,
            }

            save_index(index_data)

        # Check if this is a /recall command
        if user_prompt.strip().lower().startswith('/recall'):
            log_recall_event(session_id, index_data.get('total_exchanges', 0))
            result = {
                "systemMessage": f"[Observability] Context recall logged at exchange #{index_data.get('total_exchanges', 0)}"
            }
        else:
            result = {}

        print(json.dumps(result), file=sys.stdout)

    except Exception as e:
        error_output = {
            "systemMessage": f"[context-recall] Hook error (non-blocking): {str(e)}"
        }
        print(json.dumps(error_output), file=sys.stdout)

    finally:
        sys.exit(0)


if __name__ == '__main__':
    main()
