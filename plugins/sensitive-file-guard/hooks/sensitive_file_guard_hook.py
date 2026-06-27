#!/usr/bin/env python3
"""
Sensitive File Guard Hook for Claude Code.

This hook uses structured PreToolUse decisions:
- deny for high-risk files such as .env secrets, private keys, and tfstate
- ask for medium-risk infrastructure files such as Dockerfiles and k8s manifests
- allow for medium-risk files that were already confirmed in-session

Confirmed files are recorded only after a matching asked tool call succeeds.
"""

from __future__ import annotations

import json
import os
import random
import sys
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/sensitive-file-guard-log.txt"
STATE_VERSION = 2
ASK = "ask"
ALLOW = "allow"
DENY = "deny"


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a", encoding="utf-8") as file_handle:
            file_handle.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass


FILE_CATEGORIES = {
    "environment": "Environment variable file",
    "lockfile": "Package lockfile",
    "container": "Container configuration",
    "ci_cd": "CI/CD pipeline configuration",
    "infrastructure": "Infrastructure configuration",
    "deployment": "Deployment configuration",
    "crypto": "SSH/Cryptographic key file",
}

EXACT_FILE_RULES = {
    # Environment files
    ".env": ("environment", DENY),
    ".env.local": ("environment", DENY),
    ".env.development": ("environment", DENY),
    ".env.staging": ("environment", DENY),
    ".env.production": ("environment", DENY),
    ".env.test": ("environment", DENY),
    ".env.example": ("environment", ASK),
    # Lockfiles
    "package-lock.json": ("lockfile", ASK),
    "yarn.lock": ("lockfile", ASK),
    "pnpm-lock.yaml": ("lockfile", ASK),
    "bun.lockb": ("lockfile", ASK),
    "gemfile.lock": ("lockfile", ASK),
    "pipfile.lock": ("lockfile", ASK),
    "poetry.lock": ("lockfile", ASK),
    "composer.lock": ("lockfile", ASK),
    "go.sum": ("lockfile", ASK),
    "cargo.lock": ("lockfile", ASK),
    "mix.lock": ("lockfile", ASK),
    "pubspec.lock": ("lockfile", ASK),
    "flake.lock": ("lockfile", ASK),
    "shrinkwrap.yaml": ("lockfile", ASK),
    # Container configs
    "dockerfile": ("container", ASK),
    "docker-compose.yml": ("container", ASK),
    "docker-compose.yaml": ("container", ASK),
    "docker-compose.override.yml": ("container", ASK),
    "docker-compose.override.yaml": ("container", ASK),
    ".dockerignore": ("container", ASK),
    # CI/CD configs
    ".gitlab-ci.yml": ("ci_cd", ASK),
    "jenkinsfile": ("ci_cd", ASK),
    ".travis.yml": ("ci_cd", ASK),
    "appveyor.yml": ("ci_cd", ASK),
    "bitbucket-pipelines.yml": ("ci_cd", ASK),
    "azure-pipelines.yml": ("ci_cd", ASK),
    "cloudbuild.yaml": ("ci_cd", ASK),
    "cloudbuild.yml": ("ci_cd", ASK),
    # Infrastructure state
    "terraform.tfstate": ("infrastructure", DENY),
    "terraform.tfstate.backup": ("infrastructure", DENY),
    # Deployment configs
    "vercel.json": ("deployment", ASK),
    "netlify.toml": ("deployment", ASK),
    "fly.toml": ("deployment", ASK),
    "render.yaml": ("deployment", ASK),
    "railway.toml": ("deployment", ASK),
    "procfile": ("deployment", ASK),
    "app.yaml": ("deployment", ASK),
    "app.yml": ("deployment", ASK),
    # SSH/Crypto key filenames
    "id_rsa": ("crypto", DENY),
    "id_rsa.pub": ("crypto", ASK),
    "id_ed25519": ("crypto", DENY),
    "id_ed25519.pub": ("crypto", ASK),
    "id_ecdsa": ("crypto", DENY),
    "id_ecdsa.pub": ("crypto", ASK),
    "authorized_keys": ("crypto", DENY),
    "known_hosts": ("crypto", ASK),
}

EXTENSION_RULES = {
    ".pem": ("crypto", DENY),
    ".key": ("crypto", DENY),
    ".crt": ("crypto", ASK),
    ".cer": ("crypto", ASK),
    ".p12": ("crypto", DENY),
    ".pfx": ("crypto", DENY),
    ".jks": ("crypto", DENY),
    ".keystore": ("crypto", DENY),
    ".tfvars": ("infrastructure", ASK),
}

