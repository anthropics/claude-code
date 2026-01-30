"""Tests for utils/state.py"""

import json
import os
import time
from pathlib import Path

import pytest
from utils.state import SessionState, ToolUseRecord, VerificationResult


class TestSessionState:
    """Tests for the SessionState class."""

    @pytest.fixture
    def session_state(self, temp_dir, monkeypatch):
        """Create a session state with a temporary directory."""
        # Override the STATE_DIR to use temp directory
        test_state_dir = Path(temp_dir)
        monkeypatch.setattr(SessionState, 'STATE_DIR', test_state_dir)
        return SessionState("test_session_123")

    def test_create_new_state(self, session_state):
        """Test creating a new session state."""
        assert session_state.session_id == "test_session_123"
        assert session_state.verification_count == 0
        assert session_state.stop_hook_active is False

    def test_state_persists_to_file(self, session_state):
        """Test that state is persisted to file."""
        session_state.stop_hook_active = True

        # Read the state file directly
        with open(session_state.state_file) as f:
            saved_state = json.load(f)

        assert saved_state["stop_hook_active"] is True

    def test_load_existing_state(self, temp_dir, monkeypatch):
        """Test loading an existing state file."""
        test_state_dir = Path(temp_dir)
        monkeypatch.setattr(SessionState, 'STATE_DIR', test_state_dir)

        # Create state and modify it
        state1 = SessionState("existing_session")
        state1.increment_verification_count()
        state1.add_file_written("/path/to/file.py", "Write")

        # Create a new state object for the same session
        state2 = SessionState("existing_session")

        assert state2.verification_count == 1
        assert len(state2.get_files_written()) == 1

    def test_increment_verification_count(self, session_state):
        """Test incrementing verification count."""
        assert session_state.verification_count == 0

        count = session_state.increment_verification_count()
        assert count == 1
        assert session_state.verification_count == 1

        count = session_state.increment_verification_count()
        assert count == 2
        assert session_state.verification_count == 2

    def test_add_file_written(self, session_state):
        """Test adding written files."""
        session_state.add_file_written("/project/src/main.py", "Write")
        session_state.add_file_written("/project/src/utils.py", "Edit")

        files = session_state.get_files_written()
        assert len(files) == 2
        assert files[0]["path"] == "/project/src/main.py"
        assert files[0]["tool"] == "Write"
        assert files[1]["path"] == "/project/src/utils.py"
        assert files[1]["tool"] == "Edit"
        assert "timestamp" in files[0]

    def test_was_file_written(self, session_state):
        """Test checking if a file was written."""
        session_state.add_file_written("/project/src/main.py", "Write")

        assert session_state.was_file_written("/project/src/main.py") is True
        assert session_state.was_file_written("/project/src/other.py") is False

    def test_add_command_run(self, session_state):
        """Test adding command runs."""
        session_state.add_command_run("npm test", exit_code=0, is_test=True)
        session_state.add_command_run("npm run lint", exit_code=1, is_lint=True)
        session_state.add_command_run("npm run build", exit_code=0, is_build=True)

        commands = session_state.get_commands_run()
        assert len(commands) == 3
        assert commands[0]["command"] == "npm test"
        assert commands[0]["is_test"] is True
        assert commands[1]["is_lint"] is True
        assert commands[2]["is_build"] is True

    def test_last_test_passed(self, session_state):
        """Test checking if last test passed."""
        assert session_state.last_test_passed() is None  # No tests run

        session_state.add_command_run("npm test", exit_code=0, is_test=True)
        assert session_state.last_test_passed() is True

        session_state.add_command_run("npm test", exit_code=1, is_test=True)
        assert session_state.last_test_passed() is False

    def test_last_lint_passed(self, session_state):
        """Test checking if last lint passed."""
        assert session_state.last_lint_passed() is None

        session_state.add_command_run("npm run lint", exit_code=0, is_lint=True)
        assert session_state.last_lint_passed() is True

    def test_last_build_passed(self, session_state):
        """Test checking if last build passed."""
        assert session_state.last_build_passed() is None

        session_state.add_command_run("npm run build", exit_code=0, is_build=True)
        assert session_state.last_build_passed() is True

    def test_add_verification_result(self, session_state):
        """Test adding verification results."""
        result = VerificationResult(
            claim_type="tests_pass",
            claim_text="all tests pass",
            passed=True,
            message="Tests passed",
            timestamp=time.time(),
            details={"framework": "pytest"}
        )
        session_state.add_verification_result(result)

        # Load state and check
        with open(session_state.state_file) as f:
            state = json.load(f)

        assert len(state["verification_results"]) == 1
        assert state["verification_results"][0]["claim_type"] == "tests_pass"
        assert state["verification_results"][0]["passed"] is True

    def test_stop_hook_active_property(self, session_state):
        """Test stop_hook_active property."""
        assert session_state.stop_hook_active is False

        session_state.stop_hook_active = True
        assert session_state.stop_hook_active is True

        session_state.stop_hook_active = False
        assert session_state.stop_hook_active is False


class TestSessionStateCleanup:
    """Tests for session state cleanup functionality."""

    def test_cleanup_old_states(self, temp_dir, monkeypatch):
        """Test cleaning up old state files."""
        test_state_dir = Path(temp_dir)
        monkeypatch.setattr(SessionState, 'STATE_DIR', test_state_dir)

        # Create some state files with old timestamps
        old_file = test_state_dir / "verify_claims_state_old.json"
        new_file = test_state_dir / "verify_claims_state_new.json"

        with open(old_file, 'w') as f:
            json.dump({"session_id": "old"}, f)
        with open(new_file, 'w') as f:
            json.dump({"session_id": "new"}, f)

        # Set old file's mtime to 35 days ago
        old_time = time.time() - (35 * 24 * 60 * 60)
        os.utime(old_file, (old_time, old_time))

        # Run cleanup with 30 day threshold
        removed = SessionState.cleanup_old_states(max_age_days=30)

        assert removed == 1
        assert not old_file.exists()
        assert new_file.exists()

    def test_cleanup_nonexistent_directory(self, temp_dir, monkeypatch):
        """Test cleanup when state directory doesn't exist."""
        nonexistent_dir = Path(temp_dir) / "nonexistent"
        monkeypatch.setattr(SessionState, 'STATE_DIR', nonexistent_dir)

        removed = SessionState.cleanup_old_states(max_age_days=30)
        assert removed == 0


class TestDataClasses:
    """Tests for data classes."""

    def test_tool_use_record(self):
        """Test ToolUseRecord dataclass."""
        record = ToolUseRecord(
            tool_name="Write",
            timestamp=time.time(),
            details={"path": "/test/file.py"}
        )
        assert record.tool_name == "Write"
        assert "path" in record.details

    def test_verification_result(self):
        """Test VerificationResult dataclass."""
        result = VerificationResult(
            claim_type="file_created",
            claim_text="created config.json",
            passed=True,
            message="File exists",
            timestamp=time.time(),
            details={"size": 1024}
        )
        assert result.passed is True
        assert result.claim_type == "file_created"
