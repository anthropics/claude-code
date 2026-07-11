#!/usr/bin/env python3
"""Rule evaluation engine for hookify plugin."""

import multiprocessing
import json
import re
import shlex
import signal
import sys
import threading
from functools import lru_cache
from typing import List, Dict, Any, Optional

# Use a package-relative import so the plugin works when the marketplace cache
# directory is a version number rather than literally named "hookify".
from .config_loader import Rule, Condition


REGEX_EVALUATION_TIMEOUT_SECONDS = 0.1
REGEX_PROCESS_TIMEOUT_SECONDS = 1.0


class RegexEvaluationTimeout(Exception):
    """Raised when a rule regex exceeds its evaluation budget."""


class RuleEvaluationFailure(Exception):
    """Raised when a configured rule cannot be evaluated safely."""


SHELL_PUNCTUATION = ';&|()\n'
SHELL_ASSIGNMENT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*=.*$', re.DOTALL)
SHELL_OPERATOR = re.compile(r'&&|\|\||[;&|()\n]')


def _segment_invokes_supported_test(tokens: List[str]) -> Optional[str]:
    """Return a supported test command when it is the segment executable.

    Only command-position tokens count. This deliberately does not treat test
    names passed as arguments to commands such as ``echo`` or ``printf`` as a
    test invocation.
    """
    position = 0
    while position < len(tokens) and SHELL_ASSIGNMENT.match(tokens[position]):
        position += 1
    if position >= len(tokens):
        return None

    executable = tokens[position].rsplit('/', 1)[-1]
    arguments = tokens[position + 1:]

    if executable in {'pytest', 'py.test'} or executable.startswith('pytest-'):
        return executable

    if executable in {'python', 'python3'} or re.fullmatch(
        r'python3(?:\.\d+)+', executable
    ):
        if len(arguments) >= 2 and arguments[0] == '-m' and arguments[1] == 'pytest':
            return f'{executable} -m pytest'
        return None

    non_option_arguments = [
        argument for argument in arguments if not argument.startswith('-')
    ]
    if executable == 'npm':
        if non_option_arguments[:1] == ['test']:
            return 'npm test'
        if non_option_arguments[:2] == ['run', 'test']:
            return 'npm run test'
    elif executable == 'cargo' and non_option_arguments[:1] == ['test']:
        return 'cargo test'

    return None


def _segment_literal_status(tokens: List[str]) -> Optional[bool]:
    """Return the known status of the shell's constant commands."""
    position = 0
    while position < len(tokens) and SHELL_ASSIGNMENT.match(tokens[position]):
        position += 1
    if position >= len(tokens):
        return None

    executable = tokens[position].rsplit('/', 1)[-1]
    if executable in {'true', ':'}:
        return True
    if executable == 'false':
        return False
    return None


def _supported_test_invocations(command: str) -> List[str]:
    """Extract supported test invocations from shell command positions."""
    # A backslash-newline is removed before shell tokenization. Doubling the
    # remaining newlines preserves one separator after shlex consumes the
    # first newline as part of an inline comment.
    command = command.replace('\\\n', '').replace('\n', '\n\n')
    try:
        lexer = shlex.shlex(
            command,
            posix=True,
            punctuation_chars=SHELL_PUNCTUATION,
        )
        # Preserve unquoted newlines as command separators. Spaces, tabs, and
        # carriage returns remain ordinary shell whitespace.
        lexer.whitespace = ' \t\r'
        lexer.whitespace_split = True
        lexer.commenters = '#'
        tokens = list(lexer)
    except ValueError:
        return []

    # shlex groups adjacent punctuation (for example &&( or && followed by a
    # newline). Expand it so grouping and line continuations cannot erase the
    # connector that determines whether a command is reachable.
    expanded_tokens = []
    for token in tokens:
        if token and all(character in SHELL_PUNCTUATION for character in token):
            expanded_tokens.extend(SHELL_OPERATOR.findall(token))
        else:
            expanded_tokens.append(token)

    invocations = []
    segment = []
    connector_before = None
    chain_status = None
    for token in expanded_tokens + [';']:
        if token and all(character in SHELL_PUNCTUATION for character in token):
            if token == '(' and not segment:
                # A subshell/group is still governed by the connector before
                # it (for example: false && (npm test)).
                continue
            if (
                token == '\n'
                and not segment
                and connector_before in {'&&', '||'}
            ):
                # A newline after a connector continues the same AND/OR list.
                continue

            invocation = _segment_invokes_supported_test(segment)
            definitely_unreachable = (
                (connector_before == '&&' and chain_status is False)
                or (connector_before == '||' and chain_status is True)
            )
            if invocation and not definitely_unreachable:
                invocations.append(invocation)

            literal_status = _segment_literal_status(segment)
            if connector_before not in {'&&', '||'}:
                chain_status = literal_status
            elif definitely_unreachable:
                # A short-circuited command does not change the current
                # AND/OR list status.
                pass
            elif chain_status is None:
                # The command may or may not have run, so even a literal
                # command cannot make the resulting status definite.
                chain_status = None
            else:
                chain_status = literal_status

            connector_before = token if token in {'&&', '||'} else None
            segment = []
        else:
            segment.append(token)
    return invocations


