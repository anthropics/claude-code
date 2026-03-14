#!/usr/bin/env python3
"""
Sensitive File Guard Hook for Claude Code

This hook intercepts Write, Edit, and MultiEdit operations to protect
sensitive infrastructure files from accidental overwrites.

Protected file categories:
- Environment files (.env, .env.local, .env.production, etc.)
- Lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml, etc.)
- CI/CD configs (.github/workflows/*.yml, .gitlab-ci.yml, etc.)
- Container configs (Dockerfile, docker-compose.yml, etc.)
- Infrastructure as Code (terraform.tfstate, *.tfvars)
- SSH/Crypto keys (*.pem, *.key, id_rsa, id_ed25519)
- Deployment configs (vercel.json, netlify.toml, fly.toml, etc.)
"""

import json
import os
import random
import sys
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/sensitive-file-guard-log.txt"


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass  # Silently ignore logging errors


# ─── Protected File Definitions ──────────────────────────────────────────────

# Exact filenames (case-insensitive) that are always protected
PROTECTED_FILENAMES = {
    # Environment files
    ".env",
    ".env.local",
    ".env.development",
    ".env.staging",
    ".env.production",
    ".env.test",
    ".env.example",
    # Lockfiles
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "gemfile.lock",
    "pipfile.lock",
    "poetry.lock",
    "composer.lock",
    "go.sum",
    "cargo.lock",
    "mix.lock",
    "pubspec.lock",
    "flake.lock",
    "shrinkwrap.yaml",
    # Container configs
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "docker-compose.override.yml",
    "docker-compose.override.yaml",
    ".dockerignore",
    # CI/CD configs
    ".gitlab-ci.yml",
    "jenkinsfile",
    ".travis.yml",
    "appveyor.yml",
    "bitbucket-pipelines.yml",
    "azure-pipelines.yml",
    "cloudbuild.yaml",
    "cloudbuild.yml",
    # Infrastructure
    "terraform.tfstate",
    "terraform.tfstate.backup",
    # Deployment configs
    "vercel.json",
    "netlify.toml",
    "fly.toml",
    "render.yaml",
    "railway.toml",
    "procfile",
    "app.yaml",
    "app.yml",
    # SSH/Crypto key filenames
    "id_rsa",
    "id_rsa.pub",
    "id_ed25519",
    "id_ed25519.pub",
    "id_ecdsa",
    "id_ecdsa.pub",
    "authorized_keys",
    "known_hosts",
}

# File extensions that indicate sensitive files
PROTECTED_EXTENSIONS = {
    ".pem",
    ".key",
    ".crt",
    ".cer",
    ".p12",
    ".pfx",
    ".jks",
    ".keystore",
    ".tfvars",
}

# Path patterns for files that are protected based on their directory
# Each entry is (directory_substring, filename_extension_or_pattern)
PROTECTED_PATH_PATTERNS = [
    # GitHub Actions workflows
    (".github/workflows/", ".yml"),
    (".github/workflows/", ".yaml"),
    # CircleCI
    (".circleci/", "config.yml"),
    (".circleci/", "config.yaml"),
    # Kubernetes
    ("k8s/", ".yml"),
    ("k8s/", ".yaml"),
    ("kubernetes/", ".yml"),
    ("kubernetes/", ".yaml"),
    # Terraform
    ("terraform/", ".tf"),
    ("terraform/", ".tfvars"),
]

# Category labels for user-friendly messages
FILE_CATEGORIES = {
    ".env": "Environment variable file",
    "lockfile": "Package lockfile",
    "container": "Container configuration",
    "ci_cd": "CI/CD pipeline configuration",
    "infrastructure": "Infrastructure configuration",
    "deployment": "Deployment configuration",
    "crypto": "SSH/Cryptographic key file",
}


def get_file_category(file_path, filename):
    """Determine the category of a protected file for display purposes."""
    lower_name = filename.lower()
    _, ext = os.path.splitext(lower_name)
    normalized_path = file_path.replace("\\", "/").lstrip("/")

    if lower_name.startswith(".env"):
        return FILE_CATEGORIES[".env"]
    if "lock" in lower_name or lower_name in {
        "go.sum",
        "shrinkwrap.yaml",
    }:
        return FILE_CATEGORIES["lockfile"]
    if "docker" in lower_name or lower_name == ".dockerignore":
        return FILE_CATEGORIES["container"]
    if any(
        ci in lower_name
        for ci in [
            "gitlab-ci",
            "jenkins",
            "travis",
            "appveyor",
            "pipelines",
            "cloudbuild",
        ]
    ):
        return FILE_CATEGORIES["ci_cd"]
    if ".github/workflows/" in normalized_path or ".circleci/" in normalized_path:
        return FILE_CATEGORIES["ci_cd"]
    if ext in PROTECTED_EXTENSIONS:
        if ext in {".pem", ".key", ".crt", ".cer", ".p12", ".pfx", ".jks", ".keystore"}:
            return FILE_CATEGORIES["crypto"]
        if ext == ".tfvars":
            return FILE_CATEGORIES["infrastructure"]
    if lower_name in {"terraform.tfstate", "terraform.tfstate.backup"}:
        return FILE_CATEGORIES["infrastructure"]
    if lower_name in {
        "vercel.json",
        "netlify.toml",
        "fly.toml",
        "render.yaml",
        "railway.toml",
        "procfile",
        "app.yaml",
        "app.yml",
    }:
        return FILE_CATEGORIES["deployment"]
    if any(
        p in normalized_path for p in ["k8s/", "kubernetes/", "terraform/"]
    ):
        return FILE_CATEGORIES["infrastructure"]

    return "Sensitive file"


