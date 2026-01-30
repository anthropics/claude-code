"""
Integration tests for verify-claims plugin.

These tests run the hooks end-to-end using subprocess with mock JSON input,
validating the complete verification flow including:
- Hook input/output JSON format
- Claim detection from transcripts
- Verifier execution
- Block/allow decisions
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

import pytest

# Plugin root directory
PLUGIN_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = PLUGIN_ROOT / "scripts"
VERIFY_CLAIMS_SCRIPT = SCRIPTS_DIR / "verify_claims.py"
TRACK_TOOL_USE_SCRIPT = SCRIPTS_DIR / "track_tool_use.py"


# ============================================================================
# Helper Functions
# ============================================================================


def create_transcript(
    tmpdir: str, messages: list[dict[str, Any]], filename: str = "transcript.jsonl"
) -> str:
    """Create a JSONL transcript file with the given messages.

    Args:
        tmpdir: Directory to create the transcript in
        messages: List of message dictionaries to write
        filename: Name of the transcript file

    Returns:
        Path to the created transcript file
    """
    transcript_path = Path(tmpdir) / filename
    with open(transcript_path, "w") as f:
        for msg in messages:
            f.write(json.dumps(msg) + "\n")
    return str(transcript_path)


def create_assistant_message(text: str) -> dict[str, Any]:
    """Create an assistant message for the transcript.

    Args:
        text: The assistant's message text

    Returns:
        Transcript message dictionary
    """
    return {
        "type": "assistant",
        "message": {"content": [{"type": "text", "text": text}]},
    }


def create_user_message(text: str) -> dict[str, Any]:
    """Create a user message for the transcript.

    Args:
        text: The user's message text

    Returns:
        Transcript message dictionary
    """
    return {"type": "user", "message": text}


def run_verify_claims_hook(
    session_id: str, transcript_path: str, cwd: str, timeout: int = 30
) -> dict[str, Any]:
    """Run the verify_claims Stop hook and return parsed output.

    Args:
        session_id: Unique session identifier
        transcript_path: Path to the transcript JSONL file
        cwd: Working directory for verification
        timeout: Subprocess timeout in seconds

    Returns:
        Dictionary with 'decision' and optionally 'reason' keys,
        or empty dict if no JSON output
    """
    hook_input = {
        "session_id": session_id,
        "transcript_path": transcript_path,
        "cwd": cwd,
    }

    env = os.environ.copy()
    env["CLAUDE_PLUGIN_ROOT"] = str(PLUGIN_ROOT)

    result = subprocess.run(
        [sys.executable, str(VERIFY_CLAIMS_SCRIPT)],
        input=json.dumps(hook_input),
        capture_output=True,
        text=True,
        timeout=timeout,
        env=env,
    )

    # Parse JSON output if any
    stdout = result.stdout.strip()
    if stdout:
        try:
            return json.loads(stdout)
        except json.JSONDecodeError:
            return {"raw_output": stdout}

    return {}


def run_track_tool_use_hook(
    session_id: str,
    tool_name: str,
    tool_input: dict[str, Any],
    tool_output: Any = None,
) -> int:
    """Run the track_tool_use PostToolUse hook.

    Args:
        session_id: Unique session identifier
        tool_name: Name of the tool (Write, Edit, Bash)
        tool_input: Tool input parameters
        tool_output: Tool output (optional)

    Returns:
        Exit code of the hook
    """
    hook_input = {
        "session_id": session_id,
        "tool_name": tool_name,
        "tool_input": tool_input,
        "tool_output": tool_output or {},
    }

    env = os.environ.copy()
    env["CLAUDE_PLUGIN_ROOT"] = str(PLUGIN_ROOT)

    result = subprocess.run(
        [sys.executable, str(TRACK_TOOL_USE_SCRIPT)],
        input=json.dumps(hook_input),
        capture_output=True,
        text=True,
        timeout=10,
        env=env,
    )

    return result.returncode


def assert_verification_passed(output: dict[str, Any]) -> None:
    """Assert that verification passed (no block decision).

    Args:
        output: Hook output dictionary
    """
    assert output.get("decision") != "block", (
        f"Expected verification to pass, but got blocked: {output.get('reason', 'no reason')}"
    )


def assert_verification_blocked(
    output: dict[str, Any], expected_claim_type: str | None = None
) -> None:
    """Assert that verification blocked with correct claim type.

    Args:
        output: Hook output dictionary
        expected_claim_type: Expected claim type in the failure reason
    """
    assert output.get("decision") == "block", (
        f"Expected verification to block, but got: {output}"
    )
    assert "reason" in output, "Block decision should include a reason"

    if expected_claim_type:
        assert expected_claim_type in output["reason"], (
            f"Expected '{expected_claim_type}' in reason, got: {output['reason']}"
        )


def create_npm_project(tmpdir: str) -> None:
    """Create a minimal npm project structure.

    Args:
        tmpdir: Directory to create the project in
    """
    package_json = {
        "name": "test-project",
        "version": "1.0.0",
        "scripts": {
            "test": "echo 'All tests passed' && exit 0",
            "lint": "echo 'No lint errors' && exit 0",
            "build": "echo 'Build succeeded' && exit 0",
        },
    }
    pkg_path = Path(tmpdir) / "package.json"
    with open(pkg_path, "w") as f:
        json.dump(package_json, f)


def create_npm_project_failing_tests(tmpdir: str) -> None:
    """Create an npm project with failing tests.

    Args:
        tmpdir: Directory to create the project in
    """
    package_json = {
        "name": "test-project",
        "version": "1.0.0",
        "scripts": {
            "test": "echo 'FAIL: Test failed' && exit 1",
            "lint": "echo 'No lint errors' && exit 0",
        },
    }
    pkg_path = Path(tmpdir) / "package.json"
    with open(pkg_path, "w") as f:
        json.dump(package_json, f)


def create_npm_project_failing_lint(tmpdir: str) -> None:
    """Create an npm project with failing lint.

    Args:
        tmpdir: Directory to create the project in
    """
    package_json = {
        "name": "test-project",
        "version": "1.0.0",
        "scripts": {
            "test": "echo 'Tests passed' && exit 0",
            "lint": "echo 'error: lint error found' && exit 1",
        },
    }
    pkg_path = Path(tmpdir) / "package.json"
    with open(pkg_path, "w") as f:
        json.dump(package_json, f)


def create_npm_project_failing_build(tmpdir: str) -> None:
    """Create an npm project with failing build.

    Args:
        tmpdir: Directory to create the project in
    """
    package_json = {
        "name": "test-project",
        "version": "1.0.0",
        "scripts": {
            "build": "echo 'error: Build failed' && exit 1",
        },
    }
    pkg_path = Path(tmpdir) / "package.json"
    with open(pkg_path, "w") as f:
        json.dump(package_json, f)


def create_python_project(tmpdir: str) -> None:
    """Create a minimal Python project structure.

    Args:
        tmpdir: Directory to create the project in
    """
    pyproject = """
