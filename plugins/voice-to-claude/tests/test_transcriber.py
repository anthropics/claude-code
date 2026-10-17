"""Tests for voice_to_claude.transcriber module."""

import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from voice_to_claude.config import Config, WHISPER_MODELS
from voice_to_claude.transcriber import Transcriber, TranscriptionResult


class TestTranscriptionResult:
    """Test TranscriptionResult dataclass."""

    def test_successful_result(self):
        result = TranscriptionResult(
            text="hello world",
            duration_seconds=1.5,
            model="base",
            success=True,
        )
        assert result.text == "hello world"
        assert result.success is True
        assert result.error is None

    def test_failed_result(self):
        result = TranscriptionResult(
            text="",
            duration_seconds=0,
            model="base",
            success=False,
            error="whisper-cli not found",
        )
        assert result.success is False
        assert result.error == "whisper-cli not found"


class TestTranscriberTranscribe:
    """Test Transcriber.transcribe method."""

    def test_missing_whisper_cli(self):
        config = Config(whisper_cpp_path=None, models_dir="/models")
        transcriber = Transcriber(config)
        result = transcriber.transcribe(Path("/tmp/audio.wav"))
        assert result.success is False
        assert "whisper-cli not found" in result.error

    def test_missing_model(self, tmp_path):
        # whisper_cli exists but model doesn't
        cli_path = tmp_path / "whisper-cli"
        cli_path.touch()
        config = Config(
            whisper_cpp_path=str(cli_path),
            models_dir=str(tmp_path / "models"),
            model="base",
        )
        transcriber = Transcriber(config)
        result = transcriber.transcribe(Path("/tmp/audio.wav"))
        assert result.success is False
        assert "not found" in result.error

    def test_successful_transcription(self, tmp_path):
        # Create fake whisper-cli and model
        cli_path = tmp_path / "whisper-cli"
        cli_path.touch()
        models_dir = tmp_path / "models"
        models_dir.mkdir()
        model_file = models_dir / "ggml-base.bin"
        model_file.touch()

        config = Config(
            whisper_cpp_path=str(cli_path),
            models_dir=str(models_dir),
            model="base",
        )
        transcriber = Transcriber(config)

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "  Hello, world!  \n"
        mock_result.stderr = ""

        with patch("subprocess.run", return_value=mock_result):
            result = transcriber.transcribe(Path("/tmp/audio.wav"))

        assert result.success is True
        assert result.text == "Hello, world!"
        assert result.model == "base"

    def test_transcription_failure(self, tmp_path):
        cli_path = tmp_path / "whisper-cli"
        cli_path.touch()
        models_dir = tmp_path / "models"
        models_dir.mkdir()
        (models_dir / "ggml-base.bin").touch()

        config = Config(
            whisper_cpp_path=str(cli_path),
            models_dir=str(models_dir),
            model="base",
        )
        transcriber = Transcriber(config)

        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "Error: invalid model"

        with patch("subprocess.run", return_value=mock_result):
            result = transcriber.transcribe(Path("/tmp/audio.wav"))

        assert result.success is False
        assert "Transcription failed" in result.error

    def test_transcription_no_speech(self, tmp_path):
        cli_path = tmp_path / "whisper-cli"
        cli_path.touch()
        models_dir = tmp_path / "models"
        models_dir.mkdir()
        (models_dir / "ggml-base.bin").touch()

        config = Config(
            whisper_cpp_path=str(cli_path),
            models_dir=str(models_dir),
            model="base",
        )
        transcriber = Transcriber(config)

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "   \n  \n"

        with patch("subprocess.run", return_value=mock_result):
            result = transcriber.transcribe(Path("/tmp/audio.wav"))

        assert result.success is False
        assert "No speech detected" in result.error

    def test_transcription_timeout(self, tmp_path):
        cli_path = tmp_path / "whisper-cli"
        cli_path.touch()
        models_dir = tmp_path / "models"
        models_dir.mkdir()
        (models_dir / "ggml-base.bin").touch()

        config = Config(
            whisper_cpp_path=str(cli_path),
            models_dir=str(models_dir),
            model="base",
        )
        transcriber = Transcriber(config)

        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="whisper", timeout=5)):
            result = transcriber.transcribe(Path("/tmp/audio.wav"), timeout=5)

        assert result.success is False
        assert "timed out" in result.error


class TestTranscriberFindWhisperCli:
    """Test Transcriber.find_whisper_cli static method."""

    def test_finds_in_plugin_root(self, tmp_path):
        cli_path = tmp_path / "whisper.cpp" / "build" / "bin" / "whisper-cli"
        cli_path.parent.mkdir(parents=True)
        cli_path.touch()

        result = Transcriber.find_whisper_cli(tmp_path)
        assert result == cli_path

    def test_finds_in_home_dir(self, tmp_path):
        home_cli = tmp_path / ".local" / "share" / "voice-to-claude" / "whisper.cpp" / "build" / "bin" / "whisper-cli"
        home_cli.parent.mkdir(parents=True)
        home_cli.touch()

        with patch("pathlib.Path.home", return_value=tmp_path):
            result = Transcriber.find_whisper_cli(tmp_path / "nonexistent")

        assert result == home_cli

    def test_finds_in_path(self, tmp_path):
        with patch("shutil.which", return_value="/usr/bin/whisper-cli"):
            result = Transcriber.find_whisper_cli(tmp_path / "nonexistent")
        assert result == Path("/usr/bin/whisper-cli")

    def test_returns_none_when_not_found(self, tmp_path):
        with patch("shutil.which", return_value=None):
            result = Transcriber.find_whisper_cli(tmp_path / "nonexistent")
        assert result is None


class TestTranscriberGetAvailableModels:
    """Test Transcriber.get_available_models."""

    def test_finds_downloaded_models(self, tmp_path):
        (tmp_path / "ggml-base.bin").touch()
        (tmp_path / "ggml-tiny.bin").touch()

        models = Transcriber.get_available_models(tmp_path)
        assert "base" in models
        assert "tiny" in models
        assert "medium" not in models

    def test_empty_dir(self, tmp_path):
        models = Transcriber.get_available_models(tmp_path)
        assert models == []
