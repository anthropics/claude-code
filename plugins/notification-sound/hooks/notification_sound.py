#!/usr/bin/env python3
"""
Notification Sound Hook for Claude Code

Plays a system notification sound when Claude finishes processing and is
waiting for user input. Works on macOS, Linux, and Windows.

Configuration (environment variables):
  CLAUDE_NOTIFICATION_SOUND=1        Enable/disable (default: 1)
  CLAUDE_NOTIFICATION_SOUND_PATH     Custom sound file path (optional)
  CLAUDE_NOTIFICATION_VOLUME=50      Volume 0-100, macOS only (default: 50)
"""

import os
import platform
import subprocess
import sys


def get_config():
    """Read configuration from environment variables."""
    try:
        volume = int(os.environ.get("CLAUDE_NOTIFICATION_VOLUME", "50"))
        volume = max(0, min(100, volume))
    except ValueError:
        volume = 50

    custom_sound = os.environ.get("CLAUDE_NOTIFICATION_SOUND_PATH", "")
    # Validate custom sound path: must be a real file, not a directory or symlink chain
    if custom_sound and not os.path.isfile(custom_sound):
        custom_sound = ""

    return {
        "enabled": os.environ.get("CLAUDE_NOTIFICATION_SOUND", "1") != "0",
        "custom_sound": custom_sound,
        "volume": volume,
    }


def play_macos(config):
    """Play notification sound on macOS using afplay."""
    sound_path = config["custom_sound"]

    if not sound_path:
        # Try common macOS system sounds in preference order
        candidates = [
            "/System/Library/Sounds/Glass.aiff",
            "/System/Library/Sounds/Ping.aiff",
            "/System/Library/Sounds/Pop.aiff",
            "/System/Library/Sounds/Tink.aiff",
            "/System/Library/Sounds/Blow.aiff",
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                sound_path = candidate
                break

    if not sound_path or not os.path.exists(sound_path):
        # Fallback: use osascript to trigger the system beep
        subprocess.Popen(
            ["osascript", "-e", "beep"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return

    # afplay volume is 0.0 to 1.0
    volume = config["volume"] / 100.0
    subprocess.Popen(
        ["afplay", "-v", str(volume), sound_path],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def play_linux(config):
    """Play notification sound on Linux. Tries multiple audio backends."""
    sound_path = config["custom_sound"]

    # Try paplay (PulseAudio/PipeWire) with a freedesktop sound
    if not sound_path:
        # Try freedesktop theme sounds
        candidates = [
            "/usr/share/sounds/freedesktop/stereo/message-new-instant.oga",
            "/usr/share/sounds/freedesktop/stereo/complete.oga",
            "/usr/share/sounds/freedesktop/stereo/bell.oga",
            "/usr/share/sounds/gnome/default/alerts/glass.ogg",
            "/usr/share/sounds/ubuntu/stereo/message-new-instant.ogg",
            "/usr/share/sounds/sound-icons/xylofon.wav",
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                sound_path = candidate
                break

    if sound_path and os.path.exists(sound_path):
        # Try paplay (PulseAudio/PipeWire) first
        for player in ["paplay", "aplay", "pw-play"]:
            try:
                subprocess.Popen(
                    [player, sound_path],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                return
            except FileNotFoundError:
                continue

    # Fallback: canberra-gtk-play (GNOME/GTK desktops)
    try:
        subprocess.Popen(
            ["canberra-gtk-play", "-i", "message-new-instant"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return
    except FileNotFoundError:
        pass

    # Last resort: terminal bell
    sys.stderr.write("\a")
    sys.stderr.flush()


def play_windows(config):
    """Play notification sound on Windows using PowerShell."""
    sound_path = config["custom_sound"]

    if sound_path and os.path.isfile(sound_path):
        # Pass path via environment variable to avoid command injection.
        # Never interpolate user-controlled strings into PowerShell commands.
        env = os.environ.copy()
        env["_CLAUDE_SOUND_PATH"] = sound_path
        ps_cmd = (
            "(New-Object Media.SoundPlayer $env:_CLAUDE_SOUND_PATH).PlaySync()"
        )
    else:
        env = None
        ps_cmd = "[System.Media.SystemSounds]::Exclamation.Play()"

    try:
        subprocess.Popen(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        # Fallback: terminal bell
        sys.stderr.write("\a")
        sys.stderr.flush()


def play_sound(config):
    """Dispatch to the platform-specific player."""
    system = platform.system()
    if system == "Darwin":
        play_macos(config)
    elif system == "Linux":
        play_linux(config)
    elif system == "Windows":
        play_windows(config)
    else:
        # Unknown platform — terminal bell
        sys.stderr.write("\a")
        sys.stderr.flush()


def main():
    config = get_config()

    if not config["enabled"]:
        sys.exit(0)

    # Read hook input from stdin (required by hook protocol)
    try:
        sys.stdin.read()
    except Exception:
        pass

    play_sound(config)

    # Exit 0 — allow the notification/stop to proceed normally
    sys.exit(0)


if __name__ == "__main__":
    main()
