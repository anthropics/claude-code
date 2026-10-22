#!/usr/bin/env python3
"""
Data Protection Hook for Claude Code

This hook protects critical data files (ML checkpoints, training results, model weights)
from accidental overwrites by prompting for user confirmation before Write operations.

Protected file types:
- ML model files: *.pt, *.pth, *.ckpt, *.h5, *.pb, *.onnx, *.pkl, *.joblib, *.safetensors, *.mlmodel, *.engine
- Training output: results.csv, metrics.csv, training_log.txt, loss_curve.png, *loss*.png, *accuracy*.png
- Dataset files: *.npy, *.npz, *.hdf5, *.parquet
- Checkpoint files: *checkpoint*.pth, *checkpoint*.pt, checkpoint.pt, checkpoint.pth
"""

import json
import os
import re
import sys
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/data-protection-log.txt"


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass  # Silently ignore logging errors


# Patterns that indicate protected ML/training data files
PROTECTED_EXTENSIONS = {
    # ML model files
    ".pt", ".pth", ".ckpt", ".h5", ".pb", ".onnx",
    ".pkl", ".joblib", ".safetensors", ".mlmodel", ".engine",
    # Additional ML framework formats
    ".keras", ".tflite", ".lite",  # TensorFlow formats
    ".ptl",  # PyTorch Lightning
    # Dataset files
    ".npy", ".npz", ".hdf5", ".parquet",
    # Serialized models
    ".msgpack",
}

# Filenames that are protected regardless of extension (case-insensitive)
PROTECTED_FILENAMES = {
    "results.csv", "metrics.csv", "training_log.txt", "loss_curve.png",
    "accuracy_curve.png", "validation_loss.png", "validation_accuracy.png",
    "checkpoint.pth", "checkpoint.pt", "checkpoint.ckpt",
    "best_model.pth", "best_model.pt", "best_model.ckpt",
    "model_weights.pth", "model_weights.pt", "model_weights.ckpt",
    "train_history.json", "val_history.json", "history.json",
    # Training-specific config files only (not generic config.yaml)
    "training_config.yaml", "training_config.yml",
    "model_config.yaml", "model_config.yml",
    "experiment_config.yaml", "experiment_config.yml",
    "train_config.yaml", "train_config.yml",
}

# Patterns for checkpoint files (case-insensitive)
CHECKPOINT_PATTERNS = [
    re.compile(r".*checkpoint.*\.pth$", re.IGNORECASE),
    re.compile(r".*checkpoint.*\.pt$", re.IGNORECASE),
    re.compile(r".*checkpoint.*\.ckpt$", re.IGNORECASE),
    re.compile(r".*epoch.*\.pth$", re.IGNORECASE),
    re.compile(r".*epoch.*\.pt$", re.IGNORECASE),
    re.compile(r".*step.*\.pth$", re.IGNORECASE),
    re.compile(r".*step.*\.pt$", re.IGNORECASE),
    # Additional patterns for numbered checkpoints (e.g., model_epoch_10.pt, weights_1000_steps.pt)
    re.compile(r".*epochs.*\.pth$", re.IGNORECASE),
    re.compile(r".*epochs.*\.pt$", re.IGNORECASE),
    re.compile(r".*steps.*\.pth$", re.IGNORECASE),
    re.compile(r".*steps.*\.pt$", re.IGNORECASE),
    # Patterns for files with training-related numbers (e.g., epoch_10, step_500, batch_32)
    re.compile(r".*epoch_?\d+.*\.pth$", re.IGNORECASE),
    re.compile(r".*epoch_?\d+.*\.pt$", re.IGNORECASE),
    re.compile(r".*step_?\d+.*\.pth$", re.IGNORECASE),
    re.compile(r".*step_?\d+.*\.pt$", re.IGNORECASE),
    re.compile(r".*batch_?\d+.*\.pth$", re.IGNORECASE),
    re.compile(r".*batch_?\d+.*\.pt$", re.IGNORECASE),
]

