"""Audio feedback sounds with cross-platform support."""

import subprocess
from pathlib import Path
from typing import Optional

from .utils import IS_MACOS, IS_LINUX, find_sound_player

# macOS system sounds
_MACOS_SOUNDS = {
    "start": "/System/Library/Sounds/Pop.aiff",
    "stop": "/System/Library/Sounds/Tink.aiff",
    "success": "/System/Library/Sounds/Glass.aiff",
    "error": "/System/Library/Sounds/Basso.aiff",
}

# Linux: XDG sound theme paths (freedesktop standard)
_LINUX_SOUNDS = {
    "start": "/usr/share/sounds/freedesktop/stereo/message-new-instant.oga",
    "stop": "/usr/share/sounds/freedesktop/stereo/message.oga",
    "success": "/usr/share/sounds/freedesktop/stereo/complete.oga",
    "error": "/usr/share/sounds/freedesktop/stereo/dialog-error.oga",
}


def _play(sound_key: str) -> None:
    """Play a named sound effect using the platform audio player."""
    player = find_sound_player()
    if player is None:
        return  # No audio player available; silently skip

    if IS_MACOS:
        sound_file = _MACOS_SOUNDS.get(sound_key)
    elif IS_LINUX:
        sound_file = _LINUX_SOUNDS.get(sound_key)
    else:
        return

    if sound_file is None or not Path(sound_file).exists():
        return

    try:
        subprocess.run([player, sound_file], capture_output=True, timeout=5)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass


def play_start_sound() -> None:
    """Play sound when recording starts."""
    _play("start")


def play_stop_sound() -> None:
    """Play sound when recording stops."""
    _play("stop")


def play_success_sound() -> None:
    """Play sound on successful transcription."""
    _play("success")


def play_error_sound() -> None:
    """Play sound on error."""
    _play("error")