PATH_RULES = [
    (".github/workflows/", ".yml", "ci_cd", ASK),
    (".github/workflows/", ".yaml", "ci_cd", ASK),
    (".circleci/", "config.yml", "ci_cd", ASK),
    (".circleci/", "config.yaml", "ci_cd", ASK),
    ("k8s/", ".yml", "infrastructure", ASK),
    ("k8s/", ".yaml", "infrastructure", ASK),
    ("kubernetes/", ".yml", "infrastructure", ASK),
    ("kubernetes/", ".yaml", "infrastructure", ASK),
    ("terraform/", ".tf", "infrastructure", ASK),
    ("terraform/", ".tfvars", "infrastructure", ASK),
]


def normalize_path(file_path, cwd=""):
    """Normalize a path for matching and session allowlisting."""
    if not file_path:
        return ""

    normalized = os.path.expanduser(file_path)
    if cwd and not os.path.isabs(normalized):
        normalized = os.path.join(cwd, normalized)

    normalized = os.path.abspath(normalized)
    normalized = os.path.normpath(normalized)
    normalized = os.path.normcase(normalized)
    return normalized.replace("\\", "/")


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
        pass


def load_state(session_id):
    """Load session state while ignoring legacy warning-only state."""
    state_file = get_state_file(session_id)
    if not os.path.exists(state_file):
        return {
            "version": STATE_VERSION,
            "allowed_files": set(),
            "pending_requests": {},
        }

    try:
        with open(state_file, "r", encoding="utf-8") as file_handle:
            raw_state = json.load(file_handle)
    except (json.JSONDecodeError, IOError):
        return {
            "version": STATE_VERSION,
            "allowed_files": set(),
            "pending_requests": {},
        }

    if isinstance(raw_state, list):
        # Legacy versions stored "warned" files, which must not be treated as confirmed.
        return {
            "version": STATE_VERSION,
            "allowed_files": set(),
            "pending_requests": {},
        }

    allowed_files = raw_state.get("allowed_files", [])
    if not isinstance(allowed_files, list):
        allowed_files = []

    pending_requests = raw_state.get("pending_requests", {})
    if not isinstance(pending_requests, dict):
        pending_requests = {}

    return {
        "version": STATE_VERSION,
        "allowed_files": set(allowed_files),
        "pending_requests": pending_requests,
    }


def save_state(session_id, state):
    """Persist session allowlist state."""
    state_file = get_state_file(session_id)
    payload = {
        "version": STATE_VERSION,
        "allowed_files": sorted(state["allowed_files"]),
        "pending_requests": state["pending_requests"],
    }
    try:
        os.makedirs(os.path.dirname(state_file), exist_ok=True)
        with open(state_file, "w", encoding="utf-8") as file_handle:
            json.dump(payload, file_handle)
    except IOError as error:
        debug_log(f"Failed to save state file: {error}")


def build_reason(category, filename, detail=""):
    """Create a user-facing reason string."""
    category_label = FILE_CATEGORIES.get(category, "Sensitive file")
    if detail:
        return f"{category_label}: {filename} ({detail})"
    return f"{category_label}: {filename}"


def classify_file(file_path, cwd=""):
    """
    Classify a file path if it matches a protected rule.

    Returns:
        dict with path, filename, category, risk, reason, or None.
    """
    normalized_path = normalize_path(file_path, cwd)
    if not normalized_path:
        return None

    filename = os.path.basename(normalized_path)
    lower_filename = filename.lower()
    _, extension = os.path.splitext(lower_filename)

    if lower_filename in EXACT_FILE_RULES:
        category, risk = EXACT_FILE_RULES[lower_filename]
        return {
            "path": normalized_path,
            "filename": filename,
            "category": category,
            "risk": risk,
            "reason": build_reason(category, filename),
        }

    if extension in EXTENSION_RULES:
        category, risk = EXTENSION_RULES[extension]
        return {
            "path": normalized_path,
            "filename": filename,
            "category": category,
            "risk": risk,
            "reason": build_reason(category, filename, f"{extension} extension"),
        }

    for directory_pattern, filename_pattern, category, risk in PATH_RULES:
        if directory_pattern not in normalized_path:
            continue

        if filename_pattern.startswith("."):
            if lower_filename.endswith(filename_pattern):
                return {
                    "path": normalized_path,
                    "filename": filename,
                    "category": category,
                    "risk": risk,
                    "reason": build_reason(
                        category, filename, f"in {directory_pattern}"
                    ),
                }
            continue

        if lower_filename == filename_pattern:
            return {
                "path": normalized_path,
                "filename": filename,
                "category": category,
                "risk": risk,
                "reason": build_reason(category, filename, f"in {directory_pattern}"),
            }

    return None


