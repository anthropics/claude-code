"""Pytest configuration and shared fixtures."""

import json
import sys
import tempfile
from pathlib import Path

import pytest

# Add scripts directory to path for imports
scripts_dir = Path(__file__).parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def temp_project_dir(temp_dir):
    """Create a temporary project directory with common files."""
    project_dir = Path(temp_dir) / "test_project"
    project_dir.mkdir()
    return str(project_dir)


@pytest.fixture
def npm_project(temp_project_dir):
    """Create a mock npm project."""
    package_json = {
        "name": "test-project",
        "version": "1.0.0",
        "scripts": {
            "test": "jest",
            "lint": "eslint .",
            "build": "tsc"
        }
    }
    pkg_path = Path(temp_project_dir) / "package.json"
    with open(pkg_path, 'w') as f:
        json.dump(package_json, f)
    return temp_project_dir


@pytest.fixture
def python_project(temp_project_dir):
    """Create a mock Python project with pytest."""
    pyproject = """
[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
"""
    pyproject_path = Path(temp_project_dir) / "pyproject.toml"
    with open(pyproject_path, 'w') as f:
        f.write(pyproject)

    tests_dir = Path(temp_project_dir) / "tests"
    tests_dir.mkdir()
    return temp_project_dir


@pytest.fixture
def rust_project(temp_project_dir):
    """Create a mock Rust project."""
    cargo_toml = """
[package]
name = "test_project"
version = "0.1.0"
edition = "2021"
"""
    cargo_path = Path(temp_project_dir) / "Cargo.toml"
    with open(cargo_path, 'w') as f:
        f.write(cargo_toml)
    return temp_project_dir


@pytest.fixture
def go_project(temp_project_dir):
    """Create a mock Go project."""
    go_mod = "module example.com/test\n\ngo 1.21\n"
    gomod_path = Path(temp_project_dir) / "go.mod"
    with open(gomod_path, 'w') as f:
        f.write(go_mod)
    return temp_project_dir


@pytest.fixture
def sample_transcript(temp_dir):
    """Create a sample transcript JSONL file."""
    transcript_path = Path(temp_dir) / "transcript.jsonl"
    messages = [
        {"type": "user", "message": "Create a config file"},
        {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "I've created the config.json file for you."}
                ]
            }
        },
        {"type": "user", "message": "Run the tests"},
        {
            "type": "assistant",
            "message": {
                "content": [
                    {"type": "text", "text": "All tests pass now. The build succeeded."}
                ]
            }
        }
    ]
    with open(transcript_path, 'w') as f:
        for msg in messages:
            f.write(json.dumps(msg) + "\n")
    return str(transcript_path)


@pytest.fixture
def default_config():
    """Return default plugin configuration."""
    return {
        "verifiers": {
            "file_created": {"enabled": True},
            "tests_pass": {"enabled": True, "timeout": 60},
            "lint_clean": {"enabled": True, "timeout": 30},
            "build_success": {"enabled": True, "timeout": 120},
            "bug_fixed": {"enabled": True}
        },
        "behavior": {
            "block_on_failure": True,
            "max_retries": 3,
            "confidence_threshold": 0.7,
            "cleanup_days": 30
        },
        "debug": False
    }
