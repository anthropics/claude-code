#!/usr/bin/env python3
from dataclasses import dataclass
import json
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

CONFIG_PATH = Path.home() / ".claude" / "audio_notifications.json"


def detect_default_command() -> Optional[str]:
    for cmd in ["say", "spd-say", "espeak"]:
        if shutil.which(cmd):
            return cmd
    return None


@dataclass
class UserConfig:
    audio_off: Optional[bool] = None
    speech_command: Optional[str] = None


def get_user_config() -> UserConfig:
    config = UserConfig()
    # attempt to load user config, return defaults if fail
    try:
        user_raw_config_json = json.loads(CONFIG_PATH.read_text())
    except Exception:
        return config

    if not isinstance(user_raw_config_json, dict):
        return config

    user_config_val_audio_off = user_raw_config_json.get("audio_off")
    if isinstance(user_config_val_audio_off, bool):
        config.audio_off = user_config_val_audio_off

    user_config_val_speech = user_raw_config_json.get("speech_command")
    if isinstance(user_config_val_speech, str):
        config.speech_command = user_config_val_speech.strip()

    return config


def main():
    user_config = get_user_config()
    if user_config.audio_off is True:
        sys.exit(0)

    try:
        hook_data = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(2)
    if not isinstance(hook_data, dict):
        sys.exit(2)

    # only trigger audio if hook is a notification
    if hook_data.get("hook_event_name") != "Notification":
        sys.exit(0)

    message = hook_data.get("message", None)
    if not isinstance(message, str):
        sys.exit(2)
    message = message.strip()

    # attempt command set by user if available, else default options
    speech_command = user_config.speech_command or detect_default_command()
    if speech_command is None:
        sys.exit(2)
    # if user provided command with flags etc, we break it up into a list
    speech_command = shlex.split(speech_command)

    try:
        subprocess.run(speech_command + [message], check=True, timeout=10)
    except Exception:
        sys.exit(2)


if __name__ == "__main__":
    main()
