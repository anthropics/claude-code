"""Whisper.cpp transcription functionality."""

import subprocess
import time
from pathlib import Path
from typing import Optional, Tuple
from dataclasses import dataclass

from .config import Config, WHISPER_MODELS


@dataclass
class TranscriptionResult:
    """Result of a transcription."""
    text: str
    duration_seconds: float
    model: str
    success: bool
    error: Optional[str] = None


class Transcriber:
    """Transcribes audio using whisper.cpp."""

    def __init__(self, config: Config):
        self.config = config

    def transcribe(self, audio_path: Path, timeout: int = 120) -> TranscriptionResult:
        """
        Transcribe an audio file.

        Args:
            audio_path: Path to the WAV file to transcribe
            timeout: Maximum time in seconds to wait for transcription

        Returns:
            TranscriptionResult with text and metadata
        """
        whisper_cli = self.config.get_whisper_cli()
        model_path = self.config.get_model_path()

        if not whisper_cli or not whisper_cli.exists():
            return TranscriptionResult(
                text="",
                duration_seconds=0,
                model=self.config.model,
                success=False,
                error="whisper-cli not found. Run /voice-to-claude:setup first."
            )

        if not model_path or not model_path.exists():
            return TranscriptionResult(
                text="",
                duration_seconds=0,
                model=self.config.model,
                success=False,
                error=f"Model '{self.config.model}' not found at {model_path}. Run /voice-to-claude:setup first."
            )

        start_time = time.time()

        try:
            result = subprocess.run(
                [
                    str(whisper_cli),
                    "-m", str(model_path),
                    "-f", str(audio_path),
                    "--no-timestamps",
                    "-nt",
                ],
                capture_output=True,
                text=True,
                timeout=timeout
            )

            elapsed = time.time() - start_time

            if result.returncode != 0:
                return TranscriptionResult(
                    text="",
                    duration_seconds=elapsed,
                    model=self.config.model,
                    success=False,
                    error=f"Transcription failed: {result.stderr}"
                )

            # Clean up transcript (remove extra whitespace)
            transcript = " ".join(result.stdout.strip().split())

            if not transcript:
                return TranscriptionResult(
                    text="",
                    duration_seconds=elapsed,
                    model=self.config.model,
                    success=False,
                    error="No speech detected"
                )

            return TranscriptionResult(
                text=transcript,
                duration_seconds=elapsed,
                model=self.config.model,
                success=True
            )

        except subprocess.TimeoutExpired:
            return TranscriptionResult(
                text="",
                duration_seconds=timeout,
                model=self.config.model,
                success=False,
                error=f"Transcription timed out after {timeout}s"
            )
        except Exception as e:
            return TranscriptionResult(
                text="",
                duration_seconds=time.time() - start_time,
                model=self.config.model,
                success=False,
                error=f"Transcription error: {e}"
            )

    @staticmethod
    def find_whisper_cli(plugin_root: Path) -> Optional[Path]:
        """Find whisper-cli executable."""
        locations = [
            plugin_root / "whisper.cpp" / "build" / "bin" / "whisper-cli",
            Path.home() / ".local" / "share" / "voice-to-claude" / "whisper.cpp" / "build" / "bin" / "whisper-cli",
        ]

        for loc in locations:
            if loc.exists():
                return loc

        # Check if it's in PATH
        result = subprocess.run(["which", "whisper-cli"], capture_output=True, text=True)
        if result.returncode == 0:
            return Path(result.stdout.strip())

        return None

    @staticmethod
    def find_models_dir(whisper_cli: Path) -> Optional[Path]:
        """Find Whisper models directory relative to whisper-cli."""
        # Models are typically at whisper.cpp/models
        # whisper-cli is at whisper.cpp/build/bin/whisper-cli
        models_dir = whisper_cli.parent.parent.parent / "models"
        if models_dir.exists():
            return models_dir
        return None

    @staticmethod
    def get_available_models(models_dir: Path) -> list:
        """Get list of downloaded models."""
        available = []
        for model_name, model_info in WHISPER_MODELS.items():
            model_path = models_dir / model_info["file"]
            if model_path.exists():
                available.append(model_name)
        return available
