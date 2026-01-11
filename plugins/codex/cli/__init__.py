"""Codex CLI - Command-line interface for OpenAI Codex integration."""

import sys
import os

# Ensure CLI directory is in path so all modules can import config.py
_cli_dir = os.path.dirname(os.path.abspath(__file__))
if _cli_dir not in sys.path:
    sys.path.insert(0, _cli_dir)

__version__ = "2.0.0"
