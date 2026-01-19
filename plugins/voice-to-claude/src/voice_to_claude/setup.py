"""
Main setup module for voice-to-claude.
Builds whisper.cpp, downloads model, configures daemon.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def _get_plugin_root() -> Path:
    env_root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env_root:
        return Path(env_root).expanduser()
    # If running as module, go up from src/voice_to_claude
    return Path(__file__).resolve().parents[2]


HOME = Path.home()
INSTALL_DIR = HOME / ".local" / "share" / "voice-to-claude"
CONFIG_DIR = HOME / ".config" / "voice-to-claude"
CONFIG_FILE = CONFIG_DIR / "config.json"
WHISPER_DIR = INSTALL_DIR / "whisper.cpp"
PLUGIN_ROOT = _get_plugin_root()


def print_header(text):
    print(f"\n{'=' * 50}")
    print(text)
    print('=' * 50)


def print_step(num, total, text):
    print(f"\n[{num}/{total}] {text}")


def run_command(cmd, cwd=None, capture=False):
    """Run a shell command."""
    try:
        if capture:
            result = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
            return result.returncode == 0, result.stdout, result.stderr
        else:
            result = subprocess.run(cmd, shell=True, cwd=cwd)
            return result.returncode == 0, "", ""
    except Exception as e:
        return False, "", str(e)


def check_whisper_built():
    """Check if whisper.cpp is built."""
    whisper_cli = WHISPER_DIR / "build" / "bin" / "whisper-cli"
    return whisper_cli.exists()


def build_whisper():
    """Clone and build whisper.cpp with Metal support."""
    print("  Creating install directory...")
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)

    if not WHISPER_DIR.exists():
        print("  Cloning whisper.cpp...")
        success, _, err = run_command(
            "git clone https://github.com/ggerganov/whisper.cpp.git",
            cwd=INSTALL_DIR
        )
        if not success:
            print(f"  Error cloning whisper.cpp: {err}")
            return False

    print("  Building with Metal support (this may take a few minutes)...")
    success, _, err = run_command(
        "cmake -B build -DGGML_METAL=ON",
        cwd=WHISPER_DIR
    )
    if not success:
        print(f"  Error running cmake: {err}")
        return False

    success, _, err = run_command(
        "cmake --build build -j",
        cwd=WHISPER_DIR
    )
    if not success:
        print(f"  Error building: {err}")
        return False

    if check_whisper_built():
        print("  ✓ whisper.cpp built successfully")
        return True
    else:
        print("  ✗ Build failed - whisper-cli not found")
        return False


def check_model_exists(model="base"):
    """Check if a model is downloaded."""
    model_file = WHISPER_DIR / "models" / f"ggml-{model}.bin"
    return model_file.exists()


def download_model(model="base"):
    """Download a Whisper model."""
    print(f"  Downloading {model} model...")
    success, _, err = run_command(
        f"./models/download-ggml-model.sh {model}",
        cwd=WHISPER_DIR
    )
    if success and check_model_exists(model):
        print(f"  ✓ {model} model downloaded")
        return True
    else:
        print(f"  ✗ Failed to download model: {err}")
        return False


def save_config():
    """Save configuration file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    config = {
        "whisper_cpp_path": str(WHISPER_DIR / "build" / "bin" / "whisper-cli"),
        "models_dir": str(WHISPER_DIR / "models"),
        "model": "base",
        "hotkey_ctrl": True,
        "hotkey_alt": True,
        "hotkey_shift": False,
        "hotkey_cmd": False,
        "output_mode": "keyboard",
        "sound_effects": True,
        "max_recording_seconds": 60,
        "setup_complete": True
    }

    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

    print("  ✓ Configuration saved")
    return True


def run_setup(skip_build=False, skip_model=False):
    """Run the full setup process."""
    print_header("voice-to-claude Setup")

    total_steps = 2
    if not skip_build:
        total_steps += 1
    if not skip_model:
        total_steps += 1

    current_step = 0

    # Step 1: Build whisper.cpp
    if not skip_build:
        current_step += 1
        print_step(current_step, total_steps, "Setting up whisper.cpp...")

        if check_whisper_built():
            print("  ✓ whisper.cpp already built")
        else:
            if not build_whisper():
                print("\n  ✗ Failed to build whisper.cpp")
                print("  Make sure you have cmake and Xcode tools installed:")
                print("    brew install cmake")
                print("    xcode-select --install")
                sys.exit(1)

    # Step 2: Download model
    if not skip_model:
        current_step += 1
        print_step(current_step, total_steps, "Downloading Whisper model...")

        if check_model_exists("base"):
            print("  ✓ Base model already downloaded")
        else:
            if not download_model("base"):
                print("\n  ✗ Failed to download model")
                print("  Try manually:")
                print(f"    cd {WHISPER_DIR}")
                print("    ./models/download-ggml-model.sh base")
                sys.exit(1)

    # Step 3: Save configuration
    current_step += 1
    print_step(current_step, total_steps, "Saving configuration...")

    save_config()

    # Done!
    print_header("Setup Complete!")
    print("""
To start voice dictation:
  /voice-to-claude:start

Then hold Ctrl+Alt and speak!
""")


def main():
    parser = argparse.ArgumentParser(description="voice-to-claude setup")
    parser.add_argument("--skip-build", action="store_true", help="Skip whisper.cpp build")
    parser.add_argument("--skip-model", action="store_true", help="Skip model download")
    args = parser.parse_args()

    run_setup(skip_build=args.skip_build, skip_model=args.skip_model)


if __name__ == "__main__":
    main()

