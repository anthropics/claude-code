"""Background daemon for voice dictation hotkey listening."""

import os
import sys
import signal
import threading
import time
import logging
import subprocess
from pathlib import Path
from typing import Set, Optional

from pynput import keyboard

from .config import Config, DEFAULT_PID_FILE, DEFAULT_LOG_FILE, ensure_config_dir, get_plugin_root
from .recorder import AudioRecorder, MicrophoneError
from .transcriber import Transcriber
from .keyboard import TextInjector
from . import sounds

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class VoiceDaemon:
    """Background daemon that listens for hotkeys and handles voice transcription."""

    def __init__(self, config: Config, quiet: bool = False):
        self.config = config
        self.quiet = quiet

        # Components
        self.recorder = AudioRecorder(max_seconds=config.max_recording_seconds)
        self.transcriber = Transcriber(config)
        self.injector = TextInjector(mode=config.output_mode)

        # State
        self.is_recording = False
        self.pressed_keys: Set[keyboard.Key] = set()
        self.keyboard_listener: Optional[keyboard.Listener] = None
        self.running = False

        # Build required keys set based on config
        self.required_keys = self._build_required_keys()

    def _build_required_keys(self) -> Set[keyboard.Key]:
        """Build set of required modifier keys from config."""
        keys = set()
        if self.config.hotkey_ctrl:
            keys.add(keyboard.Key.ctrl_l)
        if self.config.hotkey_alt:
            keys.add(keyboard.Key.alt_l)
        if self.config.hotkey_shift:
            keys.add(keyboard.Key.shift_l)
        if self.config.hotkey_cmd:
            keys.add(keyboard.Key.cmd_l)
        return keys

    def _log(self, message: str) -> None:
        """Log message unless in quiet mode."""
        if not self.quiet:
            logger.info(message)

    def _on_press(self, key: keyboard.Key) -> None:
        """Handle key press."""
        if key in self.required_keys:
            self.pressed_keys.add(key)

            # Start recording when all required keys are pressed
            if self.pressed_keys == self.required_keys and not self.is_recording:
                self._start_recording()

    def _on_release(self, key: keyboard.Key) -> None:
        """Handle key release."""
        if key in self.required_keys:
            self.pressed_keys.discard(key)

            # Stop recording when any required key is released
            if self.is_recording:
                self._stop_recording()

    def _start_recording(self) -> None:
        """Start recording audio."""
        self.is_recording = True
        self._log("Recording started...")

        if self.config.sound_effects:
            threading.Thread(target=sounds.play_start_sound, daemon=True).start()

        try:
            self.recorder.start()
        except MicrophoneError as e:
            self._log(f"Microphone error: {e}")
            if self.config.sound_effects:
                threading.Thread(target=sounds.play_error_sound, daemon=True).start()
            self.is_recording = False

    def _stop_recording(self) -> None:
        """Stop recording and process audio."""
        if not self.is_recording:
            return

        self.is_recording = False
        self._log("Recording stopped, processing...")

        if self.config.sound_effects:
            threading.Thread(target=sounds.play_stop_sound, daemon=True).start()

        # Stop recording and get audio
        audio = self.recorder.stop()

        # Process in background thread
        threading.Thread(
            target=self._process_audio,
            args=(audio,),
            daemon=True
        ).start()

    def _process_audio(self, audio) -> None:
        """Process recorded audio (runs in background thread)."""
        if audio is None:
            self._log("No audio recorded")
            return

        duration = self.recorder.get_duration(audio)
        if duration < 0.3:
            self._log("Recording too short, ignoring")
            return

        self._log(f"Audio duration: {duration:.1f}s")

        # Save to temp file
        try:
            wav_path = self.recorder.save_to_wav(audio)
            self._log(f"Saved to: {wav_path}")

            # Transcribe
            result = self.transcriber.transcribe(wav_path)

            # Clean up temp file
            wav_path.unlink(missing_ok=True)

            if result.success:
                self._log(f"Transcribed ({result.duration_seconds:.1f}s): {result.text[:50]}...")

                # Inject text
                if self.injector.inject(result.text):
                    self._log("Text injected successfully")
                    if self.config.sound_effects:
                        threading.Thread(target=sounds.play_success_sound, daemon=True).start()
                else:
                    self._log("Failed to inject text, copied to clipboard")
                    TextInjector.copy_to_clipboard(result.text)
            else:
                self._log(f"Transcription failed: {result.error}")
                if self.config.sound_effects:
                    threading.Thread(target=sounds.play_error_sound, daemon=True).start()

        except Exception as e:
            self._log(f"Error processing audio: {e}")
            if self.config.sound_effects:
                threading.Thread(target=sounds.play_error_sound, daemon=True).start()

    def start(self) -> None:
        """Start the daemon."""
        if not self.config.setup_complete:
            print("Setup not complete. Run /voice-to-claude:setup first.")
            sys.exit(1)

        self.running = True

        # Set up signal handlers
        signal.signal(signal.SIGTERM, self._handle_signal)
        signal.signal(signal.SIGINT, self._handle_signal)

        # Start keyboard listener
        self.keyboard_listener = keyboard.Listener(
            on_press=self._on_press,
            on_release=self._on_release
        )
        self.keyboard_listener.start()

        if not self.quiet:
            print("=" * 50)
            print("Voice-to-Claude Daemon")
            print("=" * 50)
            print(f"Hotkey: {self.config.get_hotkey_description()}")
            print(f"Model: {self.config.model}")
            print(f"Output: {self.config.output_mode}")
            print("=" * 50)
            print("\nReady! Hold hotkey and speak.\n")

        # Keep running
        try:
            while self.running:
                time.sleep(0.1)
        except KeyboardInterrupt:
            pass

        self.stop()

    def stop(self) -> None:
        """Stop the daemon."""
        self.running = False

        if self.keyboard_listener:
            self.keyboard_listener.stop()
            self.keyboard_listener = None

        self._log("Daemon stopped")

    def _handle_signal(self, signum, frame) -> None:
        """Handle shutdown signals."""
        self._log(f"Received signal {signum}, shutting down...")
        self.running = False


