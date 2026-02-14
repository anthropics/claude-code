#!/usr/bin/env python3
"""
cache_policy.py — Per-tool caching rules.

Each tool has a CachePolicy that defines:
  - Whether the tool is cacheable
  - TTL for cached results
  - Key normalization (which input fields matter for cache identity)
  - Invalidation triggers (which tool calls should bust the cache)
  - File-aware caching (check mtime for file-based tools)

Tool classification:
  ┌─────────────┬────────────┬──────────┬──────────────────────────────────┐
  │ Tool        │ Cacheable  │ TTL      │ Strategy                         │
  ├─────────────┼────────────┼──────────┼──────────────────────────────────┤
  │ Read        │ Yes        │ mtime    │ Invalidate when file modified    │
  │ Glob        │ Yes        │ 30 min   │ Pattern + path based key         │
  │ Grep        │ Yes        │ 30 min   │ Pattern + path + options key     │
  │ WebFetch    │ Yes        │ 15 min   │ URL + prompt based key           │
  │ WebSearch   │ Yes        │ 5 min    │ Query + domains based key        │
  │ Bash        │ Conditional│ 5 min    │ Only idempotent commands cached  │
  │ Edit        │ No         │ -        │ Mutating — invalidates Read cache│
  │ Write       │ No         │ -        │ Mutating — invalidates Read cache│
  ├─────────────┼────────────┼──────────┼──────────────────────────────────┤
  │ web_search  │ Yes        │ 5 min    │ Server-side (API-level only)     │
  │ web_fetch   │ Yes        │ 15 min   │ Server-side (API-level only)     │
  │ code_exec   │ No         │ -        │ Stateful sandbox                 │
  │ memory      │ No         │ -        │ Always current                   │
  │ bash (API)  │ Conditional│ 5 min    │ Same as CLI bash                 │
  │ computer    │ No         │ -        │ Side effects                     │
  │ text_editor │ View only  │ mtime    │ Only 'view' command cached       │
  └─────────────┴────────────┴──────────┴──────────────────────────────────┘
"""

import os
import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CachePolicy:
    """Caching rules for a specific tool."""
    tool_name: str
    cacheable: bool = True
    ttl_seconds: int = 300          # Default: 5 minutes
    use_mtime: bool = False         # Check file mtime for invalidation
    key_fields: list = field(default_factory=list)  # Input fields for cache key
    ignore_fields: list = field(default_factory=list)  # Input fields to exclude
    invalidates: list = field(default_factory=list)  # Tools whose cache this invalidates


# ─── Bash Command Classification ────────────────────────────────────────────

# Read-only commands safe to cache
_IDEMPOTENT_PREFIXES = (
    "git status", "git log", "git diff", "git branch", "git remote",
    "git show", "git rev-parse", "git describe", "git tag",
    "ls", "pwd", "whoami", "hostname", "uname",
    "which", "type", "file", "stat", "wc",
    "node --version", "npm --version", "python --version", "python3 --version",
    "npm list", "npm ls", "npm view", "npx --version",
    "gh pr view", "gh pr list", "gh issue view", "gh issue list",
    "gh api", "gh repo view",
    "neonctl branches list", "neonctl connection-string",
    "vercel ls", "vercel inspect",
    "date", "cal", "env", "printenv",
    "jq", "yq",
)

# Commands with side effects — never cache
_MUTATING_PREFIXES = (
    "git add", "git commit", "git push", "git pull", "git fetch",
    "git merge", "git rebase", "git reset", "git checkout", "git switch",
    "git stash", "git cherry-pick", "git revert", "git clean",
    "rm", "mv", "cp", "mkdir", "rmdir", "touch", "chmod", "chown",
    "npm install", "npm ci", "npm run", "npm exec", "npm publish",
    "npx", "yarn", "pnpm",
    "pip install", "pip uninstall",
    "docker", "kubectl", "terraform",
    "curl -X POST", "curl -X PUT", "curl -X DELETE", "curl -X PATCH",
    "gh pr create", "gh pr merge", "gh pr close", "gh issue create",
    "neonctl branches create", "neonctl branches delete", "neonctl branches reset",
    "vercel deploy", "vercel build", "vercel pull", "vercel env",
    "kill", "pkill",
)


