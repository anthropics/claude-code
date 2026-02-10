#!/usr/bin/env python3
"""
Slack Quote Formatter - UserPromptSubmit Hook

Transforms plain Slack forwarded/quoted messages into visually distinctive
formatted blocks with Unicode box characters and better layout.

Before:
    [Forwarded Message]
    From: John Doe
    Message: Here is some text...

After:
    ╔═══════════════════════════════════════════════════════════╗
    ║  FORWARDED MESSAGE                                        ║
    ╠═══════════════════════════════════════════════════════════╣
    ║  From: John Doe                                           ║
    ╟───────────────────────────────────────────────────────────╢
    ║    Here is some text...                                   ║
    ╚═══════════════════════════════════════════════════════════╝
"""

import json
import re
import sys


def format_forwarded_message(from_line: str, message_content: str) -> str:
    """Format a single forwarded message with visual box styling."""

    # Box drawing characters
    TOP_LEFT = "╔"
    TOP_RIGHT = "╗"
    BOTTOM_LEFT = "╚"
    BOTTOM_RIGHT = "╝"
    HORIZONTAL = "═"
    VERTICAL = "║"
    LEFT_T = "╠"
    RIGHT_T = "╣"
    LEFT_LIGHT = "╟"
    RIGHT_LIGHT = "╢"
    LIGHT_HORIZONTAL = "─"

    # Configuration
    BOX_WIDTH = 70
    INNER_WIDTH = BOX_WIDTH - 4  # Account for "║  " and "  ║"

    def pad_line(text: str, width: int = INNER_WIDTH) -> str:
        """Pad a line to fill the box width."""
        if len(text) > width:
            return text[:width]
        return text + " " * (width - len(text))

    def wrap_text(text: str, width: int) -> list:
        """Wrap text to fit within the specified width."""
        words = text.split()
        lines = []
        current_line = []
        current_length = 0

        for word in words:
            word_len = len(word)
            if current_length + word_len + (1 if current_line else 0) <= width:
                current_line.append(word)
                current_length += word_len + (1 if len(current_line) > 1 else 0)
            else:
                if current_line:
                    lines.append(" ".join(current_line))
                current_line = [word]
                current_length = word_len

        if current_line:
            lines.append(" ".join(current_line))

        return lines if lines else [""]

    lines = []

    # Top border with header
    lines.append(f"{TOP_LEFT}{HORIZONTAL * (BOX_WIDTH - 2)}{TOP_RIGHT}")

    # Header line
    header = "FORWARDED MESSAGE"
    lines.append(f"{VERTICAL}  {pad_line(header)}{VERTICAL}")

    # Separator after header
    lines.append(f"{LEFT_T}{HORIZONTAL * (BOX_WIDTH - 2)}{RIGHT_T}")

    # From line
    from_display = from_line.strip()
    lines.append(f"{VERTICAL}  {pad_line(from_display)}{VERTICAL}")

    # Light separator before message
    lines.append(f"{LEFT_LIGHT}{LIGHT_HORIZONTAL * (BOX_WIDTH - 2)}{RIGHT_LIGHT}")

    # Message content (indented and wrapped)
    message_lines = message_content.strip().split("\n")
    for msg_line in message_lines:
        # Handle each line, wrapping if necessary
        wrapped = wrap_text(msg_line, INNER_WIDTH - 2)  # Extra indent
        for wrapped_line in wrapped:
            indented = "  " + wrapped_line  # Add indent for quote appearance
            lines.append(f"{VERTICAL}  {pad_line(indented)}{VERTICAL}")

    # Bottom border
    lines.append(f"{BOTTOM_LEFT}{HORIZONTAL * (BOX_WIDTH - 2)}{BOTTOM_RIGHT}")

    return "\n".join(lines)


def transform_slack_context(text: str) -> str:
    """
    Find and transform [Forwarded Message] blocks in the text.

    Matches patterns like:
        [Forwarded Message]
        From: Name Here
        Message: Content here that may span
        multiple lines until we hit the next section
    """

    # Pattern to match forwarded message blocks
    # This handles the common format from Slack context
    pattern = r'\[Forwarded Message\]\s*\n\s*From:\s*([^\n]+)\s*\nMessage:\s*(.+?)(?=\n\s*\[|\n\[pnkfelix\]|\n<|\Z)'

    def replace_match(match):
        from_name = match.group(1).strip()
        message = match.group(2).strip()

        formatted = format_forwarded_message(f"From: {from_name}", message)
        return f"\n{formatted}\n"

    # Apply transformation
    result = re.sub(pattern, replace_match, text, flags=re.DOTALL)

    return result


def main():
    """Main entry point for the UserPromptSubmit hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Get the user prompt if available
        user_prompt = input_data.get("user_prompt", "")

        if not user_prompt:
            # No prompt to transform, just pass through
            print(json.dumps({}))
            sys.exit(0)

        # Check if there are forwarded messages to format
        if "[Forwarded Message]" not in user_prompt:
            # Nothing to transform
            print(json.dumps({}))
            sys.exit(0)

        # Transform the prompt
        transformed_prompt = transform_slack_context(user_prompt)

        # If we made changes, return the transformed prompt
        if transformed_prompt != user_prompt:
            result = {
                "transformedPrompt": transformed_prompt
            }
            print(json.dumps(result))
        else:
            print(json.dumps({}))

    except json.JSONDecodeError:
        # No valid JSON input, pass through
        print(json.dumps({}))
    except Exception as e:
        # Log error but don't block
        error_output = {
            "systemMessage": f"[slack-quote-formatter] Warning: {str(e)}"
        }
        print(json.dumps(error_output))

    sys.exit(0)


if __name__ == "__main__":
    main()