def write_pid_file() -> None:
    """Write PID to file."""
    ensure_config_dir()
    DEFAULT_PID_FILE.write_text(str(os.getpid()))


def remove_pid_file() -> None:
    """Remove PID file."""
    DEFAULT_PID_FILE.unlink(missing_ok=True)


def read_pid_file() -> Optional[int]:
    """Read PID from file."""
    if DEFAULT_PID_FILE.exists():
        try:
            return int(DEFAULT_PID_FILE.read_text().strip())
        except (ValueError, FileNotFoundError):
            pass
    return None


def is_daemon_running() -> bool:
    """Check if daemon is running."""
    pid = read_pid_file()
    if pid is None:
        return False

    try:
        # Check if process exists
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        # Process doesn't exist, clean up stale PID file
        remove_pid_file()
        return False


def start_daemon(background: bool = False, quiet: bool = False) -> None:
    """Start the daemon."""
    if is_daemon_running():
        print("Daemon is already running.")
        return

    config = Config.load()

    if background:
        # Avoid os.fork on macOS due to CoreFoundation issues in child process.
        # Spawn a new process instead.
        ensure_config_dir()
        log_file = open(DEFAULT_LOG_FILE, "a")
        plugin_root = get_plugin_root()
        exec_path = plugin_root / "scripts" / "exec.py"
        cmd = [sys.executable, str(exec_path), "daemon", "run"]
        if quiet:
            cmd.append("--quiet")

        process = subprocess.Popen(
            cmd,
            stdout=log_file,
            stderr=log_file,
            start_new_session=True,
        )
        print(f"Daemon started in background (PID: {process.pid})")
        return

    write_pid_file()

    try:
        daemon = VoiceDaemon(config, quiet=quiet)
        daemon.start()
    finally:
        remove_pid_file()


def stop_daemon() -> None:
    """Stop the daemon."""
    pid = read_pid_file()
    if pid is None:
        print("Daemon is not running.")
        return

    try:
        os.kill(pid, signal.SIGTERM)
        print("Daemon stopped.")
        remove_pid_file()
    except ProcessLookupError:
        print("Daemon was not running (stale PID file removed).")
        remove_pid_file()


def daemon_status() -> dict:
    """Get daemon status."""
    running = is_daemon_running()
    pid = read_pid_file() if running else None
    config = Config.load()

    return {
        "running": running,
        "pid": pid,
        "setup_complete": config.setup_complete,
        "model": config.model,
        "hotkey": config.get_hotkey_description(),
        "output_mode": config.output_mode
    }


def main():
    """CLI entry point for daemon."""
    import argparse

    parser = argparse.ArgumentParser(description="Voice-to-Claude daemon")
    parser.add_argument("action", choices=["start", "stop", "status", "restart"],
                       help="Action to perform")
    parser.add_argument("--background", "-b", action="store_true",
                       help="Run in background")
    parser.add_argument("--quiet", "-q", action="store_true",
                       help="Suppress output")

    args = parser.parse_args()

    if args.action == "start":
        start_daemon(background=args.background, quiet=args.quiet)
    elif args.action == "stop":
        stop_daemon()
    elif args.action == "restart":
        stop_daemon()
        time.sleep(0.5)
        start_daemon(background=args.background, quiet=args.quiet)
    elif args.action == "status":
        status = daemon_status()
        if status["running"]:
            print(f"Daemon is running (PID: {status['pid']})")
            print(f"  Model: {status['model']}")
            print(f"  Hotkey: {status['hotkey']}")
            print(f"  Output: {status['output_mode']}")
        else:
            print("Daemon is not running.")
            if not status["setup_complete"]:
                print("  Setup not complete. Run /voice-to-claude:setup first.")


if __name__ == "__main__":
    main()
