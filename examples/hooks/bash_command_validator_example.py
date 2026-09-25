#!/usr/bin/env python3
"""
Claude Code Hook: Bash Command Validator
=========================================
This hook runs as a PreToolUse hook for the Bash tool.
It validates bash commands against a set of rules before execution.
In this case it suggests rg alternatives and pre-flights compound commands.

Claude Code's sandbox permission analyzer may reject compound Bash commands. In
interactive sessions that can produce a permission prompt, but in unattended
or headless sessions the denied action may be dropped without useful feedback.
This example shows how a user-side hook can deny those commands first and steer
Claude to issue simpler, separate Bash calls. It does not change the analyzer.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/bash_command_validator_example.py"
          }
        ]
      }
    ]
  }
}

"""

import json
import os
import re
import shlex
import sys

# This scanner is a naive approximation of Bash grammar and can over- or
# under-match. It does not detect constructs such as process substitution or a
# background `&`; users should tune these example rules for their environment.

# Define validation rules as a list of (regex pattern, message) tuples
_VALIDATION_RULES = [
    (
        r"^grep\b(?!.*\|)",
        "Use 'rg' (ripgrep) instead of 'grep' for better performance and features",
    ),
    (
        r"^find\s+\S+\s+-name\b",
        "Use 'rg --files | rg pattern' or 'rg --files -g pattern' instead of 'find -name' for better performance",
    ),
]

# Some users may choose to allow pipes whose right-hand command only filters
# output. Keep this off by default, and review the list for your environment.
# This intentionally supersedes the original grep rule's exemption for pipes.
_ALLOW_READ_ONLY_PIPES = False
_READ_ONLY_PIPE_TARGETS = {"head", "tail", "wc", "sort", "uniq"}


def _shell_tokens(command: str) -> list[str]:
    """Split shell words and operators without executing the command."""
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>")
    lexer.whitespace_split = True
    lexer.commenters = ""
    try:
        return list(lexer)
    except ValueError:
        # An unfinished quote should be handled by Bash, not crash the hook.
        return []


def _heredoc_delimiters(line: str) -> list[tuple[str, bool]]:
    """Return heredoc delimiters declared on one shell input line."""
    tokens = _shell_tokens(line)
    delimiters = []
    for index, token in enumerate(tokens[:-1]):
        if token != "<<":
            continue
        delimiter = tokens[index + 1]
        strip_tabs = delimiter.startswith("-")
        if strip_tabs:
            delimiter = delimiter[1:]
        if delimiter:
            delimiters.append((delimiter, strip_tabs))
    return delimiters


def _without_heredoc_bodies(command: str) -> str:
    """Remove heredoc data so shell-like text in the body is not pre-flighted."""
    kept_lines = []
    pending_delimiters = []

    for line in command.splitlines(keepends=True):
        if pending_delimiters:
            delimiter, strip_tabs = pending_delimiters[0]
            candidate = line.rstrip("\r\n")
            if strip_tabs:
                candidate = candidate.lstrip("\t")
            if candidate == delimiter:
                pending_delimiters.pop(0)
            continue

        kept_lines.append(line)
        pending_delimiters.extend(_heredoc_delimiters(line))

    return "".join(kept_lines)


def _mask_quoted_text(command: str) -> str:
    """Mask quoted arguments before looking for command-position words."""
    result = []
    quote = None
    index = 0

    while index < len(command):
        character = command[index]
        if quote:
            if character == quote:
                quote = None
            result.append("\n" if character == "\n" else " ")
            index += 1
            continue
        if character in {"'", '"'}:
            quote = character
            result.append(" ")
            index += 1
            continue
        if character == "\\" and index + 1 < len(command):
            result.extend((" ", " "))
            index += 2
            continue
        result.append(character)
        index += 1

    return "".join(result)


def _plain_redirect_target(command: str, index: int, operator: str) -> str:
    """Return a plain filename target, excluding file-descriptor redirects."""
    if index > 0 and (command[index - 1].isdigit() or command[index - 1] == "&"):
        return ""

    target_start = index + len(operator)
    if target_start < len(command) and command[target_start] == "&":
        return ""

    tokens = _shell_tokens(command[target_start:])
    if not tokens:
        return ""
    target = tokens[0]
    if (
        target.startswith("#")
        or any(character.isspace() for character in target)
        or any(character in "$`;&|<>()*?[]{}" for character in target)
    ):
        return ""
    return target


def _command_around_operator(command: str, index: int, operator: str) -> tuple[str, str]:
    """Return compact left and right command fragments for a steer message."""

    def meaningful_lines(fragment: str) -> list[str]:
        return [
            line.strip()
            for line in fragment.splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        ]

    left = meaningful_lines(command[:index])
    right = meaningful_lines(command[index + len(operator) :])
    return (
        left[-1] if left else "the first command",
        right[0] if right else "the next command",
    )


