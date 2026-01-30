"""Debug logging for verify-claims plugin."""

import sys
from datetime import datetime
from pathlib import Path


class Logger:
    """Simple logger that writes to stderr and optionally to a file."""

    LOG_DIR = Path.home() / ".claude" / "logs"
    LOG_FILE = "verify_claims.log"

    def __init__(self, debug: bool = False, log_to_file: bool = True):
        self.debug_enabled = debug
        self.log_to_file = log_to_file
        self._log_file_handle = None

    def _get_timestamp(self) -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _write(self, level: str, message: str) -> None:
        """Write log message to stderr and optionally to file."""
        formatted = f"[{self._get_timestamp()}] [{level}] {message}"

        # Always write errors to stderr
        if level == "ERROR":
            print(formatted, file=sys.stderr)
        elif self.debug_enabled:
            print(formatted, file=sys.stderr)

        # Write to log file if enabled
        if self.log_to_file:
            try:
                self.LOG_DIR.mkdir(parents=True, exist_ok=True)
                log_path = self.LOG_DIR / self.LOG_FILE
                with open(log_path, 'a') as f:
                    f.write(formatted + "\n")
            except OSError:
                pass

    def debug(self, message: str) -> None:
        """Log debug message (only if debug is enabled)."""
        if self.debug_enabled:
            self._write("DEBUG", message)

    def info(self, message: str) -> None:
        """Log info message."""
        self._write("INFO", message)

    def warning(self, message: str) -> None:
        """Log warning message."""
        self._write("WARN", message)

    def error(self, message: str) -> None:
        """Log error message."""
        self._write("ERROR", message)


# Global logger instance
_logger: Logger | None = None


def get_logger(debug: bool = False) -> Logger:
    """Get or create the global logger instance."""
    global _logger
    if _logger is None:
        _logger = Logger(debug=debug)
    elif debug and not _logger.debug_enabled:
        _logger.debug_enabled = True
    return _logger
