"""Tests for verifiers."""

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

from verifiers import verify_claim
from verifiers.build_checker import detect_build_command, verify_build_success
from verifiers.file_exists import verify_file_exists
from verifiers.git_diff import verify_changes_made
from verifiers.lint_checker import detect_lint_command, verify_lint_clean
from verifiers.test_runner import detect_test_command, verify_tests_pass


class TestVerifyFileExists:
    """Tests for the file exists verifier."""

    def test_file_exists(self, temp_project_dir):
        """Test verification when file exists."""
        # Create a test file
        test_file = Path(temp_project_dir) / "config.json"
        test_file.write_text('{"key": "value"}')

        result = verify_file_exists("config.json", temp_project_dir, {})

        assert result.passed is True
        assert "exists" in result.message.lower()
        assert result.details["is_file"] is True

    def test_file_not_exists(self, temp_project_dir):
        """Test verification when file doesn't exist."""
        result = verify_file_exists("nonexistent.json", temp_project_dir, {})

        assert result.passed is False
        assert "does not exist" in result.message.lower()

    def test_absolute_path(self, temp_project_dir):
        """Test verification with absolute path."""
        test_file = Path(temp_project_dir) / "abs_test.json"
        test_file.write_text("{}")

        result = verify_file_exists(str(test_file), temp_project_dir, {})
        assert result.passed is True

    def test_nested_path(self, temp_project_dir):
        """Test verification with nested path."""
        nested_dir = Path(temp_project_dir) / "src" / "components"
        nested_dir.mkdir(parents=True)
        test_file = nested_dir / "Button.tsx"
        test_file.write_text("export default Button;")

        result = verify_file_exists("src/components/Button.tsx", temp_project_dir, {})
        assert result.passed is True

    def test_directory_not_file(self, temp_project_dir):
        """Test that directories don't pass file verification."""
        dir_path = Path(temp_project_dir) / "src"
        dir_path.mkdir()

        result = verify_file_exists("src", temp_project_dir, {})
        assert result.passed is False
        assert "not a file" in result.message.lower()

    def test_missing_path_parameter(self, temp_project_dir):
        """Test verification with missing path."""
        result = verify_file_exists(None, temp_project_dir, {})
        assert result.passed is False
        assert "no file path" in result.message.lower()

    def test_empty_path_parameter(self, temp_project_dir):
        """Test verification with empty path."""
        result = verify_file_exists("", temp_project_dir, {})
        assert result.passed is False


class TestDetectTestCommand:
    """Tests for test command detection."""

    def test_detect_npm_test(self, npm_project):
        """Test detection of npm test command."""
        command, framework = detect_test_command(npm_project)
        assert command == "npm test"
        assert framework == "npm"

    def test_detect_pytest(self, python_project):
        """Test detection of pytest command."""
        command, framework = detect_test_command(python_project)
        assert command == "pytest"
        assert framework == "pytest"

    def test_detect_cargo_test(self, rust_project):
        """Test detection of cargo test command."""
        command, framework = detect_test_command(rust_project)
        assert command == "cargo test"
        assert framework == "cargo"

    def test_detect_go_test(self, go_project):
        """Test detection of go test command."""
        command, framework = detect_test_command(go_project)
        assert command == "go test ./..."
        assert framework == "go"

    def test_no_test_framework(self, temp_project_dir):
        """Test when no test framework is detected."""
        result = detect_test_command(temp_project_dir)
        assert result is None


