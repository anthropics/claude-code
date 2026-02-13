"""Tests for voice_to_claude.keyboard module."""

from unittest.mock import patch, MagicMock

import pytest

from voice_to_claude.keyboard import TextInjector


class TestTextInjectorInject:
    """Test TextInjector.inject."""

    @patch("voice_to_claude.keyboard.Controller")
    def test_inject_empty_text_returns_false(self, mock_controller):
        injector = TextInjector(mode="keyboard")
        assert injector.inject("") is False

    @patch("voice_to_claude.keyboard.Controller")
    def test_inject_keyboard_mode(self, mock_controller):
        mock_instance = MagicMock()
        mock_controller.return_value = mock_instance

        injector = TextInjector(mode="keyboard")
        result = injector.inject("hello")

        assert result is True
        mock_instance.type.assert_called_once_with("hello")

    @patch("voice_to_claude.keyboard.Controller")
    @patch("voice_to_claude.keyboard.find_clipboard_command", return_value=["pbcopy"])
    @patch("subprocess.Popen")
    def test_inject_clipboard_mode(self, mock_popen, mock_find_clip, mock_controller):
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_popen.return_value = mock_process

        injector = TextInjector(mode="clipboard")
        result = injector.inject("hello")

        assert result is True
        mock_popen.assert_called_once()
        mock_process.communicate.assert_called_once_with(b"hello")


class TestTextInjectorClipboardFallback:
    """Test clipboard fallback behavior."""

    @patch("voice_to_claude.keyboard.Controller")
    @patch("voice_to_claude.keyboard.find_clipboard_command", return_value=["pbcopy"])
    @patch("subprocess.Popen")
    def test_keyboard_failure_falls_back_to_clipboard(self, mock_popen, mock_find_clip, mock_controller):
        mock_instance = MagicMock()
        mock_instance.type.side_effect = Exception("keyboard unavailable")
        mock_controller.return_value = mock_instance

        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_popen.return_value = mock_process

        injector = TextInjector(mode="keyboard")
        result = injector.inject("hello")

        assert result is True
        mock_popen.assert_called_once()


class TestTextInjectorCopyToClipboard:
    """Test TextInjector.copy_to_clipboard static method."""

    @patch("voice_to_claude.keyboard.find_clipboard_command", return_value=["pbcopy"])
    @patch("subprocess.Popen")
    def test_copy_success(self, mock_popen, mock_find_clip):
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_popen.return_value = mock_process

        assert TextInjector.copy_to_clipboard("test") is True
        mock_process.communicate.assert_called_once_with(b"test")

    @patch("voice_to_claude.keyboard.find_clipboard_command", return_value=None)
    def test_copy_no_clipboard_command(self, mock_find_clip):
        assert TextInjector.copy_to_clipboard("test") is False

    @patch("voice_to_claude.keyboard.find_clipboard_command", return_value=["pbcopy"])
    @patch("subprocess.Popen", side_effect=Exception("fail"))
    def test_copy_exception(self, mock_popen, mock_find_clip):
        assert TextInjector.copy_to_clipboard("test") is False


class TestClipboardNoCommand:
    """Test behavior when no clipboard command is available."""

    @patch("voice_to_claude.keyboard.Controller")
    @patch("voice_to_claude.keyboard.find_clipboard_command", return_value=None)
    def test_inject_clipboard_no_command(self, mock_find_clip, mock_controller):
        injector = TextInjector(mode="clipboard")
        result = injector.inject("hello")
        assert result is False