# Cache compiled regexes (max 128 patterns)
@lru_cache(maxsize=128)
def compile_regex(pattern: str) -> re.Pattern:
    """Compile regex pattern with caching.

    Args:
        pattern: Regex pattern string

    Returns:
        Compiled regex pattern
    """
    return re.compile(pattern, re.IGNORECASE)


def _raise_regex_timeout(_signum, _frame):
    raise RegexEvaluationTimeout


def _regex_worker(pattern: str, text: str, sender) -> None:
    """Evaluate a regex in an isolated process for platforms without timers."""
    try:
        sender.send(('result', bool(re.search(pattern, text, re.IGNORECASE))))
    except re.error as error:
        sender.send(('error', str(error)))
    finally:
        sender.close()


def _regex_search_in_process(pattern: str, text: str) -> bool:
    """Bound evaluation when ``setitimer`` is unavailable or unsafe to use."""
    context = multiprocessing.get_context('spawn')
    receiver, sender = context.Pipe(duplex=False)
    process = context.Process(
        target=_regex_worker,
        args=(pattern, text, sender),
        daemon=True,
    )
    started = False
    try:
        process.start()
        started = True
        sender.close()
        process.join(REGEX_PROCESS_TIMEOUT_SECONDS)
        if process.is_alive():
            process.terminate()
            process.join()
            raise RegexEvaluationTimeout
        if not receiver.poll():
            return False
        status, value = receiver.recv()
        if status == 'error':
            raise re.error(value)
        return value
    finally:
        sender.close()
        receiver.close()
        if started and process.is_alive():
            process.terminate()
            process.join()


def regex_search_with_timeout(pattern: str, text: str) -> bool:
    """Search with a hard wall-clock limit and no third-party dependency."""
    can_use_interval_timer = (
        hasattr(signal, 'setitimer')
        and hasattr(signal, 'ITIMER_REAL')
        and hasattr(signal, 'SIGALRM')
        and threading.current_thread() is threading.main_thread()
    )
    if not can_use_interval_timer:
        return _regex_search_in_process(pattern, text)

    previous_handler = signal.getsignal(signal.SIGALRM)
    previous_timer = signal.getitimer(signal.ITIMER_REAL)
    signal.signal(signal.SIGALRM, _raise_regex_timeout)
    signal.setitimer(signal.ITIMER_REAL, REGEX_EVALUATION_TIMEOUT_SECONDS)
    try:
        regex = compile_regex(pattern)
        return bool(regex.search(text))
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous_handler)
        if previous_timer[0] > 0:
            signal.setitimer(signal.ITIMER_REAL, *previous_timer)


