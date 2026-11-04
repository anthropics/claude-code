#!/usr/bin/env python3
"""
Bootstrap setup for voice-to-claude (stdlib only).
Creates venv and installs dependencies, then runs main setup.
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import venv
from pathlib import Path
from typing import Sequence


def _get_plugin_root() -> Path:
    env_root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env_root:
        return Path(env_root).expanduser()
    return Path(__file__).resolve().parents[1]


def _print_error(message: str) -> None:
    print(f"Error: {message}", file=sys.stderr)


def _print_info(message: str) -> None:
    print(message)


def _check_python() -> bool:
    """Check if Python version is 3.10+."""
    if sys.version_info < (3, 10):
        current = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        _print_error(f"Python 3.10+ required, but found {current}.")
        _print_info("")
        system = platform.system()
        if system == "Darwin":
            _print_info("Install with: brew install python@3.11")
            _print_info("Or download from: https://www.python.org/downloads/")
        elif system == "Linux":
            _print_info("Install with: sudo apt install python3.11 python3-venv python3-pip")
        else:
            _print_info("Download from: https://www.python.org/downloads/")
        return False
    return True


def _check_uv() -> str | None:
    """Check if uv is available."""
    return shutil.which("uv")


def _run(cmd: list[str], cwd: Path) -> int:
    """Run a command."""
    return subprocess.call(cmd, cwd=str(cwd))


def _venv_python(plugin_root: Path) -> Path:
    """Get path to venv Python."""
    venv_dir = plugin_root / ".venv"
    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def _ensure_venv(plugin_root: Path) -> Path | None:
    """Create venv if it doesn't exist."""
    venv_dir = plugin_root / ".venv"
    python_path = _venv_python(plugin_root)
    
    if python_path.exists():
        # Verify the venv Python is the same version as current Python
        try:
            venv_version = subprocess.check_output(
                [str(python_path), "--version"], text=True, stderr=subprocess.STDOUT
            ).strip()
            current_version = f"Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            if venv_version != current_version:
                # Venv was created with wrong Python version, recreate it
                _print_info(f"Recreating venv (found {venv_version}, need {current_version})...")
                shutil.rmtree(venv_dir)
            else:
                return python_path
        except Exception:
            # If we can't check, try to recreate
            if venv_dir.exists():
                shutil.rmtree(venv_dir)

    _print_info(f"Creating virtual environment with Python {sys.version_info.major}.{sys.version_info.minor}...")
    try:
        # CRITICAL: Use sys.executable to ensure we use the SAME Python that's running this script
        # This prevents venv from using a different Python version
        builder = venv.EnvBuilder(with_pip=True, system_site_packages=False)
        # Explicitly set the Python executable to the one running this script
        builder.create(venv_dir)
        
        # Verify the venv was created with the correct Python
        if python_path.exists():
            venv_version_output = subprocess.check_output(
                [str(python_path), "--version"], text=True, stderr=subprocess.STDOUT
            ).strip()
            expected_version = f"Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            if venv_version_output != expected_version:
                _print_error(f"Venv created with wrong Python! Expected {expected_version}, got {venv_version_output}")
                shutil.rmtree(venv_dir)
                return None
    except Exception as e:
        _print_error(f"Failed to create virtual environment: {e}")
        if venv_dir.exists():
            shutil.rmtree(venv_dir)
        return None

    return python_path if python_path.exists() else None


def _pip_install(python_path: Path, plugin_root: Path) -> int:
    """Install package in venv."""
    return _run(
        [
            str(python_path),
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--no-input",
            ".",
        ],
        plugin_root,
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="voice-to-claude setup bootstrap")
    parser.add_argument(
        "--skip-install",
        action="store_true",
        help="Skip dependency installation.",
    )
    parser.add_argument(
        "--skip-build",
        action="store_true",
        help="Skip whisper.cpp build.",
    )
    parser.add_argument(
        "--skip-model",
        action="store_true",
        help="Skip model download.",
    )
    args, passthrough = parser.parse_known_args(argv)

    if not _check_python():
        return 1

    plugin_root = _get_plugin_root()
    os.environ.setdefault("CLAUDE_PLUGIN_ROOT", str(plugin_root))

    # Check for uv first (faster)
    uv = _check_uv()
    if uv:
        _print_info("Using uv for dependency management.")
        if not args.skip_install:
            sync_cmd = [uv, "sync", "--directory", str(plugin_root)]
            exit_code = _run(sync_cmd, plugin_root)
            if exit_code != 0:
                _print_error("uv sync failed.")
                return exit_code

        # Run setup using uv
        cmd = [
            uv,
            "run",
            "--directory",
            str(plugin_root),
            "python",
            "-m",
            "voice_to_claude.setup",
            *passthrough,
        ]
        if args.skip_build:
            cmd.append("--skip-build")
        if args.skip_model:
            cmd.append("--skip-model")
        return _run(cmd, plugin_root)

    # Fallback to venv
    venv_python = _ensure_venv(plugin_root)
    if venv_python is None:
        return 1

    if not args.skip_install:
        _print_info("Installing dependencies in local .venv...")
        exit_code = _pip_install(venv_python, plugin_root)
        if exit_code != 0:
            _print_error("pip install failed.")
            return exit_code

    # Run main setup
    cmd = [str(venv_python), "-m", "voice_to_claude.setup"]
    if args.skip_build:
        cmd.append("--skip-build")
    if args.skip_model:
        cmd.append("--skip-model")
    cmd.extend(passthrough)
    return _run(cmd, plugin_root)


if __name__ == "__main__":
    raise SystemExit(main())
