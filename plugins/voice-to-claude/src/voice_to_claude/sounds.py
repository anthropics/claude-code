"""Audio feedback sounds."""

import subprocess
from pathlib import Path


def play_start_sound() -> None:
    """Play sound when recording starts."""
    # Use macOS system sound
    subprocess.run(
        ["afplay", "/System/Library/Sounds/Pop.aiff"],
        capture_output=True
    )


def play_stop_sound() -> None:
    """Play sound when recording stops."""
    subprocess.run(
        ["afplay", "/System/Library/Sounds/Tink.aiff"],
        capture_output=True
    )


def play_success_sound() -> None:
    """Play sound on successful transcription."""
    subprocess.run(
        ["afplay", "/System/Library/Sounds/Glass.aiff"],
        capture_output=True
    )


def play_error_sound() -> None:
    """Play sound on error."""
    subprocess.run(
        ["afplay", "/System/Library/Sounds/Basso.aiff"],
        capture_output=True
    )