# Patterns for loss/accuracy curves (case-insensitive)
CURVE_PATTERNS = [
    re.compile(r".*loss.*\.png$", re.IGNORECASE),
    re.compile(r".*accuracy.*\.png$", re.IGNORECASE),
    re.compile(r".*train.*\.png$", re.IGNORECASE),
    re.compile(r".*validation.*\.png$", re.IGNORECASE),
    re.compile(r".*curve.*\.png$", re.IGNORECASE),
    re.compile(r".*plot.*\.png$", re.IGNORECASE),
]

# Patterns for training results (case-insensitive)
TRAINING_PATTERNS = [
    re.compile(r".*results.*\.csv$", re.IGNORECASE),
    re.compile(r".*metrics.*\.csv$", re.IGNORECASE),
    re.compile(r".*log.*\.txt$", re.IGNORECASE),
    re.compile(r".*history.*\.json$", re.IGNORECASE),
]


def is_protected_file(file_path: str) -> tuple[bool, str]:
    """
    Check if a file is a protected data file.

    Returns:
        (is_protected, reason): Tuple of (whether file is protected, reason for protection)
    """
    if not file_path:
        return False, ""

    # Normalize path - remove leading slashes and normalize
    normalized_path = file_path.lstrip("/")
    filename = os.path.basename(normalized_path).lower()

    # Check exact filename matches (case-insensitive)
    if filename in PROTECTED_FILENAMES:
        return True, f"Protected training output file: {filename}"

    # Check extension
    _, ext = os.path.splitext(filename)
    if ext.lower() in PROTECTED_EXTENSIONS:
        return True, f"Protected ML model/data file: {ext} extension"

    # Check checkpoint patterns
    for pattern in CHECKPOINT_PATTERNS:
        if pattern.match(filename):
            return True, f"Protected checkpoint file: {filename}"

    # Check curve patterns
    for pattern in CURVE_PATTERNS:
        if pattern.match(filename):
            return True, f"Protected training visualization: {filename}"

    # Check training patterns
    for pattern in TRAINING_PATTERNS:
        if pattern.match(filename):
            return True, f"Protected training results: {filename}"

    return False, ""


def check_file_exists(file_path: str) -> bool:
    """Check if file exists (not a directory)."""
    try:
        return os.path.isfile(file_path)
    except Exception:
        return False


def main():
    """Main hook function."""
    # Check if data protection is enabled
    # Can be disabled with environment variable DATA_PROTECTION_ENABLED=0
    protection_enabled = os.environ.get("DATA_PROTECTION_ENABLED", "1")

    if protection_enabled == "0":
        debug_log("Data protection disabled by environment variable")
        sys.exit(0)  # Allow operation

    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)  # Allow tool to proceed if we can't parse input

    # Extract tool information
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only process Write tool
    if tool_name != "Write":
        sys.exit(0)  # Allow non-Write tools to proceed

    # Extract file path from tool_input
    file_path = tool_input.get("file_path", "")
    if not file_path:
        sys.exit(0)  # Allow if no file path

    # Check if this is a protected file
    is_protected, reason = is_protected_file(file_path)

    if not is_protected:
        sys.exit(0)  # Allow non-protected files

    # Check if file exists (we only protect existing files from overwrites)
    if not check_file_exists(file_path):
        debug_log(f"Protected file type but doesn't exist, allowing: {file_path}")
        sys.exit(0)  # Allow new files (not overwrites)

    # File exists and is protected - prompt user for confirmation
    warning_message = f"""
WARNING: Attempting to overwrite a protected data file!

File: {file_path}
Reason: {reason}

This file may contain:
- ML model weights/checkpoints (hours of GPU training)
- Training metrics and results
- Important dataset artifacts

Are you sure you want to overwrite this file? This action cannot be undone.

To proceed, please explicitly confirm you want to overwrite this file.
If this is intentional (e.g., you want to save a new checkpoint), please respond with confirmation.
"""

    # Output warning to stderr
    print(warning_message, file=sys.stderr)

    # Exit with code 2 to block the operation and prompt for confirmation
    # Claude Code will show this message to the user and ask for confirmation
    sys.exit(2)


if __name__ == "__main__":
    main()
