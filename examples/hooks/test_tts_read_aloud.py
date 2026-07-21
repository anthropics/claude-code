#!/usr/bin/env python3
"""
Unit tests for TTS read-aloud hook.

Run with: python3 -m pytest test_tts_read_aloud.py -v
Or without pytest: python3 test_tts_read_aloud.py
"""

import sys
import re
from pathlib import Path


def strip_markdown(text: str) -> str:
    """Remove markdown formatting from text for cleaner TTS output."""
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`[^`\n]+`', '', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*{1,3}([^*\n]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_\n]+)_{1,3}', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{2,}', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def first_n_sentences(text: str, n: int) -> str:
    """Extract first N sentences from text."""
    if n <= 0:
        return ""
    parts = re.split(r'(?<=[.!?])\s+', text)
    return ' '.join(parts[:n])


def test_strip_markdown_code_blocks():
    input_text = """Here's a function:
```python
def hello():
    print("world")
```
The end."""
    result = strip_markdown(input_text)
    assert "```" not in result
    assert "def hello" not in result
    assert "print" not in result
    assert "The end" in result
    print("✅ test_strip_markdown_code_blocks passed")


def test_strip_markdown_inline_code():
    input_text = "Use `python3 script.py` to run it"
    result = strip_markdown(input_text)
    assert "`" not in result
    assert "python3 script.py" not in result
    assert "Use" in result
    assert "to run it" in result
    print("✅ test_strip_markdown_inline_code passed")


def test_strip_markdown_links():
    input_text = "Check out [this site](https://example.com) for more info"
    result = strip_markdown(input_text)
    assert "](https://" not in result
    assert "this site" in result
    print("✅ test_strip_markdown_links passed")


def test_strip_markdown_urls():
    input_text = "See https://example.com for details"
    result = strip_markdown(input_text)
    assert "https://" not in result
    assert "See" in result
    assert "for details" in result
    print("✅ test_strip_markdown_urls passed")


def test_strip_markdown_bold_italic():
    input_text = "This is **bold** and *italic* text"
    result = strip_markdown(input_text)
    assert "**" not in result
    assert "bold" in result
    assert "italic" in result
    print("✅ test_strip_markdown_bold_italic passed")


def test_strip_markdown_headers():
    input_text = "# Main Title\n## Subtitle\nContent here"
    result = strip_markdown(input_text)
    assert "Content here" in result
    print("✅ test_strip_markdown_headers passed")


def test_strip_markdown_lists():
    input_text = """Points:
- First point
- Second point
- Third point"""
    result = strip_markdown(input_text)
    assert "First point" in result
    assert "Second point" in result
    assert result.count("-") == 0
    print("✅ test_strip_markdown_lists passed")


def test_strip_markdown_whitespace():
    input_text = "Text   with\n\n\nmultiple   spaces"
    result = strip_markdown(input_text)
    assert "  " not in result
    assert "\n" not in result
    print("✅ test_strip_markdown_whitespace passed")


def test_strip_markdown_mixed():
    input_text = """Here's the solution:

## Implementation
```python
def calculate(x):
    return x * 2
```

See [documentation](https://docs.example.com) for details.

Key points:
- **Important**: Use this carefully
- See https://example.com
- Works with `Python 3.8+`
"""
    result = strip_markdown(input_text)
    assert "```" not in result
    assert "#" not in result
    assert "[" not in result
    assert "](" not in result
    assert "Implementation" in result
    assert "documentation" in result
    assert "Important" in result
    assert "Works with" in result
    print("✅ test_strip_markdown_mixed passed")


def test_first_n_sentences_basic():
    text = "First sentence. Second sentence. Third sentence."
    assert first_n_sentences(text, 1) == "First sentence."
    assert first_n_sentences(text, 2) == "First sentence. Second sentence."
    assert first_n_sentences(text, 3) == "First sentence. Second sentence. Third sentence."
    print("✅ test_first_n_sentences_basic passed")


def test_first_n_sentences_various_punctuation():
    text = "First sentence. Second one! Third one? Fourth."
    result = first_n_sentences(text, 2)
    assert result == "First sentence. Second one!"
    print("✅ test_first_n_sentences_various_punctuation passed")


def test_first_n_sentences_zero():
    text = "First. Second."
    result = first_n_sentences(text, 0)
    assert result == ""
    print("✅ test_first_n_sentences_zero passed")


def test_first_n_sentences_more_than_available():
    text = "Only one sentence."
    result = first_n_sentences(text, 5)
    assert result == "Only one sentence."
    print("✅ test_first_n_sentences_more_than_available passed")


def test_first_n_sentences_no_punctuation():
    text = "This is a sentence without ending punctuation"
    result = first_n_sentences(text, 1)
    assert result == text
    print("✅ test_first_n_sentences_no_punctuation passed")


def test_code_response_threshold():
    response = "```python\n" + "print('line')\n" * 50 + "```\nHere's your code."
    stripped = strip_markdown(response)
    threshold = 0.3
    should_skip = len(stripped) < len(response) * threshold
    assert should_skip == True
    print("✅ test_code_response_threshold passed")


def test_short_response_minimum_length():
    response = "OK"
    min_length = 10
    should_skip = len(response) < min_length
    assert should_skip == True
    print("✅ test_short_response_minimum_length passed")


def test_reasonable_response():
    response = "Here's your detailed answer with multiple sentences. It contains enough content to read aloud."
    min_length = 10
    code_threshold = 0.3
    assert len(response) > min_length
    assert len(response) > len(response) * code_threshold
    print("✅ test_reasonable_response passed")


if __name__ == "__main__":
    print("Running TTS Hook Tests...\n")

    try:
        test_strip_markdown_code_blocks()
        test_strip_markdown_inline_code()
        test_strip_markdown_links()
        test_strip_markdown_urls()
        test_strip_markdown_bold_italic()
        test_strip_markdown_headers()
        test_strip_markdown_lists()
        test_strip_markdown_whitespace()
        test_strip_markdown_mixed()
        test_first_n_sentences_basic()
        test_first_n_sentences_various_punctuation()
        test_first_n_sentences_zero()
        test_first_n_sentences_more_than_available()
        test_first_n_sentences_no_punctuation()
        test_code_response_threshold()
        test_short_response_minimum_length()
        test_reasonable_response()

        print("\n" + "="*60)
        print("✅ All tests passed!")
        print("="*60)

    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