[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
"""
    pyproject_path = Path(tmpdir) / "pyproject.toml"
    with open(pyproject_path, "w") as f:
        f.write(pyproject)

    tests_dir = Path(tmpdir) / "tests"
    tests_dir.mkdir()


def create_git_repo(tmpdir: str, with_changes: bool = False) -> None:
    """Initialize a git repository.

    Args:
        tmpdir: Directory to initialize git in
        with_changes: Whether to create uncommitted changes
    """
    # Initialize git repo
    subprocess.run(
        ["git", "init"], cwd=tmpdir, capture_output=True, check=True
    )
    subprocess.run(
        ["git", "config", "user.email", "test@test.com"],
        cwd=tmpdir,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Test User"],
        cwd=tmpdir,
        capture_output=True,
        check=True,
    )

    # Create initial commit
    readme = Path(tmpdir) / "README.md"
    readme.write_text("# Test Project\n")
    subprocess.run(
        ["git", "add", "README.md"], cwd=tmpdir, capture_output=True, check=True
    )
    subprocess.run(
        ["git", "commit", "-m", "Initial commit"],
        cwd=tmpdir,
        capture_output=True,
        check=True,
    )

    if with_changes:
        # Create uncommitted changes
        code_file = Path(tmpdir) / "main.py"
        code_file.write_text("print('Hello World')\n")


def create_config_file(
    tmpdir: str, config: dict[str, Any], filename: str = "verify-claims.json"
) -> None:
    """Create a project-specific config file.

    Args:
        tmpdir: Project directory
        config: Configuration dictionary
        filename: Config filename
    """
    claude_dir = Path(tmpdir) / ".claude"
    claude_dir.mkdir(exist_ok=True)
    config_path = claude_dir / filename
    with open(config_path, "w") as f:
        json.dump(config, f)


def cleanup_session_state(session_id: str) -> None:
    """Remove session state file if it exists.

    Args:
        session_id: Session ID to clean up
    """
    state_file = Path.home() / ".claude" / f"verify_claims_state_{session_id}.json"
    if state_file.exists():
        state_file.unlink()


# ============================================================================
# Test Fixtures
# ============================================================================


@pytest.fixture
def integration_temp_dir():
    """Create a temporary directory for integration tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def unique_session_id():
    """Generate a unique session ID for each test."""
    import uuid
    session_id = f"test-{uuid.uuid4().hex[:8]}"
    yield session_id
    # Cleanup session state after test
    cleanup_session_state(session_id)


# ============================================================================
# file_created Claim Tests
# ============================================================================


class TestFileCreatedClaims:
    """Tests for file_created claim verification."""

    def test_file_created_claim_passes(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Create file, make claim -> verification passes."""
        # Setup: Create the file
        test_file = Path(integration_temp_dir) / "config.json"
        test_file.write_text('{"key": "value"}')

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create a config file"),
                create_assistant_message("I've created the config.json file for you."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_file_created_claim_fails(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Don't create file, make claim -> verification blocks."""
        # Setup: Don't create the file

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create a config file"),
                create_assistant_message("I've created the config.json file for you."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should block
        assert_verification_blocked(output, "file_created")

    def test_file_created_directory_not_file(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Create directory, claim file created -> verification blocks."""
        # Setup: Create a directory instead of file
        dir_path = Path(integration_temp_dir) / "config.json"
        dir_path.mkdir()

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create config file"),
                create_assistant_message("I've created config.json."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should block (is directory, not file)
        assert_verification_blocked(output, "file_created")

    def test_file_created_nested_path(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Create nested file, make claim -> verification passes."""
        # Setup: Create nested directory structure
        nested_dir = Path(integration_temp_dir) / "src" / "utils"
        nested_dir.mkdir(parents=True)
        test_file = nested_dir / "helper.ts"
        test_file.write_text("export const helper = () => {};")

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create a helper utility"),
                create_assistant_message(
                    "I've created the src/utils/helper.ts file with the utility function."
                ),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_multiple_file_claims(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Multiple file claims, all exist -> verification passes."""
        # Setup: Create multiple files
        (Path(integration_temp_dir) / "file1.py").write_text("# file 1")
        (Path(integration_temp_dir) / "file2.py").write_text("# file 2")

        # Create transcript with claims
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create two files"),
                create_assistant_message(
                    "I've created file1.py and file2.py for you."
                ),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_partial_file_claims_fail(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Multiple file claims (separate statements), one missing -> verification blocks."""
        # Setup: Create only one file
        (Path(integration_temp_dir) / "file1.py").write_text("# file 1")
        # file2.py is NOT created

        # Create transcript with claims - use separate claim statements for each file
        # The regex captures one file per match, so we need separate sentences
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create two files"),
                create_assistant_message(
                    "I've created file1.py with the first module. "
                    "I also created file2.py with the second module."
                ),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should block because file2.py doesn't exist
        assert_verification_blocked(output, "file_created")


# ============================================================================
# tests_pass Claim Tests
# ============================================================================


class TestTestsPassClaims:
    """Tests for tests_pass claim verification."""

    def test_tests_pass_claim_with_passing_tests(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: NPM project with passing tests -> verification passes."""
        # Setup: Create npm project with passing tests
        create_npm_project(integration_temp_dir)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Run the tests"),
                create_assistant_message("All tests pass now."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_tests_pass_claim_with_failing_tests(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: NPM project with failing tests -> verification blocks."""
        # Setup: Create npm project with failing tests
        create_npm_project_failing_tests(integration_temp_dir)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Run the tests"),
                create_assistant_message("All tests pass now."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should block
        assert_verification_blocked(output, "tests_pass")

    def test_tests_pass_no_test_framework_skips(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: No test framework detected -> verification skips (passes)."""
        # Setup: Empty project with no test framework

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Run the tests"),
                create_assistant_message("All tests pass."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass (skipped)
        assert_verification_passed(output)

    def test_tests_pass_custom_command(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Custom test command in config is used."""
        # Setup: Create project with custom config
        create_config_file(
            integration_temp_dir,
            {
                "verifiers": {
                    "tests_pass": {
                        "enabled": True,
                        "command": "echo 'Custom tests passed' && exit 0",
                    }
                }
            },
        )

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Run tests"),
                create_assistant_message("All tests pass."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should pass
        assert_verification_passed(output)


# ============================================================================
# lint_clean Claim Tests
# ============================================================================


class TestLintCleanClaims:
    """Tests for lint_clean claim verification."""

    def test_lint_clean_claim_passes(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Project with no lint errors -> verification passes."""
        # Setup: Create npm project with passing lint
        create_npm_project(integration_temp_dir)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Check lint"),
                create_assistant_message("No lint errors found."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_lint_clean_claim_fails(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Project with lint errors -> verification blocks."""
        # Setup: Create npm project with failing lint
        create_npm_project_failing_lint(integration_temp_dir)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Check lint"),
                create_assistant_message("No lint errors found."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should block
        assert_verification_blocked(output, "lint_clean")

    def test_lint_clean_no_linter_skips(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: No linter detected -> verification skips (passes)."""
        # Setup: Empty project with no linter

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Check lint"),
                create_assistant_message("Lint is clean."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass (skipped)
        assert_verification_passed(output)


# ============================================================================
# build_success Claim Tests
# ============================================================================


class TestBuildSuccessClaims:
    """Tests for build_success claim verification."""

    def test_build_success_claim_passes(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Successful build -> verification passes."""
        # Setup: Create npm project with passing build
        create_npm_project(integration_temp_dir)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Build the project"),
                create_assistant_message("Build succeeded with no errors."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_build_success_claim_fails(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Failed build -> verification blocks."""
        # Setup: Create npm project with failing build
        create_npm_project_failing_build(integration_temp_dir)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Build the project"),
                create_assistant_message("Build succeeded."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should block
        assert_verification_blocked(output, "build_success")

    def test_build_success_no_build_system_skips(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: No build system detected -> verification skips (passes)."""
        # Setup: Empty project with no build system

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Build it"),
                create_assistant_message("Build succeeded."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass (skipped)
        assert_verification_passed(output)


# ============================================================================
# bug_fixed Claim Tests
# ============================================================================


class TestBugFixedClaims:
    """Tests for bug_fixed claim verification."""

    def test_bug_fixed_with_git_changes(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Git repo with uncommitted changes -> verification passes."""
        # Setup: Create git repo with changes
        create_git_repo(integration_temp_dir, with_changes=True)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Fix the bug"),
                create_assistant_message("I've fixed the bug in the code."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_bug_fixed_no_changes(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Git repo with no recent changes -> verification blocks."""
        # Setup: Create git repo with an old commit (no recent commits)
        # We need to create the commit with a date in the past to avoid
        # the "recent commits" check in the verifier
        #
        # IMPORTANT: Create the git repo in a subdirectory, and put the
        # transcript OUTSIDE it. Otherwise the transcript file shows up
        # as an untracked file and the verifier thinks there are changes.

        git_repo_dir = Path(integration_temp_dir) / "repo"
        git_repo_dir.mkdir()

        # Initialize git repo
        subprocess.run(
            ["git", "init"], cwd=git_repo_dir, capture_output=True, check=True
        )
        subprocess.run(
            ["git", "config", "user.email", "test@test.com"],
            cwd=git_repo_dir,
            capture_output=True,
            check=True,
        )
        subprocess.run(
            ["git", "config", "user.name", "Test User"],
            cwd=git_repo_dir,
            capture_output=True,
            check=True,
        )

        # Create initial commit with an old date
        readme = git_repo_dir / "README.md"
        readme.write_text("# Test Project\n")
        subprocess.run(
            ["git", "add", "README.md"], cwd=git_repo_dir, capture_output=True, check=True
        )

        # Set both author and committer dates to the past
        old_date = "2020-01-01T00:00:00"
        env = {**os.environ, "GIT_AUTHOR_DATE": old_date, "GIT_COMMITTER_DATE": old_date}
        subprocess.run(
            ["git", "commit", "-m", "Initial commit"],
            cwd=git_repo_dir,
            capture_output=True,
            check=True,
            env=env,
        )

        # Create transcript OUTSIDE the git repo
        transcript = create_transcript(
            integration_temp_dir,  # Parent dir, not inside repo
            [
                create_user_message("Fix the bug"),
                create_assistant_message("I've fixed the bug."),
            ],
        )

        # Run verification (cwd is the git repo)
        output = run_verify_claims_hook(
            unique_session_id, transcript, str(git_repo_dir)
        )

        # Assert: Should block because no code changes and no recent commits
        assert_verification_blocked(output, "bug_fixed")

    def test_bug_fixed_not_git_repo_skips(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Not a git repo -> verification skips (passes)."""
        # Setup: No git repo (just empty directory)

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Fix the bug"),
                create_assistant_message("I've fixed the bug."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass (skipped because not a git repo)
        assert_verification_passed(output)

    def test_bug_fixed_with_staged_changes(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Git repo with staged changes -> verification passes."""
        # Setup: Create git repo and stage changes
        create_git_repo(integration_temp_dir)

        # Add a new file and stage it
        code_file = Path(integration_temp_dir) / "fix.py"
        code_file.write_text("# Bug fix\n")
        subprocess.run(
            ["git", "add", "fix.py"],
            cwd=integration_temp_dir,
            capture_output=True,
            check=True,
        )

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Fix the bug"),
                create_assistant_message("I've fixed the bug."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_bug_fixed_with_untracked_code_file(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Git repo with new untracked code file -> verification passes."""
        # Setup: Create git repo
        create_git_repo(integration_temp_dir)

        # Add an untracked Python file (code extension)
        code_file = Path(integration_temp_dir) / "new_feature.py"
        code_file.write_text("def new_feature(): pass\n")

        # Create transcript with claim
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Fix the bug"),
                create_assistant_message("I've fixed the issue."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass
        assert_verification_passed(output)


# ============================================================================
# Configuration Tests
# ============================================================================


class TestConfiguration:
    """Tests for configuration handling."""

    def test_block_on_failure_disabled(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: block_on_failure=false -> verification doesn't block."""
        # Setup: Create config with block_on_failure=false
        create_config_file(
            integration_temp_dir,
            {"behavior": {"block_on_failure": False}},
        )

        # Don't create the claimed file
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create file"),
                create_assistant_message("I've created config.json."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should NOT block even though file doesn't exist
        assert_verification_passed(output)

    def test_verifier_disabled(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Disabled verifier is skipped."""
        # Setup: Create config with file_created disabled
        create_config_file(
            integration_temp_dir,
            {"verifiers": {"file_created": {"enabled": False}}},
        )

        # Don't create the claimed file
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create file"),
                create_assistant_message("I've created config.json."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass (verifier disabled)
        assert_verification_passed(output)

    def test_max_retries_respected(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: After max_retries, verification allows completion."""
        # Setup: Config with max_retries=2
        create_config_file(
            integration_temp_dir,
            {"behavior": {"max_retries": 2}},
        )

        # Don't create the claimed file
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create file"),
                create_assistant_message("I've created config.json."),
            ],
        )

        # Run verification 3 times (exceeds max_retries=2)
        for _ in range(3):
            output = run_verify_claims_hook(
                unique_session_id, transcript, integration_temp_dir
            )

        # Assert: After max retries, should allow through
        assert_verification_passed(output)


# ============================================================================
# Edge Cases and Error Handling
# ============================================================================


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_no_claims_in_transcript(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: No verifiable claims -> verification passes."""
        # Create transcript with no claims
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Hello"),
                create_assistant_message("Hello! How can I help you today?"),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass (no claims to verify)
        assert_verification_passed(output)

    def test_empty_transcript(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Empty transcript -> verification passes."""
        # Create empty transcript
        transcript = create_transcript(integration_temp_dir, [])

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Should pass
        assert_verification_passed(output)

    def test_missing_transcript(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Missing transcript file -> verification passes."""
        # Run verification with non-existent transcript
        output = run_verify_claims_hook(
            unique_session_id,
            "/nonexistent/transcript.jsonl",
            integration_temp_dir,
        )

        # Assert: Should pass (graceful handling)
        assert_verification_passed(output)

    def test_combined_claims_partial_pass(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Multiple claim types, some fail -> verification blocks."""
        # Setup: Create npm project with passing tests but missing file
        create_npm_project(integration_temp_dir)
        # Don't create the claimed config.json file

        # Create transcript with multiple claims
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create config and run tests"),
                create_assistant_message(
                    "I've created config.json and all tests pass now."
                ),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir, timeout=60
        )

        # Assert: Should block due to missing file
        assert_verification_blocked(output, "file_created")


# ============================================================================
# PostToolUse Hook Tests
# ============================================================================


class TestTrackToolUseHook:
    """Tests for the PostToolUse tracking hook."""

    def test_track_file_write(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Write tool use is tracked."""
        # Run the tracking hook
        result = run_track_tool_use_hook(
            unique_session_id,
            "Write",
            {"file_path": f"{integration_temp_dir}/test.py"},
            {"success": True},
        )

        # Assert: Should succeed
        assert result == 0

    def test_track_bash_command(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Bash command is tracked."""
        # Run the tracking hook
        result = run_track_tool_use_hook(
            unique_session_id,
            "Bash",
            {"command": "npm test"},
            {"exit_code": 0},
        )

        # Assert: Should succeed
        assert result == 0

    def test_track_edit_tool(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Edit tool use is tracked."""
        # Run the tracking hook
        result = run_track_tool_use_hook(
            unique_session_id,
            "Edit",
            {"file_path": f"{integration_temp_dir}/config.json"},
            {"success": True},
        )

        # Assert: Should succeed
        assert result == 0


# ============================================================================
# Block Decision Output Format Tests
# ============================================================================


class TestBlockDecisionFormat:
    """Tests for correct block decision JSON output format."""

    def test_block_decision_has_correct_structure(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Block decision has correct JSON structure."""
        # Don't create the claimed file
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create file"),
                create_assistant_message("I've created config.json."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Correct structure
        assert "decision" in output
        assert output["decision"] == "block"
        assert "reason" in output
        assert isinstance(output["reason"], str)
        assert len(output["reason"]) > 0

    def test_block_reason_contains_claim_details(
        self, integration_temp_dir, unique_session_id
    ):
        """Test: Block reason contains useful claim details."""
        # Don't create the claimed file
        transcript = create_transcript(
            integration_temp_dir,
            [
                create_user_message("Create file"),
                create_assistant_message("I've created config.json."),
            ],
        )

        # Run verification
        output = run_verify_claims_hook(
            unique_session_id, transcript, integration_temp_dir
        )

        # Assert: Reason is descriptive
        reason = output.get("reason", "")
        assert "file_created" in reason
        assert "config.json" in reason.lower() or "does not exist" in reason.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
