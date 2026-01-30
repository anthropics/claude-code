"""Tests for transcript_reader.py"""

import json
from pathlib import Path

from transcript_reader import (
    extract_assistant_text,
    get_last_assistant_messages,
    get_recent_assistant_text,
    read_transcript,
)


class TestReadTranscript:
    """Tests for the read_transcript function."""

    def test_read_valid_transcript(self, sample_transcript):
        """Test reading a valid transcript file."""
        messages = list(read_transcript(sample_transcript))
        assert len(messages) == 4
        assert messages[0]["type"] == "user"
        assert messages[1]["type"] == "assistant"

    def test_read_nonexistent_file(self, temp_dir):
        """Test reading a non-existent file."""
        messages = list(read_transcript(f"{temp_dir}/nonexistent.jsonl"))
        assert messages == []

    def test_read_empty_file(self, temp_dir):
        """Test reading an empty file."""
        empty_file = Path(temp_dir) / "empty.jsonl"
        empty_file.touch()
        messages = list(read_transcript(str(empty_file)))
        assert messages == []

    def test_skip_invalid_json_lines(self, temp_dir):
        """Test that invalid JSON lines are skipped."""
        transcript_path = Path(temp_dir) / "mixed.jsonl"
        with open(transcript_path, 'w') as f:
            f.write('{"type": "user", "message": "hello"}\n')
            f.write('invalid json line\n')
            f.write('{"type": "assistant", "message": "hi"}\n')

        messages = list(read_transcript(str(transcript_path)))
        assert len(messages) == 2

    def test_skip_empty_lines(self, temp_dir):
        """Test that empty lines are skipped."""
        transcript_path = Path(temp_dir) / "with_blanks.jsonl"
        with open(transcript_path, 'w') as f:
            f.write('{"type": "user", "message": "hello"}\n')
            f.write('\n')
            f.write('   \n')
            f.write('{"type": "assistant", "message": "hi"}\n')

        messages = list(read_transcript(str(transcript_path)))
        assert len(messages) == 2


class TestGetLastAssistantMessages:
    """Tests for the get_last_assistant_messages function."""

    def test_get_last_messages(self, sample_transcript):
        """Test getting last N assistant messages."""
        messages = get_last_assistant_messages(sample_transcript, count=2)
        assert len(messages) == 2
        for msg in messages:
            assert msg["type"] == "assistant"

    def test_get_more_messages_than_exist(self, sample_transcript):
        """Test requesting more messages than available."""
        messages = get_last_assistant_messages(sample_transcript, count=10)
        # Sample transcript has 2 assistant messages
        assert len(messages) == 2

    def test_empty_transcript(self, temp_dir):
        """Test with empty transcript."""
        empty_file = Path(temp_dir) / "empty.jsonl"
        empty_file.touch()
        messages = get_last_assistant_messages(str(empty_file), count=3)
        assert messages == []


class TestExtractAssistantText:
    """Tests for the extract_assistant_text function."""

    def test_extract_from_content_blocks(self):
        """Test extracting text from content blocks."""
        message = {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "Hello"},
                    {"type": "text", "text": "World"}
                ]
            }
        }
        text = extract_assistant_text(message)
        assert "Hello" in text
        assert "World" in text

    def test_extract_from_direct_string_content(self):
        """Test extracting from direct string content."""
        message = {
            "type": "assistant",
            "content": "Direct text content"
        }
        text = extract_assistant_text(message)
        assert "Direct text content" in text

    def test_extract_from_string_message(self):
        """Test extracting from string message field."""
        message = {
            "type": "assistant",
            "message": "Simple string message"
        }
        text = extract_assistant_text(message)
        assert "Simple string message" in text

    def test_extract_from_list_content(self):
        """Test extracting from list content with strings."""
        message = {
            "type": "assistant",
            "content": ["First part", "Second part"]
        }
        text = extract_assistant_text(message)
        assert "First part" in text
        assert "Second part" in text

    def test_extract_empty_message(self):
        """Test extracting from message with no text."""
        message = {
            "type": "assistant",
            "message": {}
        }
        text = extract_assistant_text(message)
        assert text == ""

    def test_ignore_non_text_blocks(self):
        """Test that non-text blocks are ignored."""
        message = {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "Visible"},
                    {"type": "tool_use", "id": "123"},
                    {"type": "text", "text": "Also visible"}
                ]
            }
        }
        text = extract_assistant_text(message)
        assert "Visible" in text
        assert "Also visible" in text
        assert "tool_use" not in text


class TestGetRecentAssistantText:
    """Tests for the get_recent_assistant_text function."""

    def test_get_combined_text(self, sample_transcript):
        """Test getting combined text from recent messages."""
        text = get_recent_assistant_text(sample_transcript, message_count=3)
        # Should contain text from assistant messages
        assert "config.json" in text or "tests pass" in text

    def test_empty_on_missing_file(self, temp_dir):
        """Test empty result for missing file."""
        text = get_recent_assistant_text(f"{temp_dir}/missing.jsonl", message_count=3)
        assert text == ""

    def test_respects_message_count(self, temp_dir):
        """Test that message count is respected."""
        transcript_path = Path(temp_dir) / "multi.jsonl"
        messages = [
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Message 1"}]}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Message 2"}]}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Message 3"}]}},
            {"type": "assistant", "message": {"content": [{"type": "text", "text": "Message 4"}]}},
        ]
        with open(transcript_path, 'w') as f:
            for msg in messages:
                f.write(json.dumps(msg) + "\n")

        text = get_recent_assistant_text(str(transcript_path), message_count=2)
        # Should only contain last 2 messages
        assert "Message 3" in text
        assert "Message 4" in text
        assert "Message 1" not in text
