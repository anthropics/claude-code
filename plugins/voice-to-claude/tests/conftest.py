"""Shared test fixtures for voice-to-claude tests."""

import json
import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Ensure src is on the path for imports
SRC_DIR = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC_DIR))


@pytest.fixture
def tmp_config_dir(tmp_path):
    """Provide a temporary config directory and patch defaults."""
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    config_file = config_dir / "config.json"
    pid_file = config_dir / "daemon.pid"
    log_file = config_dir / "daemon.log"

    with patch("voice_to_claude.config.DEFAULT_CONFIG_DIR", config_dir), \
         patch("voice_to_claude.config.DEFAULT_CONFIG_FILE", config_file), \
         patch("voice_to_claude.config.DEFAULT_PID_FILE", pid_file), \
         patch("voice_to_claude.config.DEFAULT_LOG_FILE", log_file):
        yield {
            "dir": config_dir,
            "file": config_file,
            "pid_file": pid_file,
            "log_file": log_file,
        }


@pytest.fixture
def sample_config_data():
    """Return sample config data for testing."""
    return {
        "hotkey_ctrl": True,
        "hotkey_alt": True,
        "hotkey_shift": False,
        "hotkey_cmd": False,
        "model": "base",
        "output_mode": "keyboard",
        "sound_effects": True,
        "max_recording_seconds": 60,
        "whisper_cpp_path": "/usr/local/bin/whisper-cli",
        "models_dir": "/usr/local/share/whisper/models",
        "setup_complete": True,
    }
