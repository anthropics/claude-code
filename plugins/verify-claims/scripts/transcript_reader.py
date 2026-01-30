"""Read and parse Claude Code transcript JSONL files."""

import json
from collections.abc import Generator
from pathlib import Path
from typing import Any


def read_transcript(transcript_path: str) -> Generator[dict[str, Any], None, None]:
    """
    Read a transcript JSONL file and yield each message.

    Args:
        transcript_path: Path to the JSONL transcript file

    Yields:
        Dict representing each message in the transcript
    """
    path = Path(transcript_path)
    if not path.exists():
        return

    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def get_last_assistant_messages(transcript_path: str, count: int = 3) -> list[dict[str, Any]]:
    """
    Get the last N assistant messages from the transcript.

    Args:
        transcript_path: Path to the JSONL transcript file
        count: Number of messages to retrieve

    Returns:
        List of assistant messages (most recent last)
    """
    assistant_messages = []

    for message in read_transcript(transcript_path):
        if message.get("type") == "assistant":
            assistant_messages.append(message)

    # Return last N messages
    return assistant_messages[-count:] if len(assistant_messages) >= count else assistant_messages


def extract_assistant_text(message: dict[str, Any]) -> str:
    """
    Extract text content from an assistant message.

    Handles various message formats:
    - Direct text content
    - Content blocks with text type
    - Nested message structures

    Args:
        message: Assistant message dictionary

    Returns:
        Combined text content from the message
    """
    text_parts = []

    # Direct message field
    if "message" in message:
        msg = message["message"]
        if isinstance(msg, str):
            text_parts.append(msg)
        elif isinstance(msg, dict):
            # Check for content field
            content = msg.get("content", [])
            if isinstance(content, str):
                text_parts.append(content)
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, str):
                        text_parts.append(block)
                    elif isinstance(block, dict):
                        if block.get("type") == "text":
                            text_parts.append(block.get("text", ""))

    # Direct content field
    if "content" in message:
        content = message["content"]
        if isinstance(content, str):
            text_parts.append(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, str):
                    text_parts.append(block)
                elif isinstance(block, dict):
                    if block.get("type") == "text":
                        text_parts.append(block.get("text", ""))

    return "\n".join(text_parts)


def get_recent_assistant_text(transcript_path: str, message_count: int = 3) -> str:
    """
    Get combined text from the last N assistant messages.

    Args:
        transcript_path: Path to the JSONL transcript file
        message_count: Number of recent messages to combine

    Returns:
        Combined text from recent assistant messages
    """
    messages = get_last_assistant_messages(transcript_path, message_count)
    texts = [extract_assistant_text(msg) for msg in messages]
    return "\n\n".join(texts)
