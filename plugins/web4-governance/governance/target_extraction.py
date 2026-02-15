# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Multi-Target Extraction
# https://github.com/dp-web4/web4
"""
Multi-Target Extraction for Bash Commands and Task Prompts.

Extracts all identifiable targets (file paths, URLs, patterns) from
tool parameters for comprehensive audit trails and policy evaluation.

Usage:
    from governance.target_extraction import extract_targets, extract_target

    # Extract primary target
    target = extract_target("Bash", {"command": "cat /etc/passwd"})

    # Extract all targets (for multi-file operations)
    targets = extract_targets("Bash", {"command": "rm -rf /tmp/a /tmp/b"})
    # Returns: ["/tmp/a", "/tmp/b"]
"""

import re
from typing import Dict, Any, List, Optional


# Credential file patterns
CREDENTIAL_PATTERNS = [
    re.compile(r"\.env$", re.IGNORECASE),
    re.compile(r"\.env\.[^/]+$", re.IGNORECASE),
    re.compile(r"credentials\.[^/]+$", re.IGNORECASE),
    re.compile(r"secrets?\.[^/]+$", re.IGNORECASE),
    re.compile(r"\.aws/credentials$", re.IGNORECASE),
    re.compile(r"\.ssh/id_[^/]+$", re.IGNORECASE),
    re.compile(r"\.ssh/known_hosts$", re.IGNORECASE),
    re.compile(r"\.netrc$", re.IGNORECASE),
    re.compile(r"\.pgpass$", re.IGNORECASE),
    re.compile(r"\.npmrc$", re.IGNORECASE),
    re.compile(r"\.pypirc$", re.IGNORECASE),
    re.compile(r"token[^/]*\.json$", re.IGNORECASE),
    re.compile(r"auth[^/]*\.json$", re.IGNORECASE),
    re.compile(r"apikey[^/]*$", re.IGNORECASE),
    re.compile(r"\.docker/config\.json$", re.IGNORECASE),
    re.compile(r"\.kube/config$", re.IGNORECASE),
    re.compile(r"\.gnupg/", re.IGNORECASE),
    re.compile(r"\.gpg/", re.IGNORECASE),
]

# Memory file patterns
MEMORY_FILE_PATTERNS = [
    re.compile(r"MEMORY\.md$", re.IGNORECASE),
    re.compile(r"memory\.md$", re.IGNORECASE),
    re.compile(r"/memory/[^/]+\.md$", re.IGNORECASE),
    re.compile(r"\.web4/.*memory", re.IGNORECASE),
    re.compile(r"\.claude/.*memory", re.IGNORECASE),
]


def is_credential_target(target: Optional[str]) -> bool:
    """
    Check if a target path matches credential file patterns.

    Args:
        target: File path or target string

    Returns:
        True if target matches a credential pattern
    """
    if not target:
        return False
    return any(pattern.search(target) for pattern in CREDENTIAL_PATTERNS)


def is_memory_target(target: Optional[str]) -> bool:
    """
    Check if a target path matches memory file patterns.

    Args:
        target: File path or target string

    Returns:
        True if target matches a memory file pattern
    """
    if not target:
        return False
    return any(pattern.search(target) for pattern in MEMORY_FILE_PATTERNS)


def extract_target(tool_name: str, params: Dict[str, Any]) -> Optional[str]:
    """
    Extract the primary target from tool parameters.

    Args:
        tool_name: Name of the tool (e.g., "Bash", "Read")
        params: Tool parameters dictionary

    Returns:
        Primary target string, or None if not identifiable
    """
    if params.get("file_path"):
        return str(params["file_path"])
    if params.get("path"):
        return str(params["path"])
    if params.get("pattern"):
        return str(params["pattern"])
    if params.get("command"):
        cmd = str(params["command"])
        return cmd[:80] + "..." if len(cmd) > 80 else cmd
    if params.get("url"):
        return str(params["url"])
    return None


