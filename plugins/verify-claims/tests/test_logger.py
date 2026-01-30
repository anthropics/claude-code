"""Tests for utils/logger.py"""

from pathlib import Path
from unittest.mock import patch

import utils.logger as logger_module
from utils.logger import Logger, get_logger


class TestLogger:
    """Tests for the Logger class."""

    def setup_method(self):
        """Reset global logger state before each test."""
        logger_module._logger = None

    def test_init_default_values(self):
        """Test Logger initialization with default values."""
        log = Logger()
        assert log.debug_enabled is False
        assert log.log_to_file is True

    def test_init_custom_values(self):
        """Test Logger initialization with custom values."""
        log = Logger(debug=True, log_to_file=False)
        assert log.debug_enabled is True
        assert log.log_to_file is False

    def test_get_timestamp_format(self):
        """Test that timestamp has expected format."""
        log = Logger()
        timestamp = log._get_timestamp()
        # Should be in format YYYY-MM-DD HH:MM:SS
        assert len(timestamp) == 19
        assert timestamp[4] == '-'
        assert timestamp[7] == '-'
        assert timestamp[10] == ' '
        assert timestamp[13] == ':'
        assert timestamp[16] == ':'

    def test_debug_message_when_disabled(self, capsys):
        """Test that debug messages are not printed when debug is disabled."""
        log = Logger(debug=False, log_to_file=False)
        log.debug("test message")
        captured = capsys.readouterr()
        assert captured.err == ""
        assert captured.out == ""

    def test_debug_message_when_enabled(self, capsys):
        """Test that debug messages are printed when debug is enabled."""
        log = Logger(debug=True, log_to_file=False)
        log.debug("test debug message")
        captured = capsys.readouterr()
        assert "[DEBUG]" in captured.err
        assert "test debug message" in captured.err

    def test_info_message_when_debug_disabled(self, capsys):
        """Test that info messages are not printed when debug is disabled."""
        log = Logger(debug=False, log_to_file=False)
        log.info("test info message")
        captured = capsys.readouterr()
        # Info messages should not be printed to stderr when debug is off
        assert captured.err == ""

    def test_info_message_when_debug_enabled(self, capsys):
        """Test that info messages are printed when debug is enabled."""
        log = Logger(debug=True, log_to_file=False)
        log.info("test info message")
        captured = capsys.readouterr()
        assert "[INFO]" in captured.err
        assert "test info message" in captured.err

    def test_warning_message_when_debug_disabled(self, capsys):
        """Test that warning messages are not printed when debug is disabled."""
        log = Logger(debug=False, log_to_file=False)
        log.warning("test warning message")
        captured = capsys.readouterr()
        # Warning messages should not be printed to stderr when debug is off
        assert captured.err == ""

    def test_warning_message_when_debug_enabled(self, capsys):
        """Test that warning messages are printed when debug is enabled."""
        log = Logger(debug=True, log_to_file=False)
        log.warning("test warning message")
        captured = capsys.readouterr()
        assert "[WARN]" in captured.err
        assert "test warning message" in captured.err

    def test_error_message_always_printed(self, capsys):
        """Test that error messages are always printed regardless of debug setting."""
        log = Logger(debug=False, log_to_file=False)
        log.error("test error message")
        captured = capsys.readouterr()
        assert "[ERROR]" in captured.err
        assert "test error message" in captured.err

    def test_error_message_with_debug_enabled(self, capsys):
        """Test error messages with debug enabled."""
        log = Logger(debug=True, log_to_file=False)
        log.error("test error message")
        captured = capsys.readouterr()
        assert "[ERROR]" in captured.err
        assert "test error message" in captured.err

    def test_write_to_file(self, temp_dir):
        """Test that messages are written to log file."""
        log_dir = Path(temp_dir) / "logs"
        log_file = "test.log"

        with patch.object(Logger, 'LOG_DIR', log_dir):
            with patch.object(Logger, 'LOG_FILE', log_file):
                log = Logger(debug=True, log_to_file=True)
                log.info("file test message")

                log_path = log_dir / log_file
                assert log_path.exists()
                content = log_path.read_text()
                assert "[INFO]" in content
                assert "file test message" in content

    def test_write_to_file_creates_directory(self, temp_dir):
        """Test that log directory is created if it doesn't exist."""
        log_dir = Path(temp_dir) / "nested" / "logs"
        log_file = "test.log"

        with patch.object(Logger, 'LOG_DIR', log_dir):
            with patch.object(Logger, 'LOG_FILE', log_file):
                log = Logger(debug=True, log_to_file=True)
                log.info("create dir test")

                assert log_dir.exists()

    def test_write_to_file_handles_os_error(self, capsys):
        """Test that OSError when writing to file is handled gracefully."""
        log = Logger(debug=True, log_to_file=True)

        with patch.object(Logger, 'LOG_DIR', Path("/nonexistent/readonly/path")):
            # This should not raise an exception
            log.info("should not fail")
            captured = capsys.readouterr()
            assert "[INFO]" in captured.err

    def test_log_to_file_disabled(self, temp_dir):
        """Test that messages are not written to file when disabled."""
        log_dir = Path(temp_dir) / "logs"
        log_file = "test.log"

        with patch.object(Logger, 'LOG_DIR', log_dir):
            with patch.object(Logger, 'LOG_FILE', log_file):
                log = Logger(debug=True, log_to_file=False)
                log.info("should not be in file")

                log_path = log_dir / log_file
                assert not log_path.exists()