class TestVerifyTestsPass:
    """Tests for the test runner verifier."""

    def test_skips_when_no_framework(self, temp_project_dir):
        """Test that verification is skipped when no test framework detected."""
        result = verify_tests_pass(None, temp_project_dir, {})

        assert result.passed is True
        assert result.details.get("skipped") is True
        assert "no test framework" in result.message.lower()

    def test_uses_custom_command(self, temp_project_dir):
        """Test that custom command is used when specified."""
        config = {"command": "echo 'tests pass'"}

        with patch('verifiers.test_runner.subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            verify_tests_pass(None, temp_project_dir, config)

        mock_run.assert_called_once()
        call_args = mock_run.call_args
        # Command is now passed as a list via shlex.split() for security
        assert call_args[0][0] == ["echo", "tests pass"]

    def test_handles_test_failure(self, npm_project):
        """Test handling of test failures."""
        with patch('verifiers.test_runner.subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(
                returncode=1,
                stdout="FAIL: test_something",
                stderr=""
            )
            result = verify_tests_pass(None, npm_project, {})

        assert result.passed is False
        assert "failed" in result.message.lower()

    def test_handles_timeout(self, npm_project):
        """Test handling of test timeout."""
        import subprocess

        with patch('verifiers.test_runner.subprocess.run') as mock_run:
            mock_run.side_effect = subprocess.TimeoutExpired("npm test", 60)
            result = verify_tests_pass(None, npm_project, {"timeout": 60})

        assert result.passed is False
        assert "timed out" in result.message.lower()


class TestDetectLintCommand:
    """Tests for lint command detection."""

    def test_detect_npm_lint(self, npm_project):
        """Test detection of npm lint command."""
        command, linter = detect_lint_command(npm_project)
        assert command == "npm run lint"
        assert linter == "npm"

    def test_detect_ruff(self, temp_project_dir):
        """Test detection of ruff linter."""
        ruff_config = Path(temp_project_dir) / "ruff.toml"
        ruff_config.write_text("[lint]\nselect = ['E', 'F']\n")

        command, linter = detect_lint_command(temp_project_dir)
        assert command == "ruff check ."
        assert linter == "ruff"

    def test_detect_cargo_clippy(self, rust_project):
        """Test detection of cargo clippy."""
        command, linter = detect_lint_command(rust_project)
        assert "clippy" in command
        assert linter == "clippy"

    def test_no_linter_detected(self, temp_project_dir):
        """Test when no linter is detected."""
        result = detect_lint_command(temp_project_dir)
        assert result is None


class TestVerifyLintClean:
    """Tests for the lint checker verifier."""

    def test_skips_when_no_linter(self, temp_project_dir):
        """Test that verification is skipped when no linter detected."""
        result = verify_lint_clean(None, temp_project_dir, {})

        assert result.passed is True
        assert result.details.get("skipped") is True

    def test_lint_passes(self, npm_project):
        """Test when lint passes."""
        with patch('verifiers.lint_checker.subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            result = verify_lint_clean(None, npm_project, {})

        assert result.passed is True
        assert "passed" in result.message.lower()

    def test_lint_fails(self, npm_project):
        """Test when lint fails."""
        with patch('verifiers.lint_checker.subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(
                returncode=1,
                stdout="src/index.ts:10 error",
                stderr=""
            )
            result = verify_lint_clean(None, npm_project, {})

        assert result.passed is False
        assert "error" in result.message.lower()


class TestDetectBuildCommand:
    """Tests for build command detection."""

    def test_detect_npm_build(self, npm_project):
        """Test detection of npm build command."""
        # Add build script to package.json
        pkg_path = Path(npm_project) / "package.json"
        with open(pkg_path) as f:
            pkg = json.load(f)
        pkg["scripts"]["build"] = "tsc"
        with open(pkg_path, 'w') as f:
            json.dump(pkg, f)

        command, tool = detect_build_command(npm_project)
        assert command == "npm run build"
        assert tool == "npm"

    def test_detect_cargo_build(self, rust_project):
        """Test detection of cargo build."""
        command, tool = detect_build_command(rust_project)
        assert command == "cargo build"
        assert tool == "cargo"

    def test_detect_go_build(self, go_project):
        """Test detection of go build."""
        command, tool = detect_build_command(go_project)
        assert command == "go build ./..."
        assert tool == "go"

    def test_detect_typescript(self, temp_project_dir):
        """Test detection of TypeScript compilation."""
        tsconfig = Path(temp_project_dir) / "tsconfig.json"
        tsconfig.write_text('{"compilerOptions": {}}')

        command, tool = detect_build_command(temp_project_dir)
        assert "tsc" in command
        assert tool == "typescript"


class TestVerifyBuildSuccess:
    """Tests for the build checker verifier."""

    def test_skips_when_no_build_system(self, temp_project_dir):
        """Test that verification is skipped when no build system detected."""
        result = verify_build_success(None, temp_project_dir, {})

        assert result.passed is True
        assert result.details.get("skipped") is True

    def test_build_succeeds(self, rust_project):
        """Test when build succeeds."""
        with patch('verifiers.build_checker.subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            result = verify_build_success(None, rust_project, {})

        assert result.passed is True
        assert "succeeded" in result.message.lower()

    def test_build_fails(self, rust_project):
        """Test when build fails."""
        with patch('verifiers.build_checker.subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(
                returncode=1,
                stdout="error[E0308]: mismatched types",
                stderr=""
            )
            result = verify_build_success(None, rust_project, {})

        assert result.passed is False
        assert "failed" in result.message.lower()


class TestVerifyChangesMade:
    """Tests for the git diff verifier."""

    def test_skips_non_git_repo(self, temp_project_dir):
        """Test that verification is skipped for non-git repos."""
        result = verify_changes_made(None, temp_project_dir, {})

        assert result.passed is True
        assert result.details.get("skipped") is True
        assert "not a git repository" in result.message.lower()

    def test_detects_changes(self, temp_project_dir):
        """Test detection of code changes in a git repo."""
        # Initialize git repo
        git_dir = Path(temp_project_dir) / ".git"
        git_dir.mkdir()

        with patch('verifiers.git_diff.subprocess.run') as mock_run:
            # Simulate having unstaged changes
            mock_run.side_effect = [
                MagicMock(returncode=0, stdout=""),  # staged
                MagicMock(returncode=0, stdout="src/main.py\n"),  # unstaged
                MagicMock(returncode=0, stdout=""),  # untracked
            ]
            result = verify_changes_made(None, temp_project_dir, {})

        assert result.passed is True
        assert "changes detected" in result.message.lower()

    def test_no_changes_detected(self, temp_project_dir):
        """Test when no changes are detected."""
        git_dir = Path(temp_project_dir) / ".git"
        git_dir.mkdir()

        with patch('verifiers.git_diff.subprocess.run') as mock_run:
            # Simulate no changes
            mock_run.side_effect = [
                MagicMock(returncode=0, stdout=""),  # staged
                MagicMock(returncode=0, stdout=""),  # unstaged
                MagicMock(returncode=0, stdout=""),  # untracked
                MagicMock(returncode=0, stdout=""),  # recent commits
            ]
            result = verify_changes_made(None, temp_project_dir, {})

        assert result.passed is False
        assert "no code changes" in result.message.lower()


class TestVerifyClaim:
    """Tests for the main verify_claim function."""

    def test_routes_to_correct_verifier(self, temp_project_dir):
        """Test that claims are routed to correct verifiers."""
        # Create a test file
        test_file = Path(temp_project_dir) / "test.txt"
        test_file.write_text("content")

        config = {"verifiers": {"file_created": {"enabled": True}}}
        result = verify_claim("file_created", "test.txt", temp_project_dir, config)

        assert result.passed is True

    def test_unknown_claim_type_skipped(self, temp_project_dir):
        """Test that unknown claim types are skipped."""
        config = {}
        result = verify_claim("unknown_type", None, temp_project_dir, config)

        assert result.passed is True
        assert result.details.get("skipped") is True

    def test_disabled_verifier_skipped(self, temp_project_dir):
        """Test that disabled verifiers are skipped."""
        config = {"verifiers": {"tests_pass": {"enabled": False}}}
        result = verify_claim("tests_pass", None, temp_project_dir, config)

        assert result.passed is True
        assert result.details.get("skipped") is True
        assert result.details.get("reason") == "disabled"

    def test_handles_verifier_exceptions(self, temp_project_dir):
        """Test that verifier exceptions are handled gracefully."""
        config = {"verifiers": {"file_created": {"enabled": True}}}

        # Pass an invalid path that might cause issues
        with patch('verifiers.file_exists.os.path.exists') as mock_exists:
            mock_exists.side_effect = PermissionError("Access denied")
            result = verify_claim("file_created", "/some/path", temp_project_dir, config)

        assert result.passed is False
        assert "error" in result.message.lower()