def extract_targets(tool_name: str, params: Dict[str, Any]) -> List[str]:
    """
    Extract all targets from tool parameters for multi-file operations.

    Returns an array of all identifiable targets (paths, patterns, URLs).
    Useful for comprehensive audit trails and policy evaluation.

    Args:
        tool_name: Name of the tool
        params: Tool parameters dictionary

    Returns:
        List of unique target strings
    """
    targets: List[str] = []

    # Direct file paths
    if params.get("file_path"):
        targets.append(str(params["file_path"]))
    if params.get("path"):
        targets.append(str(params["path"]))

    # Glob patterns (may match multiple files)
    if params.get("pattern"):
        targets.append(str(params["pattern"]))

    # URLs
    if params.get("url"):
        targets.append(str(params["url"]))

    # Bash commands - extract file paths from command string
    if params.get("command") and tool_name == "Bash":
        cmd = str(params["command"])
        extracted = _extract_paths_from_command(cmd)
        targets.extend(extracted)

    # Task tool - check for file references in prompt
    if params.get("prompt") and tool_name == "Task":
        prompt = str(params["prompt"])
        extracted = _extract_paths_from_text(prompt)
        targets.extend(extracted)

    # Grep tool - may have additional glob context
    if params.get("glob") and tool_name == "Grep":
        targets.append(str(params["glob"]))

    # Deduplicate and return
    return list(dict.fromkeys(targets))  # Preserves order, removes duplicates


def _extract_paths_from_command(cmd: str) -> List[str]:
    """
    Extract file paths from a bash command string.

    Identifies common path patterns in commands.
    """
    paths: List[str] = []

    # Match absolute paths
    for match in re.finditer(r"(?:^|\s)(/[^\s;|&<>'\"]+)", cmd):
        path = match.group(1)
        # Filter out common non-file paths
        if not any(path.startswith(prefix) for prefix in ["/dev/", "/proc/", "/sys/"]):
            paths.append(path)

    # Match relative paths with common extensions
    for match in re.finditer(r"(?:^|\s)(\.{0,2}/[^\s;|&<>'\"]+\.[a-zA-Z0-9]+)", cmd):
        paths.append(match.group(1))

    # Match home directory paths
    for match in re.finditer(r"(?:^|\s)(~/[^\s;|&<>'\"]+)", cmd):
        paths.append(match.group(1))

    return paths


def _extract_paths_from_text(text: str) -> List[str]:
    """
    Extract file paths mentioned in text (e.g., Task prompts).

    Looks for path-like patterns in quotes, backticks, or standalone.
    """
    paths: List[str] = []

    # Match paths in backticks or quotes
    for match in re.finditer(r"[`\"']([/~][^`\"'\s]+)[`\"']", text):
        paths.append(match.group(1))

    # Match standalone absolute paths with extensions
    for match in re.finditer(r"\s(/[^\s,;:]+\.[a-zA-Z0-9]+)", text):
        paths.append(match.group(1))

    return paths


# Tool category mapping
TOOL_CATEGORIES = {
    "Read": "file_read",
    "Glob": "file_read",
    "Grep": "file_read",
    "Write": "file_write",
    "Edit": "file_write",
    "NotebookEdit": "file_write",
    "Bash": "command",
    "WebFetch": "network",
    "WebSearch": "network",
    "Task": "delegation",
    "TodoWrite": "state",
}


def classify_tool(tool_name: str) -> str:
    """
    Classify a tool into a category.

    Args:
        tool_name: Name of the tool

    Returns:
        Category string (file_read, file_write, command, network, delegation, state, unknown)
    """
    return TOOL_CATEGORIES.get(tool_name, "unknown")


def classify_tool_with_target(tool_name: str, target: Optional[str]) -> str:
    """
    Classify tool with target context - may upgrade to credential_access
    if the target matches credential file patterns.

    Args:
        tool_name: Name of the tool
        target: Target file path or string

    Returns:
        Category string, possibly upgraded to "credential_access"
    """
    base_category = TOOL_CATEGORIES.get(tool_name, "unknown")

    # Upgrade file_read/file_write to credential_access if target matches patterns
    if base_category in ("file_read", "file_write") and is_credential_target(target):
        return "credential_access"

    return base_category
