#!/usr/bin/env python3
"""Configuration loader for hookify plugin.

Loads and parses .claude/hookify.*.local.md files.
"""

import os
import sys
import glob
import json
import re
import subprocess
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field


VALID_RULE_EVENTS = ('bash', 'file', 'stop', 'prompt', 'all')
VALID_RULE_ACTIONS = ('warn', 'block')
VALID_CONDITION_OPERATORS = (
    'regex_match',
    'contains',
    'equals',
    'not_contains',
    'starts_with',
    'ends_with',
)


@dataclass
class Condition:
    """A single condition for matching."""
    field: str  # "command", "new_text", "old_text", "file_path", etc.
    operator: str  # "regex_match", "contains", "equals", etc.
    pattern: str  # Pattern to match

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Condition':
        """Create Condition from dict."""
        if not isinstance(data, dict):
            raise ValueError('each condition must be a mapping')

        field_name = data.get('field', '')
        operator = data.get('operator', 'regex_match')
        pattern = data.get('pattern', '')
        for key, value in (
            ('field', field_name),
            ('operator', operator),
            ('pattern', pattern),
        ):
            if not isinstance(value, str):
                raise ValueError(f"condition '{key}' must be a string")
        if operator not in VALID_CONDITION_OPERATORS:
            allowed = ', '.join(VALID_CONDITION_OPERATORS)
            raise ValueError(
                "condition 'operator' must be one of "
                f"{allowed}; got {operator!r}"
            )

        return cls(
            field=field_name,
            operator=operator,
            pattern=pattern,
        )


@dataclass
class Rule:
    """A hookify rule."""
    name: str
    enabled: bool
    event: str  # "bash", "file", "stop", "all", etc.
    pattern: Optional[str] = None  # Simple pattern (legacy)
    conditions: List[Condition] = field(default_factory=list)
    action: str = "warn"  # "warn" or "block" (future)
    tool_matcher: Optional[str] = None  # Override tool matching
    message: str = ""  # Message body from markdown
    invalid_reason: Optional[str] = None

    @classmethod
    def from_dict(cls, frontmatter: Dict[str, Any], message: str) -> 'Rule':
        """Create Rule from frontmatter dict and message body."""
        if not isinstance(frontmatter, dict):
            raise ValueError('frontmatter must be a mapping')

        name = frontmatter.get('name', 'unnamed')
        enabled = frontmatter.get('enabled', True)
        event = frontmatter.get('event', 'all')
        action = frontmatter.get('action', 'warn')
        tool_matcher = frontmatter.get('tool_matcher')
        simple_pattern = frontmatter.get('pattern')

        for key, value in (
            ('name', name),
            ('event', event),
            ('action', action),
        ):
            if not isinstance(value, str):
                raise ValueError(f"'{key}' must be a string")
        if event not in VALID_RULE_EVENTS:
            allowed = ', '.join(VALID_RULE_EVENTS)
            raise ValueError(
                f"'event' must be one of {allowed}; got {event!r}"
            )
        if action not in VALID_RULE_ACTIONS:
            allowed = ', '.join(VALID_RULE_ACTIONS)
            raise ValueError(
                f"'action' must be one of {allowed}; got {action!r}"
            )
        if not isinstance(enabled, bool):
            raise ValueError("'enabled' must be a boolean")
        if tool_matcher is not None and not isinstance(tool_matcher, str):
            raise ValueError("'tool_matcher' must be a string")
        if simple_pattern is not None and not isinstance(simple_pattern, str):
            raise ValueError("'pattern' must be a string")

        # Handle both simple pattern and complex conditions
        conditions = []

        # New style: explicit conditions list
        if 'conditions' in frontmatter:
            cond_list = frontmatter['conditions']
            if not isinstance(cond_list, list):
                raise ValueError("'conditions' must be a list")
            conditions = [Condition.from_dict(condition) for condition in cond_list]

        # Legacy style: simple pattern field
        if simple_pattern and not conditions:
            # Convert simple pattern to condition
            # Infer field from event
            if event == 'bash':
                field = 'command'
            elif event == 'file':
                field = 'new_text'
            elif event == 'prompt':
                field = 'prompt'
            elif event == 'stop':
                field = 'transcript'
            elif event == 'all':
                field = 'event_content'
            else:
                field = 'content'

            conditions = [Condition(
                field=field,
                operator='regex_match',
                pattern=simple_pattern
            )]

        invalid_reason = None
        for condition in conditions:
            if condition.operator != 'regex_match':
                continue
            try:
                re.compile(condition.pattern, re.IGNORECASE)
            except re.error as error:
                invalid_reason = (
                    f"invalid regular expression {condition.pattern!r}: {error}"
                )
                break

        return cls(
            name=name,
            enabled=enabled,
            event=event,
            pattern=simple_pattern,
            conditions=conditions,
            action=action,
            tool_matcher=tool_matcher,
            message=message.strip(),
            invalid_reason=invalid_reason,
        )


