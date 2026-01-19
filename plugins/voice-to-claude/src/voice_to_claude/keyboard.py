"""Text injection functionality for Claude Code."""

import subprocess
import time
from typing import Optional

from pynput.keyboard import Controller, Key


class TextInjector:
    """Injects text into Claude Code's input."""

    def __init__(self, mode: str = "keyboard"):
        """
        Initialize text injector.

        Args:
            mode: "keyboard" for typing simulation, "clipboard" for paste
        """
        self.mode = mode
        self.keyboard = Controller()

    def inject(self, text: str) -> bool:
        """
        Inject text into the active input.

        Args:
            text: Text to inject

        Returns:
            True if successful
        """
        if not text:
            return False

        if self.mode == "keyboard":
            return self._inject_keyboard(text)
        else:
            return self._inject_clipboard(text)

    def _inject_keyboard(self, text: str) -> bool:
        """Type text character by character."""
        try:
            # Small delay to ensure focus
            time.sleep(0.05)

            # Type the text
            self.keyboard.type(text)
            return True
        except Exception as e:
            # Fall back to clipboard
            print(f"Keyboard typing failed, falling back to clipboard: {e}")
            return self._inject_clipboard(text)

    def _inject_clipboard(self, text: str) -> bool:
        """Copy text to clipboard and paste."""
        try:
            # Copy to clipboard using pbcopy
            process = subprocess.Popen(
                ['pbcopy'],
                stdin=subprocess.PIPE,
                env={'LANG': 'en_US.UTF-8'}
            )
            process.communicate(text.encode('utf-8'))

            if process.returncode != 0:
                return False

            # Small delay then paste
            time.sleep(0.05)

            # Simulate Cmd+V
            self.keyboard.press(Key.cmd)
            self.keyboard.press('v')
            self.keyboard.release('v')
            self.keyboard.release(Key.cmd)

            return True
        except Exception as e:
            print(f"Clipboard injection failed: {e}")
            return False

    @staticmethod
    def copy_to_clipboard(text: str) -> bool:
        """Just copy text to clipboard without pasting."""
        try:
            process = subprocess.Popen(
                ['pbcopy'],
                stdin=subprocess.PIPE,
                env={'LANG': 'en_US.UTF-8'}
            )
            process.communicate(text.encode('utf-8'))
            return process.returncode == 0
        except Exception:
            return False
