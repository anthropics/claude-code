#!/usr/bin/env python3
"""Post-edit verification hook for Claude Code.

After an Edit tool operation, reads the file back and checks that the
new_string is present. If not found, sends a systemMessage warning
Claude that the edit may not have applied correctly.
"""

import json
import sys


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Edit":
        json.dump({}, sys.stdout)
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")
    new_string = tool_input.get("new_string", "")

    # Skip verification for empty edits or very short replacements
    if not file_path or not new_string or len(new_string.strip()) < 5:
        json.dump({}, sys.stdout)
        sys.exit(0)

    # Read the file and check if new_string is present
    try:
        with open(file_path, "r") as f:
            content = f.read()
    except (FileNotFoundError, PermissionError, OSError):
        # Can't read file - don't block, just warn
        result = {
            "systemMessage": (
                f"Edit verification: Could not read {file_path} to verify "
                f"the edit applied correctly. Please verify manually."
            )
        }
        json.dump(result, sys.stdout)
        sys.exit(0)

    if new_string not in content:
        result = {
            "systemMessage": (
                f"Edit verification warning: The expected new content was not "
                f"found in {file_path} after the Edit operation. The edit may "
                f"not have applied correctly. Please read the file to verify."
            )
        }
        json.dump(result, sys.stdout)
    else:
        # Edit verified successfully - silent
        json.dump({}, sys.stdout)


if __name__ == "__main__":
    main()
