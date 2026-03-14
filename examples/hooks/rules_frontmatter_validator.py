#!/usr/bin/env python3
"""
Claude Code Hook: Rules Frontmatter Validator
===============================================
This hook validates that rules files (.md) in .claude/rules/ use the correct
CSV string syntax for the `paths:` frontmatter field, not YAML array syntax.

Background: The `paths:` field is parsed by an internal CSV parser that expects
a comma-separated string (e.g., `paths: "**/*.ts,**/*.tsx"`). When YAML array
syntax is used (e.g., `paths:\n  - "**/*.ts"`), the YAML parser returns a
JavaScript array which the CSV parser iterates element-by-element instead of
character-by-character, silently producing invalid globs that match nothing.

Related issues:
  - https://github.com/anthropics/claude-code/issues/19377
  - https://github.com/anthropics/claude-code/issues/13905

This hook runs as a PostToolUse hook for Write and Edit tools. When a rules
file is written or edited, it checks the frontmatter for broken `paths:` syntax
and warns the user.

Hook configuration (add to settings.json):

{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/rules_frontmatter_validator.py"
          }
        ]
      }
    ]
  }
}

"""

import json
import re
import sys
from pathlib import Path


def extract_frontmatter(content: str) -> str | None:
    """Extract YAML frontmatter from a markdown file."""
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    return match.group(1) if match else None


def check_paths_syntax(frontmatter: str) -> list[str]:
    """Check for broken paths:/globs: syntax in frontmatter."""
    issues = []

    for field in ("paths", "globs"):
        # Pattern 1: YAML list syntax (field: followed by newline then "  - ")
        if re.search(rf"^{field}:\s*$", frontmatter, re.MULTILINE) and re.search(
            r"^\s+-\s+", frontmatter, re.MULTILINE
        ):
            issues.append(
                f"`{field}:` uses YAML list syntax which silently fails. "
                f'Use CSV string instead: {field}: "glob1,glob2"'
            )

        # Pattern 2: JSON inline array syntax (field: ["...", "..."])
        if re.search(rf"^{field}:\s*\[", frontmatter, re.MULTILINE):
            issues.append(
                f"`{field}:` uses JSON array syntax which silently fails. "
                f'Use CSV string instead: {field}: "glob1,glob2"'
            )

    return issues


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        return

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    # Only check .md files in rules directories
    if not file_path.endswith(".md"):
        return

    rules_indicators = ["/rules/", "/.claude/rules/"]
    if not any(indicator in file_path for indicator in rules_indicators):
        return

    path = Path(file_path)
    if not path.exists():
        return

    try:
        content = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return

    frontmatter = extract_frontmatter(content)
    if not frontmatter:
        return

    issues = check_paths_syntax(frontmatter)
    if issues:
        print(
            f"WARNING: Rules file {path.name} has frontmatter issues:\n"
            + "\n".join(f"  - {issue}" for issue in issues),
            file=sys.stderr,
        )
        print("See: https://github.com/anthropics/claude-code/issues/19377")


if __name__ == "__main__":
    main()