def extract_file_path(tool_input):
    """Extract a file path from Write/Edit/MultiEdit input."""
    if not isinstance(tool_input, dict):
        return ""
    return tool_input.get("file_path", "")


def extract_tool_use_id(input_data):
    """Extract the current tool call ID if present."""
    tool_use_id = input_data.get("tool_use_id", "")
    if isinstance(tool_use_id, str):
        return tool_use_id
    return ""


def emit_json(payload):
    """Emit hook JSON to stdout."""
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")


def emit_pretool_decision(permission_decision, reason):
    """Emit a structured PreToolUse decision."""
    emit_json(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": permission_decision,
                "permissionDecisionReason": reason,
            }
        }
    )


def handle_pre_tool_use(input_data):
    """Handle PreToolUse by deny/ask/allow based on file risk and session state."""
    session_id = input_data.get("session_id", "default")
    cwd = input_data.get("cwd", "")
    tool_input = input_data.get("tool_input", {})
    file_path = extract_file_path(tool_input)
    if not file_path:
        return

    match = classify_file(file_path, cwd)
    if not match:
        return

    state = load_state(session_id)
    file_key = match["path"]
    tool_use_id = extract_tool_use_id(input_data)

    if match["risk"] == DENY:
        emit_pretool_decision(
            DENY,
            (
                f"Sensitive File Guard blocked {match['reason']}. "
                "Use a safer workflow than direct Claude edits for secrets, private keys, or tfstate files."
            ),
        )
        return

    if file_key in state["allowed_files"]:
        emit_pretool_decision(
            ALLOW,
            f"Previously confirmed this session: {match['reason']}",
        )
        return

    if tool_use_id:
        state["pending_requests"][tool_use_id] = {
            "path": file_key,
            "reason": match["reason"],
        }
        save_state(session_id, state)

    emit_pretool_decision(
        ASK,
        (
            f"Sensitive File Guard requires confirmation before editing {match['reason']}. "
            "If you approve and the edit runs, this file will be auto-allowed for the rest of the session."
        ),
    )


def handle_post_tool_use(input_data):
    """Record confirmed medium-risk files only after the edit reaches PostToolUse."""
    session_id = input_data.get("session_id", "default")
    cwd = input_data.get("cwd", "")
    tool_input = input_data.get("tool_input", {})
    file_path = extract_file_path(tool_input)
    if not file_path:
        return

    tool_use_id = extract_tool_use_id(input_data)
    match = classify_file(file_path, cwd)
    if not match or match["risk"] != ASK or not tool_use_id:
        return

    state = load_state(session_id)
    file_key = match["path"]
    pending_request = state["pending_requests"].pop(tool_use_id, None)

    if not pending_request:
        save_state(session_id, state)
        return

    if pending_request.get("path") != file_key:
        save_state(session_id, state)
        debug_log(
            f"Skipped allowlisting due to path mismatch for tool call {tool_use_id}: "
            f"pending={pending_request.get('path')} current={file_key}"
        )
        return

    if file_key in state["allowed_files"]:
        save_state(session_id, state)
        return

    state["allowed_files"].add(file_key)
    save_state(session_id, state)
    debug_log(f"Recorded confirmed sensitive file for session allowlist: {file_key}")


def handle_post_tool_use_failure(input_data):
    """Clear pending confirmation state when an asked tool call fails."""
    session_id = input_data.get("session_id", "default")
    tool_use_id = extract_tool_use_id(input_data)
    if not tool_use_id:
        return

    state = load_state(session_id)
    if tool_use_id not in state["pending_requests"]:
        return

    state["pending_requests"].pop(tool_use_id, None)
    save_state(session_id, state)
    debug_log(f"Cleared pending sensitive file request after failure: {tool_use_id}")


def main():
    """Main hook function."""
    if os.environ.get("SENSITIVE_FILE_GUARD_ENABLED", "1") == "0":
        debug_log("Sensitive file guard disabled by environment variable")
        return

    if random.random() < 0.1:
        cleanup_old_state_files()

    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        debug_log(f"JSON decode error: {error}")
        return

    tool_name = input_data.get("tool_name", "")
    if tool_name not in ["Write", "Edit", "MultiEdit"]:
        return

    hook_event_name = input_data.get("hook_event_name", "PreToolUse")
    if hook_event_name == "PreToolUse":
        handle_pre_tool_use(input_data)
    elif hook_event_name == "PostToolUse":
        handle_post_tool_use(input_data)
    elif hook_event_name == "PostToolUseFailure":
        handle_post_tool_use_failure(input_data)


if __name__ == "__main__":
    main()
