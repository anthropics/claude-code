"""Tests for voice_to_claude.daemon module."""

import os
import signal
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from voice_to_claude.daemon import (
    write_pid_file,
    remove_pid_file,
    read_pid_file,
    is_daemon_running,
    daemon_status,
)


class TestPidFile:
    """Test PID file operations."""

    def test_write_and_read(self, tmp_config_dir):
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]), \
             patch("voice_to_claude.daemon.ensure_config_dir"):
            write_pid_file()
            pid = read_pid_file()
            assert pid == os.getpid()

    def test_read_missing_file(self, tmp_config_dir):
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]):
            assert read_pid_file() is None

    def test_read_corrupt_file(self, tmp_config_dir):
        tmp_config_dir["pid_file"].write_text("not-a-number")
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]):
            assert read_pid_file() is None

    def test_remove(self, tmp_config_dir):
        tmp_config_dir["pid_file"].write_text("12345")
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]):
            remove_pid_file()
            assert not tmp_config_dir["pid_file"].exists()

    def test_remove_missing_file(self, tmp_config_dir):
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]):
            # Should not raise
            remove_pid_file()


class TestIsDaemonRunning:
    """Test is_daemon_running function."""

    def test_no_pid_file(self, tmp_config_dir):
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]):
            assert is_daemon_running() is False

    def test_running_process(self, tmp_config_dir):
        # Use our own PID (guaranteed to exist)
        tmp_config_dir["pid_file"].write_text(str(os.getpid()))
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]):
            assert is_daemon_running() is True

    def test_stale_pid_file(self, tmp_config_dir):
        # Use a PID that almost certainly doesn't exist
        tmp_config_dir["pid_file"].write_text("999999999")
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]):
            assert is_daemon_running() is False
            # Should clean up stale PID file
            assert not tmp_config_dir["pid_file"].exists()


class TestDaemonStatus:
    """Test daemon_status function."""

    def test_status_when_stopped(self, tmp_config_dir):
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]), \
             patch("voice_to_claude.config.DEFAULT_CONFIG_FILE", tmp_config_dir["file"]):
            status = daemon_status()

            assert status["running"] is False
            assert status["pid"] is None
            assert status["setup_complete"] is False
            assert status["model"] == "base"
            assert status["hotkey"] == "Ctrl+Alt"
            assert status["output_mode"] == "keyboard"

    def test_status_when_running(self, tmp_config_dir):
        tmp_config_dir["pid_file"].write_text(str(os.getpid()))
        with patch("voice_to_claude.daemon.DEFAULT_PID_FILE", tmp_config_dir["pid_file"]), \
             patch("voice_to_claude.config.DEFAULT_CONFIG_FILE", tmp_config_dir["file"]):
            status = daemon_status()

            assert status["running"] is True
            assert status["pid"] == os.getpid()
