#!/usr/bin/env python3
"""
bash-guard: PreToolUse hook that enforces permissions.deny rules on every
segment of compound bash commands.

Bug being fixed (anthropics/claude-code#36637):
  Claude Code's built-in permission checker evaluates compound commands
  (e.g. "git status && rm -rf /") against allow/deny rules as a single
  string, which means:
    - "git status && rm -rf /" matches the allow rule "Bash(git status*)"
      on the first token only, granting the whole command.
    - The deny rule "Bash(rm -rf /)" never fires because the full string
      doesn't start with "rm -rf /".

This hook splits the command on shell operators (&&, ||, ;, |) while
respecting quoting, then evaluates EACH segment independently against
the deny rules from ~/.claude/settings.json (and the project-local
.claude/settings.json).  If ANY segment would be denied, the entire
command is blocked.
"""

import fnmatch
import json
import os
import re
import sys


# ---------------------------------------------------------------------------
# Settings loading
# ---------------------------------------------------------------------------

def _load_json_safe(path: str) -> dict:
    """Read a JSON file, returning {} on any error."""
    try:
        with open(path) as fh:
            return json.load(fh)
    except Exception:
        return {}


def load_deny_patterns() -> list[str]:
    """
    Return the list of raw Bash deny patterns from the active settings.

    Merges (project overrides global):
      1. ~/.claude/settings.json          (global)
      2. <cwd>/.claude/settings.json      (project-local)
      3. <cwd>/.claude/settings.local.json (project-local, untracked)

    Each entry in permissions.deny looks like one of:
      "Bash(rm -rf /)"
      "Bash(git push --force *)"
      "Bash(dd if=*)"
    """
    candidates = [
        os.path.expanduser("~/.claude/settings.json"),
        os.path.join(os.getcwd(), ".claude", "settings.json"),
        os.path.join(os.getcwd(), ".claude", "settings.local.json"),
    ]

    patterns: list[str] = []
    for path in candidates:
        data = _load_json_safe(path)
        deny_list = data.get("permissions", {}).get("deny", [])
        for entry in deny_list:
            if isinstance(entry, str) and entry.startswith("Bash(") and entry.endswith(")"):
                # Extract inner pattern: Bash(rm -rf /) → "rm -rf /"
                patterns.append(entry[5:-1])

    return patterns


# ---------------------------------------------------------------------------
# Command splitter
# ---------------------------------------------------------------------------

def split_compound_command(command: str) -> list[str]:
    """
    Split a bash command string into individual segments, honouring quoting.

    Operators recognised:  &&   ||   ;   |
    Quoting respected:     ' "  `  (no nested subshell parsing – conservative)

    Returns a list of stripped non-empty segment strings.
    """
    segments: list[str] = []
    current: list[str] = []
    i = 0
    length = len(command)
    in_single = False
    in_double = False
    in_backtick = False

    while i < length:
        c = command[i]

        # Track quoting state
        if c == "'" and not in_double and not in_backtick:
            in_single = not in_single
            current.append(c)
            i += 1
            continue

        if c == '"' and not in_single and not in_backtick:
            in_double = not in_double
            current.append(c)
            i += 1
            continue

        if c == '`' and not in_single and not in_double:
            in_backtick = not in_backtick
            current.append(c)
            i += 1
            continue

        # Handle backslash escapes outside single quotes
        if c == '\\' and not in_single and i + 1 < length:
            current.append(c)
            current.append(command[i + 1])
            i += 2
            continue

        if not in_single and not in_double and not in_backtick:
            # Two-character operators: && and ||
            if i + 1 < length and command[i:i + 2] in ('&&', '||'):
                seg = ''.join(current).strip()
                if seg:
                    segments.append(seg)
                current = []
                i += 2
                continue

            # Single-character operators: ; and |  (but not ||, handled above)
            if c in (';', '|'):
                seg = ''.join(current).strip()
                if seg:
                    segments.append(seg)
                current = []
                i += 1
                continue

        current.append(c)
        i += 1

    # Remaining segment
    seg = ''.join(current).strip()
    if seg:
        segments.append(seg)

    return segments


# ---------------------------------------------------------------------------
# Deny pattern matching
# ---------------------------------------------------------------------------

# Strip leading env-var assignments and redirections so that
#   FOO=bar rm -rf /  →  "rm -rf /"
_ENV_PREFIX_RE = re.compile(
    r'^(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+)*'   # VAR=val ...
    r'(?:(?:>>?|<)\s*\S+\s*)*'                   # redirections (leading)
)


def _normalise_segment(segment: str) -> str:
    """Strip env-var prefixes and leading redirections from a segment."""
    return _ENV_PREFIX_RE.sub('', segment).strip()


def segment_matches_deny(segment: str, deny_patterns: list[str]) -> str | None:
    """
    Return the first matching deny pattern if the segment is denied, else None.

    Matching semantics mirror Claude Code's built-in prefix mode:
      - Patterns without '*': the segment must START WITH the pattern
        (after normalisation), case-sensitive.
      - Patterns with '*': fnmatch is used (glob-style).

    The normalised segment is also checked so that env-var prefixes cannot
    be used to defeat a deny rule (e.g. "X=1 rm -rf /").
    """
    normalised = _normalise_segment(segment)

    for pattern in deny_patterns:
        for candidate in (segment, normalised):
            candidate = candidate.strip()
            if '*' in pattern or '?' in pattern or '[' in pattern:
                # Glob match: treat the pattern as a prefix glob
                # "rm -rf /*"  should match "rm -rf /tmp"
                if fnmatch.fnmatch(candidate, pattern):
                    return pattern
                # Also try prefix: "rm -rf *" → startswith("rm -rf ")
                prefix = pattern.rstrip('*').rstrip()
                if prefix and candidate.startswith(prefix):
                    return pattern
            else:
                # Exact prefix match (no glob): segment must start with pattern
                if candidate == pattern or candidate.startswith(pattern + ' ') or candidate.startswith(pattern + '\t'):
                    return pattern

    return None


# ---------------------------------------------------------------------------
# Hook entry point
# ---------------------------------------------------------------------------

def main() -> None:
    try:
        raw = sys.stdin.read()
        input_data = json.loads(raw)
    except Exception:
        sys.exit(0)  # Parse failure → allow (fail open so we don't block every command)

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    command = input_data.get("tool_input", {}).get("command", "")
    if not command:
        sys.exit(0)

    deny_patterns = load_deny_patterns()
    if not deny_patterns:
        sys.exit(0)  # No deny rules configured

    segments = split_compound_command(command)

    # A single-segment command is already handled by Claude Code's built-in
    # checker.  We only need to act on compound commands where the bypass
    # is possible.
    if len(segments) <= 1:
        sys.exit(0)

    for segment in segments:
        matched = segment_matches_deny(segment, deny_patterns)
        if matched:
            message = (
                f"[bash-guard] Compound command blocked — segment '{segment}' "
                f"matches deny rule 'Bash({matched})'.\n\n"
                f"Full command: {command}\n\n"
                "Each segment of a compound command is evaluated independently "
                "against permissions.deny. If any segment is denied, the entire "
                "command is blocked."
            )
            print(message, file=sys.stderr)
            sys.exit(2)  # exit 2 = block (PreToolUse hook convention)

    sys.exit(0)


if __name__ == "__main__":
    main()
