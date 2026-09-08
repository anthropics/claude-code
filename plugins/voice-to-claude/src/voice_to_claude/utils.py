"""Cross-platform utilities for voice-to-claude."""

import platform
import shutil
from typing import Optional

# Detect OS once at import time
IS_MACOS = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"
IS_WINDOWS = platform.system() == "Windows"


def find_clipboard_command() -> Optional[list[str]]:
    """Find the appropriate clipboard copy command for the current platform.

    Returns:
        Command list for piping text to clipboard, or None if unavailable.
    """
    if IS_MACOS:
        if shutil.which("pbcopy"):
            return ["pbcopy"]
    elif IS_LINUX:
        # Prefer xclip, fall back to xsel
        if shutil.which("xclip"):
            return ["xclip", "-selection", "clipboard"]
        if shutil.which("xsel"):
            return ["xsel", "--clipboard", "--input"]
        # Wayland support
        if shutil.which("wl-copy"):
            return ["wl-copy"]
    return None


def find_sound_player() -> Optional[str]:
    """Find the appropriate audio player for the current platform.

    Returns:
        Name of the audio player command, or None if unavailable.
    """
    if IS_MACOS:
        return "afplay"
    elif IS_LINUX:
        for player in ("paplay", "aplay", "play"):
            if shutil.which(player):
                return player
    return None


def get_paste_key():
    """Get the platform-appropriate paste modifier key.

    Returns:
        pynput Key for paste shortcut (Cmd on macOS, Ctrl on Linux).
    """
    from pynput.keyboard import Key
    return Key.cmd if IS_MACOS else Key.ctrl
