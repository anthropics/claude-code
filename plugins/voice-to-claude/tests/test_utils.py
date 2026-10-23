"""Tests for voice_to_claude.utils module."""

from unittest.mock import patch

import pytest

from voice_to_claude.utils import (
    find_clipboard_command,
    find_sound_player,
    IS_MACOS,
    IS_LINUX,
)


class TestFindClipboardCommand:
    """Test find_clipboard_command across platforms."""

    @patch("voice_to_claude.utils.IS_MACOS", True)
    @patch("voice_to_claude.utils.IS_LINUX", False)
    @patch("shutil.which", return_value="/usr/bin/pbcopy")
    def test_macos_pbcopy(self, mock_which):
        result = find_clipboard_command()
        assert result == ["pbcopy"]

    @patch("voice_to_claude.utils.IS_MACOS", False)
    @patch("voice_to_claude.utils.IS_LINUX", True)
    @patch("shutil.which")
    def test_linux_xclip(self, mock_which):
        mock_which.side_effect = lambda cmd: "/usr/bin/xclip" if cmd == "xclip" else None
        result = find_clipboard_command()
        assert result == ["xclip", "-selection", "clipboard"]

    @patch("voice_to_claude.utils.IS_MACOS", False)
    @patch("voice_to_claude.utils.IS_LINUX", True)
    @patch("shutil.which")
    def test_linux_xsel_fallback(self, mock_which):
        mock_which.side_effect = lambda cmd: "/usr/bin/xsel" if cmd == "xsel" else None
        result = find_clipboard_command()
        assert result == ["xsel", "--clipboard", "--input"]

    @patch("voice_to_claude.utils.IS_MACOS", False)
    @patch("voice_to_claude.utils.IS_LINUX", True)
    @patch("shutil.which")
    def test_linux_wl_copy_fallback(self, mock_which):
        mock_which.side_effect = lambda cmd: "/usr/bin/wl-copy" if cmd == "wl-copy" else None
        result = find_clipboard_command()
        assert result == ["wl-copy"]

    @patch("voice_to_claude.utils.IS_MACOS", False)
    @patch("voice_to_claude.utils.IS_LINUX", True)
    @patch("shutil.which", return_value=None)
    def test_linux_no_clipboard(self, mock_which):
        result = find_clipboard_command()
        assert result is None


class TestFindSoundPlayer:
    """Test find_sound_player across platforms."""

    @patch("voice_to_claude.utils.IS_MACOS", True)
    @patch("voice_to_claude.utils.IS_LINUX", False)
    def test_macos_afplay(self):
        assert find_sound_player() == "afplay"

    @patch("voice_to_claude.utils.IS_MACOS", False)
    @patch("voice_to_claude.utils.IS_LINUX", True)
    @patch("shutil.which")
    def test_linux_paplay(self, mock_which):
        mock_which.side_effect = lambda cmd: "/usr/bin/paplay" if cmd == "paplay" else None
        assert find_sound_player() == "paplay"

    @patch("voice_to_claude.utils.IS_MACOS", False)
    @patch("voice_to_claude.utils.IS_LINUX", True)
    @patch("shutil.which", return_value=None)
    def test_linux_no_player(self, mock_which):
        assert find_sound_player() is None