class TestGetLogger:
    """Tests for the get_logger function."""

    def setup_method(self):
        """Reset global logger state before each test."""
        logger_module._logger = None

    def test_get_logger_creates_new_instance(self):
        """Test that get_logger creates a new logger if none exists."""
        log = get_logger()
        assert log is not None
        assert isinstance(log, Logger)

    def test_get_logger_returns_same_instance(self):
        """Test that get_logger returns the same instance on subsequent calls."""
        log1 = get_logger()
        log2 = get_logger()
        assert log1 is log2

    def test_get_logger_with_debug_false(self):
        """Test get_logger with debug=False."""
        log = get_logger(debug=False)
        assert log.debug_enabled is False

    def test_get_logger_with_debug_true(self):
        """Test get_logger with debug=True."""
        log = get_logger(debug=True)
        assert log.debug_enabled is True

    def test_get_logger_upgrades_debug_setting(self):
        """Test that calling get_logger with debug=True enables debug on existing logger."""
        log1 = get_logger(debug=False)
        assert log1.debug_enabled is False

        log2 = get_logger(debug=True)
        assert log2 is log1
        assert log1.debug_enabled is True

    def test_get_logger_does_not_downgrade_debug(self):
        """Test that calling get_logger with debug=False doesn't disable debug."""
        log1 = get_logger(debug=True)
        assert log1.debug_enabled is True

        log2 = get_logger(debug=False)
        assert log2 is log1
        # Debug should remain True
        assert log1.debug_enabled is True


class TestLoggerIntegration:
    """Integration tests for logger functionality."""

    def setup_method(self):
        """Reset global logger state before each test."""
        logger_module._logger = None

    def test_all_log_levels(self, capsys, temp_dir):
        """Test all log levels in sequence."""
        log_dir = Path(temp_dir) / "logs"

        with patch.object(Logger, 'LOG_DIR', log_dir):
            log = Logger(debug=True, log_to_file=True)

            log.debug("debug msg")
            log.info("info msg")
            log.warning("warning msg")
            log.error("error msg")

            captured = capsys.readouterr()
            assert "[DEBUG]" in captured.err
            assert "[INFO]" in captured.err
            assert "[WARN]" in captured.err
            assert "[ERROR]" in captured.err

            # Check file content
            log_path = log_dir / Logger.LOG_FILE
            content = log_path.read_text()
            assert "debug msg" in content
            assert "info msg" in content
            assert "warning msg" in content
            assert "error msg" in content

    def test_log_message_format(self, capsys):
        """Test that log messages have the correct format."""
        log = Logger(debug=True, log_to_file=False)
        log.info("format test")

        captured = capsys.readouterr()
        # Format: [YYYY-MM-DD HH:MM:SS] [LEVEL] message
        assert captured.err.startswith('[')
        assert '] [INFO] format test' in captured.err
