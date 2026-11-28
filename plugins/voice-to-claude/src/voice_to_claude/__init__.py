"""
Voice-to-Claude: High-quality voice dictation for Claude Code.

Uses whisper.cpp (GGML) for fast on-device speech recognition.
Supports Metal GPU acceleration on macOS and CPU inference on Linux.
Works entirely offline with no cloud APIs.
"""

__version__ = "0.1.0"

__all__ = [
    "config",
    "daemon",
    "keyboard",
    "recorder",
    "sounds",
    "transcriber",
    "utils",
]