def is_bash_cacheable(command: str) -> bool:
    """Determine if a bash command is safe to cache."""
    cmd = command.strip().lower()

    # Never cache mutating commands
    for prefix in _MUTATING_PREFIXES:
        if cmd.startswith(prefix.lower()):
            return False

    # Cache known idempotent commands
    for prefix in _IDEMPOTENT_PREFIXES:
        if cmd.startswith(prefix.lower()):
            return True

    # Pipes starting with idempotent commands are OK
    if "|" in cmd:
        first_cmd = cmd.split("|")[0].strip()
        return is_bash_cacheable(first_cmd)

    # Default: don't cache unknown commands
    return False


# ─── Policy Registry ────────────────────────────────────────────────────────

# Claude Code CLI tools
TOOL_POLICIES = {
    "Read": CachePolicy(
        tool_name="Read",
        cacheable=True,
        ttl_seconds=-1,            # No TTL — use mtime
        use_mtime=True,
        key_fields=["file_path", "offset", "limit", "pages"],
    ),
    "Glob": CachePolicy(
        tool_name="Glob",
        cacheable=True,
        ttl_seconds=1800,          # 30 minutes
        key_fields=["pattern", "path"],
    ),
    "Grep": CachePolicy(
        tool_name="Grep",
        cacheable=True,
        ttl_seconds=1800,          # 30 minutes
        key_fields=["pattern", "path", "type", "glob", "output_mode",
                     "-A", "-B", "-C", "-i", "-n", "multiline",
                     "head_limit", "offset"],
    ),
    "WebFetch": CachePolicy(
        tool_name="WebFetch",
        cacheable=True,
        ttl_seconds=900,           # 15 minutes
        key_fields=["url", "prompt"],
    ),
    "WebSearch": CachePolicy(
        tool_name="WebSearch",
        cacheable=True,
        ttl_seconds=300,           # 5 minutes
        key_fields=["query", "allowed_domains", "blocked_domains"],
    ),
    "Bash": CachePolicy(
        tool_name="Bash",
        cacheable=True,            # Conditional — checked per-command
        ttl_seconds=300,           # 5 minutes
        key_fields=["command"],
    ),

    # Mutating tools — not cached, but invalidate other caches
    "Edit": CachePolicy(
        tool_name="Edit",
        cacheable=False,
        invalidates=["Read", "Grep", "Glob"],
    ),
    "Write": CachePolicy(
        tool_name="Write",
        cacheable=False,
        invalidates=["Read", "Grep", "Glob"],
    ),
}

# Claude API tools
API_TOOL_POLICIES = {
    "web_search": CachePolicy(
        tool_name="web_search",
        cacheable=True,
        ttl_seconds=300,
        key_fields=["query", "allowed_domains", "blocked_domains"],
    ),
    "web_fetch": CachePolicy(
        tool_name="web_fetch",
        cacheable=True,
        ttl_seconds=900,
        key_fields=["url"],
    ),
    "code_execution": CachePolicy(
        tool_name="code_execution",
        cacheable=False,
    ),
    "memory": CachePolicy(
        tool_name="memory",
        cacheable=False,
    ),
    "bash": CachePolicy(
        tool_name="bash",
        cacheable=True,
        ttl_seconds=300,
        key_fields=["command"],
    ),
    "computer_use": CachePolicy(
        tool_name="computer_use",
        cacheable=False,
    ),
    "text_editor": CachePolicy(
        tool_name="text_editor",
        cacheable=True,            # Only 'view' command
        ttl_seconds=-1,
        use_mtime=True,
        key_fields=["command", "path"],
    ),
}


def get_policy(tool_name: str) -> CachePolicy:
    """Get cache policy for a tool. Falls back to non-cacheable."""
    return (
        TOOL_POLICIES.get(tool_name)
        or API_TOOL_POLICIES.get(tool_name)
        or CachePolicy(tool_name=tool_name, cacheable=False)
    )


def should_cache(tool_name: str, tool_input: dict) -> bool:
    """Determine if a specific tool call should be cached."""
    policy = get_policy(tool_name)

    if not policy.cacheable:
        return False

    # Bash: check if the specific command is idempotent
    if tool_name in ("Bash", "bash"):
        command = tool_input.get("command", "")
        return is_bash_cacheable(command)

    # text_editor: only cache 'view' command
    if tool_name == "text_editor":
        return tool_input.get("command") == "view"

    return True


def get_file_mtime(tool_input: dict) -> Optional[float]:
    """Get file modification time if the tool operates on a file."""
    file_path = tool_input.get("file_path") or tool_input.get("path")
    if file_path and os.path.exists(file_path):
        return os.path.getmtime(file_path)
    return None
