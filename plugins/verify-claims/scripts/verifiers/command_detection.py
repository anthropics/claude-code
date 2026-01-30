"""Shared command detection utilities for verifiers."""

import json
import os
from typing import Any


def read_package_json(cwd: str) -> dict[str, Any] | None:
    """
    Read and parse package.json if it exists.

    Args:
        cwd: Current working directory

    Returns:
        Parsed package.json contents or None
    """
    pkg_json = os.path.join(cwd, "package.json")
    if os.path.exists(pkg_json):
        try:
            with open(pkg_json) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return None


def read_pyproject_toml(cwd: str) -> str | None:
    """
    Read pyproject.toml contents if it exists.

    Args:
        cwd: Current working directory

    Returns:
        File contents as string or None
    """
    pyproject = os.path.join(cwd, "pyproject.toml")
    if os.path.exists(pyproject):
        try:
            with open(pyproject) as f:
                return f.read()
        except OSError:
            pass
    return None


def file_exists(cwd: str, *paths: str) -> bool:
    """
    Check if any of the given paths exist.

    Args:
        cwd: Current working directory
        paths: Relative paths to check

    Returns:
        True if any path exists
    """
    return any(os.path.exists(os.path.join(cwd, p)) for p in paths)


def detect_npm_script(cwd: str, *script_names: str) -> tuple[str, str] | None:
    """
    Detect an npm script from package.json.

    Args:
        cwd: Current working directory
        script_names: Script names to look for (in priority order)

    Returns:
        Tuple of (npm command, "npm") or None
    """
    pkg = read_package_json(cwd)
    if pkg:
        scripts = pkg.get("scripts", {})
        for name in script_names:
            if name in scripts:
                if name == "test" or name == "lint" or name == "build":
                    return (f"npm {name}" if name in ("test",) else f"npm run {name}", "npm")
                return (f"npm run {name}", "npm")
    return None


# Common project file detectors
PROJECT_MARKERS = {
    "npm": ["package.json"],
    "python": ["pyproject.toml", "setup.py", "pytest.ini"],
    "rust": ["Cargo.toml"],
    "go": ["go.mod"],
    "ruby": ["Gemfile"],
    "java_maven": ["pom.xml"],
    "java_gradle": ["build.gradle", "build.gradle.kts"],
    "make": ["Makefile"],
    "cmake": ["CMakeLists.txt"],
    "typescript": ["tsconfig.json"],
}


def detect_project_type(cwd: str) -> list[str]:
    """
    Detect project types based on marker files.

    Args:
        cwd: Current working directory

    Returns:
        List of detected project types
    """
    detected = []
    for project_type, markers in PROJECT_MARKERS.items():
        if file_exists(cwd, *markers):
            detected.append(project_type)
    return detected
