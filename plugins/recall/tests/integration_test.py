#!/usr/bin/env python3
"""
Integration test for context-recall plugin.

This test simulates what Claude Code actually does:
1. Creates a real transcript file (JSON Lines format)
2. Calls the hook with real JSON input (like Claude Code does)
3. Verifies the snapshot is saved correctly
4. Calls the extract script and verifies output

No mocks - all real files and real execution.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def create_test_transcript(path: str, include_long_messages: bool = False) -> None:
    """Create a realistic transcript file in JSON Lines format.

    Args:
        path: Path to write the transcript
        include_long_messages: If True, include very long messages to test truncation
    """
    if include_long_messages:
        # Create messages that exceed the 1000 char limit
        long_user_text = "This is a very long user message. " * 100  # ~3500 chars
        long_assistant_text = "This is a very long assistant response with lots of detail. " * 100  # ~6000 chars
        messages = [
            {"role": "user", "message": {"content": [{"type": "text", "text": long_user_text}]}},
            {"role": "assistant", "message": {"content": [{"type": "text", "text": long_assistant_text}]}},
            {"role": "user", "message": {"content": [{"type": "text", "text": "Short follow-up question"}]}},
            {"role": "assistant", "message": {"content": [{"type": "text", "text": "Short response"}]}},
        ]
    else:
        messages = [
            {"role": "user", "message": {"content": [{"type": "text", "text": "Hello, I need help with a Python project"}]}},
            {"role": "assistant", "message": {"content": [{"type": "text", "text": "I'd be happy to help with your Python project. What are you working on?"}]}},
            {"role": "user", "message": {"content": [{"type": "text", "text": "I'm building a CLI tool that processes JSON files"}]}},
            {"role": "assistant", "message": {"content": [{"type": "text", "text": "That sounds great! Let me help you structure that. First, let's think about the input/output format..."}]}},
            {"role": "user", "message": {"content": [{"type": "text", "text": "I want it to validate the JSON and report errors"}]}},
            {"role": "assistant", "message": {"content": [{"type": "text", "text": "Perfect. We can use Python's json module with try/except to catch JSONDecodeError. Here's a basic structure..."}]}},
            {"role": "user", "message": {"content": [{"type": "text", "text": "Can you also add support for JSON5 format?"}]}},
            {"role": "assistant", "message": {"content": [{"type": "text", "text": "Yes! We can use the pyjson5 library for that. Let me show you how to integrate it..."}]}},
            {"role": "user", "message": {"content": [{"type": "text", "text": "Great, and what about performance for large files?"}]}},
            {"role": "assistant", "message": {"content": [{"type": "text", "text": "For large files, we should use streaming parsing with ijson library. This avoids loading the entire file into memory..."}]}},
        ]

    with open(path, 'w') as f:
        for msg in messages:
            f.write(json.dumps(msg) + '\n')


def run_hook(hooks_dir: str, input_data: dict) -> subprocess.CompletedProcess:
    """Run the hook script with given input, just like Claude Code does."""
    return subprocess.run(
        ['python3', 'save_context_snapshot.py'],
        input=json.dumps(input_data),
        capture_output=True,
        text=True,
        cwd=hooks_dir
    )


def run_extract_script(scripts_dir: str) -> subprocess.CompletedProcess:
    """Run the extract script, just like the command does."""
    return subprocess.run(
        ['python3', 'extract_context.py'],
        capture_output=True,
        text=True,
        cwd=scripts_dir
    )


def test_full_flow():
    """Test the complete flow from transcript to /recall output."""
    print("=" * 60)
    print("INTEGRATION TEST: context-recall plugin")
    print("=" * 60)

    # Setup paths
    plugin_dir = Path(__file__).parent.parent
    hooks_dir = plugin_dir / 'hooks'
    scripts_dir = plugin_dir / 'scripts'

    # Create temp directories for test data
    temp_dir = tempfile.mkdtemp()
    transcript_path = os.path.join(temp_dir, 'transcript.jsonl')

    # Override HOME for this test to isolate snapshot storage
    original_home = os.environ.get('HOME')
    test_home = tempfile.mkdtemp()
    os.environ['HOME'] = test_home

    try:
        print(f"\n[1] Creating test transcript at: {transcript_path}")
        create_test_transcript(transcript_path)

        # Verify transcript was created
        with open(transcript_path) as f:
            lines = f.readlines()
        print(f"    Created transcript with {len(lines)} messages")

        print(f"\n[2] Running hook (simulating UserPromptSubmit event)...")
        hook_input = {
            "session_id": "test-session-12345",
            "transcript_path": transcript_path,
            "user_prompt": "What were we discussing?",
            "hook_event_name": "UserPromptSubmit"
        }

        result = run_hook(str(hooks_dir), hook_input)
        print(f"    Exit code: {result.returncode}")
        print(f"    Stdout: {result.stdout.strip()}")
        if result.stderr:
            print(f"    Stderr: {result.stderr.strip()}")

        if result.returncode != 0:
            print("    FAILED: Hook exited with non-zero code")
            return False

        # Verify hook output is valid JSON
        try:
            hook_output = json.loads(result.stdout.strip())
            print(f"    Hook output (parsed): {hook_output}")
        except json.JSONDecodeError as e:
            print(f"    FAILED: Hook output is not valid JSON: {e}")
            return False

        print(f"\n[3] Checking snapshot was saved...")
        snapshot_dir = Path(test_home) / '.claude' / 'context-recall'
        current_snapshot = snapshot_dir / 'current.json'
        session_snapshot = snapshot_dir / 'test-session-12345.json'

        if not current_snapshot.exists():
            print(f"    FAILED: current.json not found at {current_snapshot}")
            return False

        if not session_snapshot.exists():
            print(f"    FAILED: session snapshot not found at {session_snapshot}")
            return False

        print(f"    Found: {current_snapshot}")
        print(f"    Found: {session_snapshot}")

        # Read and verify snapshot content
        with open(current_snapshot) as f:
            snapshot = json.load(f)

        print(f"\n[4] Verifying snapshot content...")
        print(f"    Session ID: {snapshot.get('session_id')}")
        print(f"    Message count: {snapshot.get('message_count')}")
        print(f"    Exchanges: {len(snapshot.get('exchanges', []))}")
        print(f"    Timestamp: {snapshot.get('timestamp')}")

        if snapshot.get('session_id') != 'test-session-12345':
            print("    FAILED: Wrong session_id")
            return False

        if snapshot.get('message_count') != 10:
            print(f"    FAILED: Expected 10 messages, got {snapshot.get('message_count')}")
            return False

        exchanges = snapshot.get('exchanges', [])
        if len(exchanges) != 5:
            print(f"    FAILED: Expected 5 exchanges, got {len(exchanges)}")
            return False

        print(f"\n[5] Running extract_context.py (simulating /recall command)...")
        result = run_extract_script(str(scripts_dir))
        print(f"    Exit code: {result.returncode}")

        if result.returncode != 0:
            print(f"    FAILED: Script exited with non-zero code")
            print(f"    Stderr: {result.stderr}")
            return False

        output = result.stdout
        print(f"\n[6] Verifying /recall output...")
        print("-" * 40)
        print(output[:1000] + "..." if len(output) > 1000 else output)
        print("-" * 40)

        # Check output contains expected content
        checks = [
            ("Exchange 1" in output, "Contains 'Exchange 1'"),
            ("Exchange 5" in output, "Contains 'Exchange 5'"),
            ("User:" in output, "Contains 'User:' labels"),
            ("Assistant:" in output, "Contains 'Assistant:' labels"),
            ("JSON" in output, "Contains conversation content about JSON"),
            ("test-session-12345" in output or "messages in session" in output, "Contains session info"),
        ]

        all_passed = True
        for check, description in checks:
            status = "PASS" if check else "FAIL"
            print(f"    [{status}] {description}")
            if not check:
                all_passed = False

        print(f"\n[7] Testing /recall logging (observability)...")
        hook_input_recall = {
            "session_id": "test-session-12345",
            "transcript_path": transcript_path,
            "user_prompt": "/recall",
            "hook_event_name": "UserPromptSubmit"
        }

        result = run_hook(str(hooks_dir), hook_input_recall)
        print(f"    Exit code: {result.returncode}")

        # Check stderr for logging
        if "[context-recall]" in result.stderr:
            print(f"    [PASS] Console logging works: {result.stderr.strip()}")
        else:
            print(f"    [FAIL] No console logging found")
            all_passed = False

        # Check stdout for systemMessage
        try:
            output = json.loads(result.stdout.strip())
            if "systemMessage" in output and "Observability" in output["systemMessage"]:
                print(f"    [PASS] systemMessage returned: {output['systemMessage']}")
            else:
                print(f"    [FAIL] No systemMessage with Observability")
                all_passed = False
        except:
            print(f"    [FAIL] Could not parse hook output")
            all_passed = False

        # Check log file
        log_file = Path(test_home) / '.claude' / 'recall-events.log'
        if log_file.exists():
            with open(log_file) as f:
                log_content = f.read()
            print(f"    [PASS] Log file created with content:")
            print(f"           {log_content.strip()}")
        else:
            print(f"    [FAIL] Log file not created at {log_file}")
            all_passed = False

        print("\n" + "=" * 60)
        if all_passed:
            print("ALL TESTS PASSED")
        else:
            print("SOME TESTS FAILED")
        print("=" * 60)

        return all_passed

    finally:
        # Cleanup
        os.environ['HOME'] = original_home
        shutil.rmtree(temp_dir, ignore_errors=True)
        shutil.rmtree(test_home, ignore_errors=True)


def test_size_limits():
    """Test that long messages are properly truncated."""
    print("\n" + "=" * 60)
    print("SIZE LIMIT TEST: Truncation of long messages")
    print("=" * 60)

    plugin_dir = Path(__file__).parent.parent
    hooks_dir = plugin_dir / 'hooks'
    scripts_dir = plugin_dir / 'scripts'

    temp_dir = tempfile.mkdtemp()
    transcript_path = os.path.join(temp_dir, 'transcript.jsonl')

    original_home = os.environ.get('HOME')
    test_home = tempfile.mkdtemp()
    os.environ['HOME'] = test_home

    try:
        print(f"\n[1] Creating transcript with LONG messages...")
        create_test_transcript(transcript_path, include_long_messages=True)

        with open(transcript_path) as f:
            lines = f.readlines()

        # Check original message sizes
        first_msg = json.loads(lines[0])
        original_size = len(first_msg['message']['content'][0]['text'])
        print(f"    Original user message size: {original_size} chars")

        print(f"\n[2] Running hook...")
        hook_input = {
            "session_id": "test-long-messages",
            "transcript_path": transcript_path,
            "user_prompt": "test",
            "hook_event_name": "UserPromptSubmit"
        }

        result = run_hook(str(hooks_dir), hook_input)
        if result.returncode != 0:
            print(f"    FAILED: Hook error: {result.stderr}")
            return False

        print(f"\n[3] Checking truncation in snapshot...")
        snapshot_file = Path(test_home) / '.claude' / 'context-recall' / 'current.json'
        with open(snapshot_file) as f:
            snapshot = json.load(f)

        exchanges = snapshot.get('exchanges', [])
        if not exchanges:
            print("    FAILED: No exchanges in snapshot")
            return False

        first_exchange = exchanges[0]
        truncated_user_size = len(first_exchange['user'])
        truncated_assistant_size = len(first_exchange['assistant'])

        print(f"    Truncated user message: {truncated_user_size} chars")
        print(f"    Truncated assistant message: {truncated_assistant_size} chars")

        # Check truncation worked (should be ~1000 + truncation indicator)
        max_expected = 1050  # 1000 + "[...truncated...]"

        checks = [
            (truncated_user_size <= max_expected, f"User message truncated to ~1000 chars (got {truncated_user_size})"),
            (truncated_assistant_size <= max_expected, f"Assistant message truncated to ~1000 chars (got {truncated_assistant_size})"),
            ("[...truncated...]" in first_exchange['user'], "User message has truncation indicator"),
            ("[...truncated...]" in first_exchange['assistant'], "Assistant message has truncation indicator"),
        ]

        all_passed = True
        for check, description in checks:
            status = "PASS" if check else "FAIL"
            print(f"    [{status}] {description}")
            if not check:
                all_passed = False

        print(f"\n[4] Checking total size limit...")
        total_chars = sum(len(e['user']) + len(e['assistant']) for e in exchanges)
        print(f"    Total characters across all exchanges: {total_chars}")

        if total_chars <= 8500:  # 8000 + some buffer for truncation indicators
            print(f"    [PASS] Total size within limit")
        else:
            print(f"    [FAIL] Total size exceeds limit")
            all_passed = False

        print("\n" + "=" * 60)
        if all_passed:
            print("SIZE LIMIT TEST PASSED")
        else:
            print("SIZE LIMIT TEST FAILED")
        print("=" * 60)

        return all_passed

    finally:
        # Cleanup
        os.environ['HOME'] = original_home
        shutil.rmtree(temp_dir, ignore_errors=True)
        shutil.rmtree(test_home, ignore_errors=True)


if __name__ == '__main__':
    success1 = test_full_flow()
    success2 = test_size_limits()
    sys.exit(0 if (success1 and success2) else 1)
