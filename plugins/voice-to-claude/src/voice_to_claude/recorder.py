"""Audio recording functionality."""

import tempfile
from pathlib import Path
from typing import Optional, List

import numpy as np
import sounddevice as sd
from scipy.io import wavfile

from .config import SAMPLE_RATE


class AudioRecorder:
    """Records audio from the default microphone."""

    def __init__(self, sample_rate: int = SAMPLE_RATE, max_seconds: int = 60):
        self.sample_rate = sample_rate
        self.max_seconds = max_seconds
        self.is_recording = False
        self.audio_data: List[np.ndarray] = []
        self.stream: Optional[sd.InputStream] = None

    def _audio_callback(self, indata: np.ndarray, frames: int, time_info, status) -> None:
        """Callback for audio stream."""
        if self.is_recording:
            self.audio_data.append(indata.copy())

    def start(self) -> bool:
        """Start recording audio. Returns True if successful."""
        if self.is_recording:
            return False

        self.is_recording = True
        self.audio_data = []

        try:
            self.stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype=np.float32,
                callback=self._audio_callback
            )
            self.stream.start()
            return True
        except sd.PortAudioError as e:
            self.is_recording = False
            raise MicrophoneError(
                f"Microphone error: {e}\n\n"
                "Please grant Microphone permission:\n"
                "System Settings -> Privacy & Security -> Microphone\n"
                "Enable Terminal (or the app you're running from)\n"
                "Then restart the daemon."
            )
        except Exception as e:
            self.is_recording = False
            raise RecordingError(f"Error starting recording: {e}")

    def stop(self) -> Optional[np.ndarray]:
        """Stop recording and return audio data. Returns None if no audio."""
        if not self.is_recording:
            return None

        self.is_recording = False

        # Stop and close stream
        if self.stream:
            self.stream.stop()
            self.stream.close()
            self.stream = None

        # Return concatenated audio
        if not self.audio_data:
            return None

        return np.concatenate(self.audio_data)

    def save_to_wav(self, audio: np.ndarray, path: Optional[Path] = None) -> Path:
        """Save audio data to a WAV file. Returns the path."""
        if path is None:
            # Create temp file
            fd, temp_path = tempfile.mkstemp(suffix=".wav")
            path = Path(temp_path)

        # Convert to int16 for WAV
        audio_int16 = (audio * 32767).astype(np.int16)
        wavfile.write(str(path), self.sample_rate, audio_int16)
        return path

    def get_duration(self, audio: np.ndarray) -> float:
        """Get duration of audio in seconds."""
        return len(audio) / self.sample_rate

    @staticmethod
    def check_microphone() -> bool:
        """Check if microphone is available."""
        try:
            devices = sd.query_devices()
            default_input = sd.query_devices(kind='input')
            return default_input is not None
        except Exception:
            return False


class RecordingError(Exception):
    """Error during recording."""
    pass


class MicrophoneError(RecordingError):
    """Microphone permission or hardware error."""
    pass
