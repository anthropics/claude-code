"""Configuration management for voice-to-claude."""

import json
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional

# Default paths
DEFAULT_CONFIG_DIR = Path.home() / ".config" / "voice-to-claude"
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "config.json"
DEFAULT_PID_FILE = DEFAULT_CONFIG_DIR / "daemon.pid"
DEFAULT_LOG_FILE = DEFAULT_CONFIG_DIR / "daemon.log"

# Whisper model definitions
WHISPER_MODELS = {
    "tiny": {
        "file": "ggml-tiny.bin",
        "size": "~75MB",
        "speed": "Fastest (~0.5s)",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
    },
    "base": {
        "file": "ggml-base.bin",
        "size": "~142MB",
        "speed": "Fast (~1s)",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
    },
    "medium": {
        "file": "ggml-medium.bin",
        "size": "~1.5GB",
        "speed": "Medium (~2s)",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
    },
    "large-v3": {
        "file": "ggml-large-v3.bin",
        "size": "~3GB",
        "speed": "Slow (~3s)",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
    }
}

# Audio settings
SAMPLE_RATE = 16000  # Whisper expects 16kHz


@dataclass
class Config:
    """Voice-to-claude configuration."""

    # Hotkey settings (modifier keys to hold)
    hotkey_ctrl: bool = True
    hotkey_alt: bool = True
    hotkey_shift: bool = False
    hotkey_cmd: bool = False

    # Model settings
    model: str = "base"

    # Output settings
    output_mode: str = "keyboard"  # "keyboard" or "clipboard"

    # Audio settings
    sound_effects: bool = True
    max_recording_seconds: int = 60

    # Paths (set during setup)
    whisper_cpp_path: Optional[str] = None
    models_dir: Optional[str] = None

    # Setup status
    setup_complete: bool = False

    @classmethod
    def load(cls) -> "Config":
        """Load configuration from file."""
        if DEFAULT_CONFIG_FILE.exists():
            try:
                with open(DEFAULT_CONFIG_FILE) as f:
                    data = json.load(f)
                return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})
            except (json.JSONDecodeError, TypeError):
                pass
        return cls()

    def save(self) -> None:
        """Save configuration to file."""
        DEFAULT_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(DEFAULT_CONFIG_FILE, "w") as f:
            json.dump(asdict(self), f, indent=2)

    def get_model_path(self) -> Optional[Path]:
        """Get path to current model file."""
        if not self.models_dir or self.model not in WHISPER_MODELS:
            return None
        return Path(self.models_dir) / WHISPER_MODELS[self.model]["file"]

    def get_whisper_cli(self) -> Optional[Path]:
        """Get path to whisper-cli executable."""
        if not self.whisper_cpp_path:
            return None
        return Path(self.whisper_cpp_path)

    def get_hotkey_description(self) -> str:
        """Get human-readable hotkey description."""
        keys = []
        if self.hotkey_ctrl:
            keys.append("Ctrl")
        if self.hotkey_alt:
            keys.append("Alt")
        if self.hotkey_shift:
            keys.append("Shift")
        if self.hotkey_cmd:
            keys.append("Cmd")
        return "+".join(keys) if keys else "None"


def get_plugin_root() -> Path:
    """Get the plugin root directory."""
    # This file is at src/voice_to_claude/config.py
    # Plugin root is two directories up
    return Path(__file__).parent.parent.parent


def ensure_config_dir() -> Path:
    """Ensure config directory exists and return it."""
    DEFAULT_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return DEFAULT_CONFIG_DIR