class RuleEngine:
    """Evaluates rules against hook input data."""

    def __init__(self):
        """Initialize rule engine."""
        # No need for instance cache anymore - using global lru_cache
        pass

    def evaluate_rules(self, rules: List[Rule], input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate all rules and return combined results.

        Checks all rules and accumulates matches. Blocking rules take priority
        over warning rules. All matching rule messages are combined.

        Args:
            rules: List of Rule objects to evaluate
            input_data: Hook input JSON (tool_name, tool_input, etc.)

        Returns:
            Response dict with systemMessage, hookSpecificOutput, etc.
            Empty dict {} if no rules match.
        """
        hook_event = input_data.get('hook_event_name', '')
        blocking_messages = []
        warning_messages = []

        for rule in rules:
            if rule.invalid_reason:
                if rule.tool_matcher and not self._matches_tool(
                    rule.tool_matcher, input_data.get('tool_name', '')
                ):
                    continue
                message = (
                    f"**[{rule.name}]**\nHookify rule has an "
                    f"{rule.invalid_reason}. Fix or disable the rule before "
                    "continuing."
                )
                if rule.action == 'block':
                    blocking_messages.append(message)
                else:
                    warning_messages.append(message)
                continue

            try:
                rule_matches = self._rule_matches(rule, input_data)
            except RuleEvaluationFailure as error:
                if rule.action == 'block':
                    blocking_messages.append(
                        f"**[{rule.name}]**\nHookify block rule {error}. "
                        "Fix or disable the rule before continuing."
                    )
                continue

            if rule_matches:
                message = f"**[{rule.name}]**\n{rule.message}"
                if rule.action == 'block':
                    blocking_messages.append(message)
                else:
                    warning_messages.append(message)

        # If any blocking rules matched, block the operation
        if blocking_messages:
            combined_message = "\n\n".join(blocking_messages)

            # Use appropriate blocking format based on event type
            if hook_event in ['PostToolUse', 'Stop', 'UserPromptSubmit']:
                return {
                    "decision": "block",
                    "reason": combined_message,
                    "systemMessage": combined_message
                }
            elif hook_event == 'PreToolUse':
                return {
                    "hookSpecificOutput": {
                        "hookEventName": hook_event,
                        "permissionDecision": "deny",
                        "permissionDecisionReason": combined_message
                    },
                    "systemMessage": combined_message
                }
            else:
                # For other events, just show message
                return {
                    "systemMessage": combined_message
                }

        # If only warnings, show them but allow operation
        if warning_messages:
            return {
                "systemMessage": "\n\n".join(warning_messages)
            }

        # No matches - allow operation
        return {}

    def _rule_matches(self, rule: Rule, input_data: Dict[str, Any]) -> bool:
        """Check if rule matches input data.

        Args:
            rule: Rule to evaluate
            input_data: Hook input data

        Returns:
            True if rule matches, False otherwise
        """
        # Extract tool information
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        # Check tool matcher if specified
        if rule.tool_matcher:
            if not self._matches_tool(rule.tool_matcher, tool_name):
                return False

        # If no conditions, don't match
        # (Rules must have at least one condition to be valid)
        if not rule.conditions:
            return False

        # All conditions must match
        for condition in rule.conditions:
            if not self._check_condition(condition, tool_name, tool_input, input_data):
                return False

        return True

    def _matches_tool(self, matcher: str, tool_name: str) -> bool:
        """Check if tool_name matches the matcher pattern.

        Args:
            matcher: Pattern like "Bash", "Edit|Write", "*"
            tool_name: Actual tool name

        Returns:
            True if matches
        """
        if matcher == '*':
            return True

        # Split on | for OR matching
        patterns = matcher.split('|')
        return tool_name in patterns

    def _check_condition(self, condition: Condition, tool_name: str,
                        tool_input: Dict[str, Any], input_data: Dict[str, Any] = None) -> bool:
        """Check if a single condition matches.

        Args:
            condition: Condition to check
            tool_name: Tool being used
            tool_input: Tool input dict
            input_data: Full hook input data (for Stop events, etc.)

        Returns:
            True if condition matches
        """
        # Extract the field value to check
        field_value = self._extract_field(condition.field, tool_name, tool_input, input_data)
        if field_value is None:
            return False

        # Apply operator
        operator = condition.operator
        pattern = condition.pattern

        if operator == 'regex_match':
            return self._regex_match(pattern, field_value)
        elif operator == 'contains':
            return pattern in field_value
        elif operator == 'equals':
            return pattern == field_value
        elif operator == 'not_contains':
            return pattern not in field_value
        elif operator == 'starts_with':
            return field_value.startswith(pattern)
        elif operator == 'ends_with':
            return field_value.endswith(pattern)
        else:
            # Unknown operator
            return False

    def _extract_field(self, field: str, tool_name: str,
                      tool_input: Dict[str, Any], input_data: Dict[str, Any] = None) -> Optional[str]:
        """Extract field value from tool input or hook input data.

        Args:
            field: Field name like "command", "new_text", "file_path", "reason", "transcript"
            tool_name: Tool being used (may be empty for Stop events)
            tool_input: Tool input dict
            input_data: Full hook input (for accessing transcript_path, prompt, etc.)

        Returns:
            Field value as string, or None if not found
        """
        if field == 'event_content':
            return self._extract_event_content(tool_name, tool_input, input_data)

        # Direct tool_input fields
        if field in tool_input:
            value = tool_input[field]
            if isinstance(value, str):
                return value
            return str(value)

        # For Stop events and other non-tool events, check input_data
        if input_data:
            # Stop event specific fields
            if field == 'reason':
                return input_data.get('reason', '')
            elif field == 'transcript':
                # Read transcript file if path provided
                transcript_path = input_data.get('transcript_path')
                if transcript_path:
                    try:
                        with open(transcript_path, 'r') as f:
                            return f.read()
                    except FileNotFoundError:
                        print(f"Warning: Transcript file not found: {transcript_path}", file=sys.stderr)
                        return ''
                    except PermissionError:
                        print(f"Warning: Permission denied reading transcript: {transcript_path}", file=sys.stderr)
                        return ''
                    except (IOError, OSError) as e:
                        print(f"Warning: Error reading transcript {transcript_path}: {e}", file=sys.stderr)
                        return ''
                    except UnicodeDecodeError as e:
                        print(f"Warning: Encoding error in transcript {transcript_path}: {e}", file=sys.stderr)
                        return ''
            elif field == 'bash_tool_commands':
                return self._extract_bash_tool_commands(input_data)
            elif field == 'bash_test_commands':
                return self._extract_bash_test_commands(input_data)
            elif field in ['prompt', 'user_prompt']:
                # For UserPromptSubmit events
                return input_data.get('prompt', input_data.get('user_prompt', ''))

        # Handle special cases by tool type
        if tool_name == 'Bash':
            if field == 'command':
                return tool_input.get('command', '')

        elif tool_name in ['Write', 'Edit']:
            if field == 'content':
                # Write uses 'content', Edit has 'new_string'
                return tool_input.get('content') or tool_input.get('new_string', '')
            elif field == 'new_text' or field == 'new_string':
                # Treat Write.content and Edit.new_string as the same logical
                # "new text" field used by simple file rules.
                return tool_input.get('content') or tool_input.get('new_string', '')
            elif field == 'old_text' or field == 'old_string':
                return tool_input.get('old_string', '')
            elif field == 'file_path':
                return tool_input.get('file_path', '')

        elif tool_name == 'MultiEdit':
            if field == 'file_path':
                return tool_input.get('file_path', '')
            elif field in ['new_text', 'content']:
                # Concatenate all edits
                edits = tool_input.get('edits', [])
                return ' '.join(e.get('new_string', '') for e in edits)

        elif tool_name == 'NotebookEdit':
            if field in ['file_path', 'notebook_path']:
                return tool_input.get('notebook_path', '')
            elif field in ['new_text', 'new_string', 'content', 'new_source']:
                return tool_input.get('new_source', '')

        return None

    def _extract_bash_tool_commands(
        self, input_data: Dict[str, Any]
    ) -> str:
        """Extract commands from assistant Bash ``tool_use`` blocks only.

        Conversation text is intentionally ignored so a user request or an
        assistant explanation that names a test command cannot satisfy a Stop
        rule intended to verify that the command was actually invoked.
        """
        transcript_path = input_data.get('transcript_path')
        if not transcript_path:
            return ''

        return '\n'.join(self._read_bash_tool_commands(input_data))

    def _extract_bash_test_commands(
        self, input_data: Dict[str, Any]
    ) -> str:
        """Return supported tests found in executable command positions."""
        invocations = []
        for command in self._read_bash_tool_commands(input_data):
            invocations.extend(_supported_test_invocations(command))
        return '\n'.join(invocations)

    def _read_bash_tool_commands(
        self, input_data: Dict[str, Any]
    ) -> List[str]:
        """Read raw commands from assistant Bash ``tool_use`` blocks."""
        transcript_path = input_data.get('transcript_path')
        if not transcript_path:
            return []

        commands = []
        try:
            with open(transcript_path, 'r') as transcript:
                for line_number, line in enumerate(transcript, start=1):
                    try:
                        record = json.loads(line)
                    except json.JSONDecodeError:
                        print(
                            'Warning: Invalid JSON in transcript '
                            f'{transcript_path} at line {line_number}',
                            file=sys.stderr,
                        )
                        continue

                    if not isinstance(record, dict) or record.get('type') != 'assistant':
                        continue
                    message = record.get('message')
                    if not isinstance(message, dict):
                        continue
                    content = message.get('content')
                    if not isinstance(content, list):
                        continue

                    for block in content:
                        if (
                            not isinstance(block, dict)
                            or block.get('type') != 'tool_use'
                            or block.get('name') != 'Bash'
                        ):
                            continue
                        tool_input = block.get('input')
                        if not isinstance(tool_input, dict):
                            continue
                        command = tool_input.get('command')
                        if isinstance(command, str):
                            commands.append(command)
        except FileNotFoundError:
            print(
                f"Warning: Transcript file not found: {transcript_path}",
                file=sys.stderr,
            )
        except PermissionError:
            print(
                f"Warning: Permission denied reading transcript: {transcript_path}",
                file=sys.stderr,
            )
        except (IOError, OSError) as error:
            print(
                f"Warning: Error reading transcript {transcript_path}: {error}",
                file=sys.stderr,
            )
        except UnicodeDecodeError as error:
            print(
                f"Warning: Encoding error in transcript {transcript_path}: {error}",
                file=sys.stderr,
            )

        return commands

    def _extract_event_content(self, tool_name: str,
                               tool_input: Dict[str, Any],
                               input_data: Dict[str, Any] = None) -> Optional[str]:
        """Return the normalized content used by simple ``event: all`` rules."""
        if tool_name == 'Bash':
            return tool_input.get('command', '')
        elif tool_name == 'Write':
            return tool_input.get('content', '')
        elif tool_name == 'Edit':
            return tool_input.get('new_string', '')
        elif tool_name == 'MultiEdit':
            edits = tool_input.get('edits', [])
            return ' '.join(edit.get('new_string', '') for edit in edits)
        elif tool_name == 'NotebookEdit':
            return tool_input.get('new_source', '')

        if input_data:
            hook_event = input_data.get('hook_event_name', '')
            if hook_event == 'UserPromptSubmit':
                return input_data.get(
                    'prompt', input_data.get('user_prompt', '')
                )
            elif hook_event == 'Stop':
                return self._extract_field(
                    'transcript', tool_name, tool_input, input_data
                )

        return None

    def _regex_match(self, pattern: str, text: str) -> bool:
        """Check if pattern matches text using regex.

        Args:
            pattern: Regex pattern
            text: Text to match against

        Returns:
            True if pattern matches
        """
        try:
            return regex_search_with_timeout(pattern, text)

        except re.error as e:
            print(f"Invalid regex pattern '{pattern}': {e}", file=sys.stderr)
            raise RuleEvaluationFailure(
                f"has an invalid regular expression: {e}"
            ) from e
        except RegexEvaluationTimeout:
            print(
                f"Regex evaluation timed out for pattern '{pattern}'",
                file=sys.stderr,
            )
            raise RuleEvaluationFailure(
                "evaluation timed out"
            ) from None


# For testing
if __name__ == '__main__':
    # Test rule evaluation
    rule = Rule(
        name="test-rm",
        enabled=True,
        event="bash",
        conditions=[
            Condition(field="command", operator="regex_match", pattern=r"rm\s+-rf")
        ],
        message="Dangerous rm command!"
    )

    engine = RuleEngine()

    # Test matching input
    test_input = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "rm -rf /tmp/test"
        }
    }

    result = engine.evaluate_rules([rule], test_input)
    print("Match result:", result)

    # Test non-matching input
    test_input2 = {
        "tool_name": "Bash",
        "tool_input": {
            "command": "ls -la"
        }
    }

    result2 = engine.evaluate_rules([rule], test_input2)
    print("Non-match result:", result2)
