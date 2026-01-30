"""Tests for verifiers/command_detection.py"""

import json
from pathlib import Path

from verifiers.command_detection import (
    detect_project_type,
    file_exists,
    read_package_json,
    read_pyproject_toml,
)


class TestReadPackageJson:
    """Tests for the read_package_json function."""

    def test_read_valid_package_json(self, temp_project_dir):
        """Test reading a valid package.json file."""
        pkg_data = {"name": "test", "version": "1.0.0", "scripts": {"test": "jest"}}
        pkg_path = Path(temp_project_dir) / "package.json"
        with open(pkg_path, 'w') as f:
            json.dump(pkg_data, f)

        result = read_package_json(temp_project_dir)
        assert result == pkg_data

    def test_read_nonexistent_package_json(self, temp_project_dir):
        """Test reading when package.json doesn't exist."""
        result = read_package_json(temp_project_dir)
        assert result is None

    def test_read_invalid_json(self, temp_project_dir):
        """Test reading an invalid JSON file."""
        pkg_path = Path(temp_project_dir) / "package.json"
        with open(pkg_path, 'w') as f:
            f.write("{invalid json")

        result = read_package_json(temp_project_dir)
        assert result is None


class TestReadPyprojectToml:
    """Tests for the read_pyproject_toml function."""

    def test_read_valid_pyproject(self, temp_project_dir):
        """Test reading a valid pyproject.toml file."""
        content = """
[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
"""
        pyproject_path = Path(temp_project_dir) / "pyproject.toml"
        with open(pyproject_path, 'w') as f:
            f.write(content)

        result = read_pyproject_toml(temp_project_dir)
        assert result is not None
        assert "[tool.pytest.ini_options]" in result
        assert "[tool.ruff]" in result

    def test_read_nonexistent_pyproject(self, temp_project_dir):
        """Test reading when pyproject.toml doesn't exist."""
        result = read_pyproject_toml(temp_project_dir)
        assert result is None


class TestFileExists:
    """Tests for the file_exists function."""

    def test_single_file_exists(self, temp_project_dir):
        """Test checking for a single existing file."""
        pkg_path = Path(temp_project_dir) / "package.json"
        pkg_path.touch()

        assert file_exists(temp_project_dir, "package.json") is True

    def test_single_file_not_exists(self, temp_project_dir):
        """Test checking for a single non-existing file."""
        assert file_exists(temp_project_dir, "package.json") is False

    def test_multiple_files_first_exists(self, temp_project_dir):
        """Test checking for multiple files when first exists."""
        pkg_path = Path(temp_project_dir) / "package.json"
        pkg_path.touch()

        assert file_exists(temp_project_dir, "package.json", "Cargo.toml") is True

    def test_multiple_files_second_exists(self, temp_project_dir):
        """Test checking for multiple files when second exists."""
        cargo_path = Path(temp_project_dir) / "Cargo.toml"
        cargo_path.touch()

        assert file_exists(temp_project_dir, "package.json", "Cargo.toml") is True

    def test_multiple_files_none_exist(self, temp_project_dir):
        """Test checking for multiple files when none exist."""
        assert file_exists(temp_project_dir, "package.json", "Cargo.toml") is False

    def test_directory_as_path(self, temp_project_dir):
        """Test checking for a directory."""
        tests_dir = Path(temp_project_dir) / "tests"
        tests_dir.mkdir()

        assert file_exists(temp_project_dir, "tests") is True


class TestDetectProjectType:
    """Tests for the detect_project_type function."""

    def test_detect_npm_project(self, temp_project_dir):
        """Test detecting an npm project."""
        pkg_path = Path(temp_project_dir) / "package.json"
        pkg_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "npm" in types

    def test_detect_python_project(self, temp_project_dir):
        """Test detecting a Python project."""
        pyproject_path = Path(temp_project_dir) / "pyproject.toml"
        pyproject_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "python" in types

    def test_detect_rust_project(self, temp_project_dir):
        """Test detecting a Rust project."""
        cargo_path = Path(temp_project_dir) / "Cargo.toml"
        cargo_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "rust" in types

    def test_detect_go_project(self, temp_project_dir):
        """Test detecting a Go project."""
        gomod_path = Path(temp_project_dir) / "go.mod"
        gomod_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "go" in types

    def test_detect_multiple_project_types(self, temp_project_dir):
        """Test detecting multiple project types."""
        (Path(temp_project_dir) / "package.json").touch()
        (Path(temp_project_dir) / "pyproject.toml").touch()

        types = detect_project_type(temp_project_dir)
        assert "npm" in types
        assert "python" in types

    def test_detect_no_project_type(self, temp_project_dir):
        """Test detecting no project type."""
        types = detect_project_type(temp_project_dir)
        assert types == []

    def test_detect_java_maven_project(self, temp_project_dir):
        """Test detecting a Maven project."""
        pom_path = Path(temp_project_dir) / "pom.xml"
        pom_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "java_maven" in types

    def test_detect_java_gradle_project(self, temp_project_dir):
        """Test detecting a Gradle project."""
        gradle_path = Path(temp_project_dir) / "build.gradle"
        gradle_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "java_gradle" in types

    def test_detect_make_project(self, temp_project_dir):
        """Test detecting a Make project."""
        makefile_path = Path(temp_project_dir) / "Makefile"
        makefile_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "make" in types

    def test_detect_typescript_project(self, temp_project_dir):
        """Test detecting a TypeScript project."""
        tsconfig_path = Path(temp_project_dir) / "tsconfig.json"
        tsconfig_path.touch()

        types = detect_project_type(temp_project_dir)
        assert "typescript" in types
