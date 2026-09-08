"""Tests for voice_to_claude.recorder module."""

from pathlib import Path
from unittest.mock import patch, MagicMock

import numpy as np
import pytest

from voice_to_claude.recorder import AudioRecorder, MicrophoneError, RecordingError
from voice_to_claude.config import SAMPLE_RATE


class TestAudioRecorderDuration:
    """Test AudioRecorder.get_duration."""

    def test_one_second(self):
        recorder = AudioRecorder(sample_rate=SAMPLE_RATE)
        audio = np.zeros(SAMPLE_RATE, dtype=np.float32)
        assert recorder.get_duration(audio) == pytest.approx(1.0)

    def test_half_second(self):
        recorder = AudioRecorder(sample_rate=SAMPLE_RATE)
        audio = np.zeros(SAMPLE_RATE // 2, dtype=np.float32)
        assert recorder.get_duration(audio) == pytest.approx(0.5)

    def test_zero_length(self):
        recorder = AudioRecorder(sample_rate=SAMPLE_RATE)
        audio = np.zeros(0, dtype=np.float32)
        assert recorder.get_duration(audio) == pytest.approx(0.0)


class TestAudioRecorderSaveToWav:
    """Test AudioRecorder.save_to_wav."""

    def test_creates_file(self, tmp_path):
        recorder = AudioRecorder(sample_rate=SAMPLE_RATE)
        audio = np.random.randn(SAMPLE_RATE).astype(np.float32) * 0.5
        out_path = tmp_path / "test.wav"

        result = recorder.save_to_wav(audio, path=out_path)
        assert result == out_path
        assert out_path.exists()
        assert out_path.stat().st_size > 0

    def test_creates_temp_file(self):
        recorder = AudioRecorder(sample_rate=SAMPLE_RATE)
        audio = np.random.randn(SAMPLE_RATE).astype(np.float32) * 0.5

        result = recorder.save_to_wav(audio)
        assert result.exists()
        assert result.suffix == ".wav"
        # Clean up
        result.unlink()


class TestAudioRecorderStartStop:
    """Test AudioRecorder start/stop flow."""

    def test_stop_without_start_returns_none(self):
        recorder = AudioRecorder()
        assert recorder.stop() is None

    @patch("voice_to_claude.recorder.sd")
    def test_start_sets_recording_flag(self, mock_sd):
        mock_stream = MagicMock()
        mock_sd.InputStream.return_value = mock_stream

        recorder = AudioRecorder()
        result = recorder.start()

        assert result is True
        assert recorder.is_recording is True
        mock_stream.start.assert_called_once()

    @patch("voice_to_claude.recorder.sd")
    def test_start_while_already_recording(self, mock_sd):
        recorder = AudioRecorder()
        recorder.is_recording = True
        result = recorder.start()
        assert result is False


class TestAudioRecorderCheckMicrophone:
    """Test AudioRecorder.check_microphone."""

    @patch("voice_to_claude.recorder.sd")
    def test_microphone_available(self, mock_sd):
        mock_sd.query_devices.return_value = [{"name": "mic"}]
        mock_sd.query_devices.side_effect = None
        assert AudioRecorder.check_microphone() is True

    @patch("voice_to_claude.recorder.sd")
    def test_microphone_unavailable(self, mock_sd):
        mock_sd.query_devices.side_effect = Exception("No devices")
        assert AudioRecorder.check_microphone() is False


class TestExceptions:
    """Test custom exception classes."""

    def test_microphone_error_is_recording_error(self):
        assert issubclass(MicrophoneError, RecordingError)

    def test_recording_error_is_exception(self):
        assert issubclass(RecordingError, Exception)
