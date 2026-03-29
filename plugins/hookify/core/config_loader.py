#!/usr/bin/env python3
"""Configuration loader for hookify plugin.

Loads and parses .claude/hookify.*.local.md files.
"""

import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class Condition:
    """A single condition for matching."""

    field: str  # "command", "new_text", "old_text", "file_path", etc.
    operator: str  # "regex_match", "contains", "equals", etc.
    pattern: str  # Pattern to match

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Condition":
        """Create Condition from dict."""
        return cls(
            field=data.get("field", ""),
            operator=data.get("operator", "regex_match"),
            pattern=data.get("pattern", ""),
        )


@dataclass
class Rule:
    """A hookify rule."""

    name: str
    enabled: bool
    event: str  # "bash", "file", "stop", "all", etc.
    pattern: str | None = None  # Simple pattern (legacy)
    conditions: list[Condition] = field(default_factory=list)
    action: str = "warn"  # "warn" or "block" (future)
    tool_matcher: str | None = None  # Override tool matching
    message: str = ""  # Message body from markdown
    scope: str = "project"  # "project" or "global"

    @classmethod
    def from_dict(cls, frontmatter: dict[str, Any], message: str) -> "Rule":
        """Create Rule from frontmatter dict and message body."""
        # Handle both simple pattern and complex conditions
        conditions = []

        # New style: explicit conditions list
        if "conditions" in frontmatter:
            cond_list = frontmatter["conditions"]
            if isinstance(cond_list, list):
                conditions = [Condition.from_dict(c) for c in cond_list]

        # Legacy style: simple pattern field
        simple_pattern = frontmatter.get("pattern")
        if simple_pattern and not conditions:
            # Convert simple pattern to condition
            # Infer field from event
            event = frontmatter.get("event", "all")
            if event == "bash":
                field = "command"
            elif event == "file":
                field = "new_text"
            else:
                field = "content"

            conditions = [
                Condition(
                    field=field,
                    operator="regex_match",
                    pattern=simple_pattern,
                ),
            ]

        return cls(
            name=frontmatter.get("name", "unnamed"),
            enabled=frontmatter.get("enabled", True),
            event=frontmatter.get("event", "all"),
            pattern=simple_pattern,
            conditions=conditions,
            action=frontmatter.get("action", "warn"),
            tool_matcher=frontmatter.get("tool_matcher"),
            message=message.strip(),
        )


def extract_frontmatter(content: str) -> tuple[dict[str, Any], str]:
    """Extract YAML frontmatter and message body from markdown.

    Returns (frontmatter_dict, message_body).

    Supports multi-line dictionary items in lists by preserving indentation.
    """
    if not content.startswith("---"):
        return {}, content

    # Split on --- markers
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content

    frontmatter_text = parts[1]
    message = parts[2].strip()

    # Simple YAML parser that handles indented list items
    frontmatter = {}
    lines = frontmatter_text.split("\n")

    current_key = None
    current_list = []
    current_dict = {}
    in_list = False
    in_dict_item = False

    for line in lines:
        # Skip empty lines and comments
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Check indentation level
        indent = len(line) - len(line.lstrip())

        # Top-level key (no indentation or minimal)
        if indent == 0 and ":" in line and not line.strip().startswith("-"):
            # Save previous list/dict if any
            if in_list and current_key:
                if in_dict_item and current_dict:
                    current_list.append(current_dict)
                    current_dict = {}
                frontmatter[current_key] = current_list
                in_list = False
                in_dict_item = False
                current_list = []

            key, value = line.split(":", 1)
            key = key.strip()
            value = value.strip()

            if not value:
                # Empty value - list or nested structure follows
                current_key = key
                in_list = True
                current_list = []
            else:
                # Simple key-value pair
                value = value.strip('"').strip("'")
                if value.lower() == "true":
                    value = True
                elif value.lower() == "false":
                    value = False
                frontmatter[key] = value

        # List item (starts with -)
        elif stripped.startswith("-") and in_list:
            # Save previous dict item if any
            if in_dict_item and current_dict:
                current_list.append(current_dict)
                current_dict = {}

            item_text = stripped[1:].strip()

            # Check if this is an inline dict (key: value on same line)
            if ":" in item_text and "," in item_text:
                # Inline comma-separated dict: "- field: command, operator: regex_match"
                item_dict = {}
                for part in item_text.split(","):
                    if ":" in part:
                        k, v = part.split(":", 1)
                        item_dict[k.strip()] = v.strip().strip('"').strip("'")
                current_list.append(item_dict)
                in_dict_item = False
            elif ":" in item_text:
                # Start of multi-line dict item: "- field: command"
                in_dict_item = True
                k, v = item_text.split(":", 1)
                current_dict = {k.strip(): v.strip().strip('"').strip("'")}
            else:
                # Simple list item
                current_list.append(item_text.strip('"').strip("'"))
                in_dict_item = False

        # Continuation of dict item (indented under list item)
        elif indent > 2 and in_dict_item and ":" in line:
            # This is a field of the current dict item
            k, v = stripped.split(":", 1)
            current_dict[k.strip()] = v.strip().strip('"').strip("'")

    # Save final list/dict if any
    if in_list and current_key:
        if in_dict_item and current_dict:
            current_list.append(current_dict)
        frontmatter[current_key] = current_list

    return frontmatter, message