def _strip_inline_comment(value: str) -> str:
    """Remove a YAML-style inline comment outside a quoted scalar."""
    quote = None
    index = 0
    scalar_started = False

    while index < len(value):
        character = value[index]

        if not scalar_started and not character.isspace():
            if character == '#':
                return value[:index].rstrip()
            scalar_started = True
            if character in ('"', "'"):
                quote = character
            index += 1
            continue

        if quote == '"':
            if character == '\\':
                index += 2
                continue
            if character == '"':
                quote = None
        elif quote == "'":
            if (
                character == "'"
                and index + 1 < len(value)
                and value[index + 1] == "'"
            ):
                index += 2
                continue
            if character == "'":
                quote = None
        elif character == '#' and (
            index == 0 or value[index - 1].isspace()
        ):
            return value[:index].rstrip()

        index += 1

    return value.rstrip()


def _parse_scalar(value: str) -> Any:
    """Parse the scalar subset supported by Hookify frontmatter."""
    scalar = _strip_inline_comment(value).strip()
    if not scalar:
        return ''

    if scalar.startswith('"'):
        try:
            parsed = json.loads(scalar)
        except json.JSONDecodeError as error:
            raise ValueError(
                f'invalid double-quoted YAML scalar: {error.msg}'
            ) from error
        if not isinstance(parsed, str):
            raise ValueError('double-quoted YAML scalar must be a string')
        return parsed

    if scalar.startswith("'"):
        if len(scalar) < 2 or not scalar.endswith("'"):
            raise ValueError('unterminated single-quoted YAML scalar')
        return scalar[1:-1].replace("''", "'")

    lowered = scalar.lower()
    if lowered == 'true':
        return True
    if lowered == 'false':
        return False
    return scalar


def extract_frontmatter(content: str) -> tuple[Dict[str, Any], str]:
    """Extract YAML frontmatter and message body from markdown.

    Returns (frontmatter_dict, message_body).

    Supports multi-line dictionary items in lists by preserving indentation.
    """
    lines_with_endings = content.splitlines(keepends=True)
    if (
        not lines_with_endings
        or lines_with_endings[0].rstrip('\r\n') != '---'
    ):
        return {}, content

    closing_index = next(
        (
            index
            for index, line in enumerate(lines_with_endings[1:], start=1)
            if line.rstrip('\r\n') == '---'
        ),
        None,
    )
    if closing_index is None:
        return {}, content

    frontmatter_text = ''.join(lines_with_endings[1:closing_index])
    message = ''.join(lines_with_endings[closing_index + 1:]).strip()

    # Simple YAML parser that handles indented list items
    frontmatter = {}
    lines = frontmatter_text.split('\n')

    current_key = None
    current_list = []
    current_dict = {}
    in_list = False
    in_dict_item = False

    for line in lines:
        # Skip empty lines and comments
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue

        # Check indentation level
        indent = len(line) - len(line.lstrip())

        # Top-level key (no indentation or minimal)
        if indent == 0 and ':' in line and not line.strip().startswith('-'):
            # Save previous list/dict if any
            if in_list and current_key:
                if in_dict_item and current_dict:
                    current_list.append(current_dict)
                    current_dict = {}
                frontmatter[current_key] = current_list
                in_list = False
                in_dict_item = False
                current_list = []

            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()

            if not value:
                # Empty value - list or nested structure follows
                current_key = key
                in_list = True
                current_list = []
            else:
                # Simple key-value pair
                frontmatter[key] = _parse_scalar(value)

        # List item (starts with -)
        elif stripped.startswith('-') and in_list:
            # Save previous dict item if any
            if in_dict_item and current_dict:
                current_list.append(current_dict)
                current_dict = {}

            item_text = stripped[1:].strip()

            # Check if this is an inline dict (key: value on same line)
            if ':' in item_text and ',' in item_text:
                # Inline comma-separated dict: "- field: command, operator: regex_match"
                item_dict = {}
                for part in item_text.split(','):
                    if ':' in part:
                        k, v = part.split(':', 1)
                        item_dict[k.strip()] = _parse_scalar(v)
                current_list.append(item_dict)
                in_dict_item = False
            elif ':' in item_text:
                # Start of multi-line dict item: "- field: command"
                in_dict_item = True
                k, v = item_text.split(':', 1)
                current_dict = {k.strip(): _parse_scalar(v)}
            else:
                # Simple list item
                current_list.append(_parse_scalar(item_text))
                in_dict_item = False

        # Continuation of dict item (indented under list item)
        elif indent > 2 and in_dict_item and ':' in line:
            # This is a field of the current dict item
            k, v = stripped.split(':', 1)
            current_dict[k.strip()] = _parse_scalar(v)

    # Save final list/dict if any
    if in_list and current_key:
        if in_dict_item and current_dict:
            current_list.append(current_dict)
        frontmatter[current_key] = current_list

    return frontmatter, message