def is_protected_file(file_path):
    """
    Check if a file path matches a protected file pattern.

    Returns:
        (is_protected, reason): Tuple of whether file is protected and why.
    """
    if not file_path:
        return False, ""

    # Normalize path
    normalized_path = file_path.replace("\\", "/").lstrip("/")
    filename = os.path.basename(normalized_path)
    lower_filename = filename.lower()
    _, ext = os.path.splitext(lower_filename)

    # Check exact filename match (case-insensitive)
    if lower_filename in PROTECTED_FILENAMES:
        category = get_file_category(file_path, filename)
        return True, f"{category}: {filename}"

    # Check extension match
    if ext in PROTECTED_EXTENSIONS:
        category = get_file_category(file_path, filename)
        return True, f"{category}: {filename} ({ext} extension)"

    # Check path pattern match
    for dir_pattern, file_pattern in PROTECTED_PATH_PATTERNS:
        if dir_pattern in normalized_path:
            if file_pattern.startswith("."):
                # Extension match
                if lower_filename.endswith(file_pattern):
                    category = get_file_category(file_path, filename)
                    return True, f"{category}: {filename} (in {dir_pattern})"
            else:
                # Exact filename match within directory
                if lower_filename == file_pattern:
                    category = get_file_category(file_path, filename)
                    return True, f"{category}: {filename} (in {dir_pattern})"

    return False, ""


# ─── State Management ────────────────────────────────────────────────────────


def get_state_file(session_id):
    """Get session-specific state file path."""
    return os.path.expanduser(
        f"~/.claude/sensitive_file_guard_state_{session_id}.json"
    )


def cleanup_old_state_files():
    """Remove state files older than 30 days."""
    try:
        state_dir = os.path.expanduser("~/.claude")
        if not os.path.exists(state_dir):
            return

        current_time = datetime.now().timestamp()
        thirty_days_ago = current_time - (30 * 24 * 60 * 60)

        for filename in os.listdir(state_dir):
            if filename.startswith(
                "sensitive_file_guard_state_"
            ) and filename.endswith(".json"):
                file_path = os.path.join(state_dir, filename)
                try:
                    file_mtime = os.path.getmtime(file_path)
                    if file_mtime < thirty_days_ago:
                        os.remove(file_path)
                except (OSError, IOError):
                    pass
    except Exception:
        pass  # Silently ignore cleanup errors


def load_state(session_id):
    """Load the set of already-warned file keys for this session."""
    state_file = get_state_file(session_id)
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                return set(json.load(f))
        except (json.JSONDecodeError, IOError):
            return set()
    return set()


def save_state(session_id, shown_warnings):
    """Persist the set of already-warned file keys for this session."""
    state_file = get_state_file(session_id)
    try:
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w") as f:
            json.dump(list(shown_warnings), f)
    except IOError as e:
        debug_log(f"Failed to save state file: {e}")


# ─── Input Extraction ────────────────────────────────────────────────────────


def extract_file_path(tool_name, tool_input):
    """Extract the target file path from the tool input."""
    return tool_input.get("file_path", "")


# ─── Main ─────────────────────────────────────────────────────────────────────


def main():
    """Main hook function."""
    # Check if guard is enabled (can be disabled via env var)
    guard_enabled = os.environ.get("SENSITIVE_FILE_GUARD_ENABLED", "1")
    if guard_enabled == "0":
        debug_log("Sensitive file guard disabled by environment variable")
        sys.exit(0)

    # Periodically clean up old state files (10% chance per run)
    if random.random() < 0.1:
        cleanup_old_state_files()

    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)  # Allow tool to proceed if we can't parse input

    # Extract tool information
    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only process file-modifying tools
    if tool_name not in ["Write", "Edit", "MultiEdit"]:
        sys.exit(0)

    # Extract file path
    file_path = extract_file_path(tool_name, tool_input)
    if not file_path:
        sys.exit(0)

    # Check if this is a protected file
    is_protected, reason = is_protected_file(file_path)

    if not is_protected:
        sys.exit(0)

    # Create unique warning key
    warning_key = f"{file_path}"

    # Load existing warnings for this session
    shown_warnings = load_state(session_id)

    # Skip if already warned in this session
    if warning_key in shown_warnings:
        debug_log(f"Already warned about {file_path}, allowing")
        sys.exit(0)

    # Record this warning
    shown_warnings.add(warning_key)
    save_state(session_id, shown_warnings)

    # Build warning message
    warning_message = f"""⚠️  SENSITIVE FILE GUARD — Modification Blocked

  File:   {file_path}
  Reason: {reason}

This file is classified as a sensitive infrastructure file. Accidental
modifications can break deployments, leak secrets, or cause dependency
conflicts.

Common risks:
  • .env files may contain API keys and secrets
  • Lockfiles ensure reproducible builds — manual edits cause drift
  • CI/CD configs control deployment pipelines
  • Crypto keys are irreplaceable credentials

To proceed, explicitly confirm you intend to modify this file.
To disable this guard, set SENSITIVE_FILE_GUARD_ENABLED=0."""

    # Output warning to stderr and block the operation
    print(warning_message, file=sys.stderr)
    sys.exit(2)  # Exit code 2 blocks the tool in PreToolUse hooks


if __name__ == "__main__":
    main()