def _load_rules_from_dir(
    directory: Path,
    scope: str,
    event: str | None,
    merged: dict,
) -> None:
    """Load rules from a directory into a merged dict (name → Rule).

    Rules with the same name overwrite earlier entries, so call global first
    and project second to let project rules win.

    Args:
        directory: Directory path to scan for hookify.*.local.md files.
        scope: "global" or "project" — set on each loaded Rule.
        event: Optional event filter; rules not matching are skipped.
        merged: Dict to update in-place.

    """
    files = directory.glob("hookify.*.md")

    for file_path in files:
        try:
            rule = load_rule_file(file_path, scope=scope)
            if not rule:
                continue

            # Filter by event if specified
            if event and rule.event not in ("all", event):
                continue

            merged[rule.name] = rule

        except (OSError, PermissionError) as e:
            print(f"Warning: Failed to read {file_path}: {e}", file=sys.stderr)
        except (ValueError, KeyError, AttributeError, TypeError) as e:
            print(f"Warning: Failed to parse {file_path}: {e}", file=sys.stderr)
        except Exception as e:
            print(
                f"Warning: Unexpected error loading {file_path} ({type(e).__name__}): {e}",
                file=sys.stderr,
            )


def load_rules(event: str | None = None) -> list[Rule]:
    """Load all hookify rules from global (~/.claude) and project (.claude) directories.

    Global rules are loaded first; project rules overlay them by name so that
    a project rule with the same name as a global rule takes precedence.
    A project rule with enabled=false suppresses the global rule of the same name.

    Args:
        event: Optional event filter ("bash", "file", "stop", etc.)

    Returns:
        List of enabled Rule objects matching the event.

    """
    merged: dict[str, Rule] = {}

    # Load global rules first (from ~/.claude/)
    global_dir = Path.home() / ".claude"
    _load_rules_from_dir(global_dir, scope="global", event=event, merged=merged)

    # Load project rules second (from .claude/ relative to CWD); they overwrite globals by name
    project_dir = Path(".claude")
    _load_rules_from_dir(project_dir, scope="project", event=event, merged=merged)

    # Return only enabled rules
    return [rule for rule in merged.values() if rule.enabled]


def load_rule_file(file_path: str, scope: str = "project") -> Rule | None:
    """Load a single rule file.

    Args:
        file_path: Path to the .local.md rule file.
        scope: "project" or "global" — recorded on the returned Rule.

    Returns:
        Rule object or None if file is invalid.

    """
    try:
        with open(file_path) as f:
            content = f.read()

        frontmatter, message = extract_frontmatter(content)

        if not frontmatter:
            print(
                f"Warning: {file_path} missing YAML frontmatter (must start with ---)",
                file=sys.stderr,
            )
            return None

        rule = Rule.from_dict(frontmatter, message)
        rule.scope = scope
        return rule

    except (OSError, PermissionError) as e:
        print(f"Error: Cannot read {file_path}: {e}", file=sys.stderr)
        return None
    except (ValueError, KeyError, AttributeError, TypeError) as e:
        print(f"Error: Malformed rule file {file_path}: {e}", file=sys.stderr)
        return None
    except UnicodeDecodeError as e:
        print(f"Error: Invalid encoding in {file_path}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(
            f"Error: Unexpected error parsing {file_path} ({type(e).__name__}): {e}",
            file=sys.stderr,
        )
        return None


# For testing
if __name__ == "__main__":
    import sys

    # Test frontmatter parsing
    test_content = """---
name: test-rule
enabled: true
event: bash
pattern: "rm -rf"
---

⚠️ Dangerous command detected!
"""

    fm, msg = extract_frontmatter(test_content)
    print("Frontmatter:", fm)
    print("Message:", msg)

    rule = Rule.from_dict(fm, msg)
    print("Rule:", rule)