def _valid_directory(path: Optional[str]) -> Optional[str]:
    """Return an absolute directory path, or None for an invalid candidate."""
    if not path:
        return None
    try:
        candidate = os.path.abspath(os.path.expanduser(os.fspath(path)))
    except (TypeError, ValueError):
        return None
    return candidate if os.path.isdir(candidate) else None


def _resolve_project_root(root_dir: Optional[str]) -> str:
    """Resolve the project root using the Claude, Git, then cwd contract."""
    project_dir = _valid_directory(os.environ.get('CLAUDE_PROJECT_DIR'))
    if project_dir:
        return project_dir

    payload_cwd = _valid_directory(root_dir) or os.getcwd()
    try:
        completed = subprocess.run(
            ['git', '-C', payload_cwd, 'rev-parse', '--show-toplevel'],
            text=True,
            capture_output=True,
            check=False,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        completed = None

    if completed and completed.returncode == 0:
        git_root = _valid_directory(completed.stdout.strip())
        if git_root:
            return git_root

    return payload_cwd


def load_rules(event: Optional[str] = None, root_dir: Optional[str] = None) -> List[Rule]:
    """Load all hookify rules from .claude directory.

    Args:
        event: Optional event filter ("bash", "file", "stop", etc.)
        root_dir: Project directory from the hook input. Defaults to the
            hook process's current working directory for backwards
            compatibility with direct library callers.

    Returns:
        List of enabled Rule objects matching the event.
    """
    rules = []

    # Find all hookify.*.local.md files
    rules_root = _resolve_project_root(root_dir)
    pattern = os.path.join(rules_root, '.claude', 'hookify.*.local.md')
    files = glob.glob(pattern)

    for file_path in files:
        try:
            rule = load_rule_file(file_path)
            if not rule:
                continue

            # Filter by event if specified
            if event:
                if rule.event != 'all' and rule.event != event:
                    continue

            # Only include enabled rules
            if rule.enabled:
                rules.append(rule)

        except (IOError, OSError, PermissionError) as e:
            # File I/O errors - log and continue
            print(f"Warning: Failed to read {file_path}: {e}", file=sys.stderr)
            continue
        except (ValueError, KeyError, AttributeError, TypeError) as e:
            # Parsing errors - log and continue
            print(f"Warning: Failed to parse {file_path}: {e}", file=sys.stderr)
            continue
        except Exception as e:
            # Unexpected errors - log with type details
            print(f"Warning: Unexpected error loading {file_path} ({type(e).__name__}): {e}", file=sys.stderr)
            continue

    return rules


def load_rule_file(file_path: str) -> Optional[Rule]:
    """Load a single rule file.

    Returns:
        Rule object or None if file is invalid.
    """
    try:
        with open(file_path, 'r') as f:
            content = f.read()

        frontmatter, message = extract_frontmatter(content)

        if not frontmatter:
            print(f"Warning: {file_path} missing YAML frontmatter (must start with ---)", file=sys.stderr)
            return None

        rule = Rule.from_dict(frontmatter, message)
        return rule

    except (IOError, OSError, PermissionError) as e:
        print(f"Error: Cannot read {file_path}: {e}", file=sys.stderr)
        return None
    except (ValueError, KeyError, AttributeError, TypeError) as e:
        print(f"Warning: Malformed rule file {file_path}: {e}", file=sys.stderr)
        return None
    except UnicodeDecodeError as e:
        print(f"Error: Invalid encoding in {file_path}: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error: Unexpected error parsing {file_path} ({type(e).__name__}): {e}", file=sys.stderr)
        return None


# For testing
if __name__ == '__main__':
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