def _shell_constructs(command: str) -> list[tuple[str, int, str]]:
    """Find unquoted shell operators and active command substitutions."""
    constructs = []
    quote = None
    index = 0

    while index < len(command):
        character = command[index]

        if character == "\\" and quote != "'":
            index += 2
            continue
        if character == "'" and quote != '"':
            quote = None if quote == "'" else "'"
            index += 1
            continue
        if character == '"' and quote != "'":
            quote = None if quote == '"' else '"'
            index += 1
            continue
        if quote == "'":
            index += 1
            continue
        if character == "#" and quote is None and (
            index == 0 or command[index - 1].isspace()
        ):
            newline = command.find("\n", index)
            index = len(command) if newline == -1 else newline
            continue

        if command.startswith("$(", index) and not command.startswith("$((", index):
            constructs.append(("command substitution", index, "$("))
            index += 2
            continue
        if character == "`":
            constructs.append(("backtick substitution", index, "`"))
            index += 1
            continue

        if quote is None:
            if character == "\n":
                left, right = _command_around_operator(command, index, "\n")
                if left != "the first command" and right != "the next command":
                    constructs.append(("newline chaining", index, "\n"))
                index += 1
                continue

            for operator, name in (
                ("&&", "&& chaining"),
                ("||", "|| chaining"),
                (">>", ">> redirection"),
                (";", "semicolon chaining"),
                ("|", "pipe"),
                (">", "> redirection"),
            ):
                if command.startswith(operator, index):
                    if name.endswith("redirection"):
                        if _plain_redirect_target(command, index, operator):
                            constructs.append((name, index, operator))
                    else:
                        constructs.append((name, index, operator))
                    index += len(operator)
                    break
            else:
                index += 1
            continue

        index += 1

    return constructs


def _pipe_target(command: str, index: int) -> str:
    """Return the executable immediately to the right of a pipe."""
    tokens = _shell_tokens(command[index + 1 :])
    if not tokens:
        return ""
    return os.path.basename(tokens[0])


def _command_word_constructs(command: str) -> list[tuple[str, str]]:
    """Find compound helpers when they occur in command position."""
    tokens = _shell_tokens(_mask_quoted_text(command))
    constructs = []
    command_start = True
    current_command = ""

    for index, token in enumerate(tokens):
        if token in {";", "&&", "||", "|", "&"}:
            command_start = True
            current_command = ""
            continue
        if token in {">", ">>", "<", "<<"}:
            continue
        if command_start and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", token):
            continue
        if command_start:
            current_command = os.path.basename(token)
            command_start = False
            if current_command == "xargs":
                target = (
                    tokens[index + 1]
                    if index + 1 < len(tokens)
                    else "its target command"
                )
                constructs.append(("xargs", target))
            elif current_command == "tee":
                target = (
                    tokens[index + 1]
                    if index + 1 < len(tokens)
                    else "the output file"
                )
                constructs.append(("tee", target))
            continue
        if current_command == "find" and token in {"-exec", "-execdir"}:
            target = (
                tokens[index + 1]
                if index + 1 < len(tokens)
                else "the target command"
            )
            constructs.append(("find -exec", target))

    return constructs


def _compound_command_issues(
    command: str, *, allow_read_only_pipes: bool
) -> list[str]:
    """Build actionable steer messages for compound-command shapes."""
    source = _without_heredoc_bodies(command)
    issues = []
    seen = set()

    for name, index, operator in _shell_constructs(source):
        if name in seen:
            continue
        if name == "pipe" and allow_read_only_pipes:
            if _pipe_target(source, index) in _READ_ONLY_PIPE_TARGETS:
                continue
        seen.add(name)

        if name.endswith("chaining"):
            left, right = _command_around_operator(source, index, operator)
            issues.append(
                f"Detected {name}. Run `{left}` and `{right}` as two separate Bash calls."
            )
        elif name == "pipe":
            left, right = _command_around_operator(source, index, operator)
            target = _pipe_target(source, index) or "the piped command"
            issues.append(
                f"Detected a pipe into `{target}`. Run `{left}` and `{right}` as "
                "separate Bash calls, passing the first result explicitly."
            )
        elif name in {"command substitution", "backtick substitution"}:
            issues.append(
                f"Detected {name}. Run the inner command and outer command as "
                "separate Bash calls, then use the captured result explicitly."
            )
        else:
            left, _ = _command_around_operator(source, index, operator)
            target = _plain_redirect_target(source, index, operator)
            issues.append(
                f"Detected {name}. Run `{left}` first, then write to `{target}`; "
                "use separate Bash calls."
            )

    for name, target in _command_word_constructs(source):
        if name in seen:
            continue
        seen.add(name)
        if name == "find -exec":
            issues.append(
                "Detected find -exec. Run `find` to list the paths, then run "
                f"`{target}` on those paths in separate Bash calls."
            )
        elif name == "xargs":
            issues.append(
                "Detected xargs. Produce the argument list first, then run "
                f"`{target}` in separate Bash calls with explicit arguments."
            )
        else:
            issues.append(
                f"Detected tee. Produce the content first, then write `{target}`; "
                "use separate Bash calls."
            )

    return issues


def _validate_command(
    command: str, *, allow_read_only_pipes: bool = _ALLOW_READ_ONLY_PIPES
) -> list[str]:
    issues = _compound_command_issues(
        command, allow_read_only_pipes=allow_read_only_pipes
    )
    for pattern, message in _VALIDATION_RULES:
        if re.search(pattern, command):
            issues.append(message)
    return issues


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        # Exit code 1 shows stderr to the user but not to Claude
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    if not command:
        sys.exit(0)

    issues = _validate_command(command)
    if issues:
        for message in issues:
            print(f"• {message}", file=sys.stderr)
        # Exit code 2 blocks tool call and shows stderr to Claude
        sys.exit(2)


if __name__ == "__main__":
    main()
