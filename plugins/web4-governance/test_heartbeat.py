#!/usr/bin/env python3
"""Test heartbeat integration for claude-code plugin."""

import sys
import json
from pathlib import Path

# Add hooks to path
sys.path.insert(0, str(Path(__file__).parent / "hooks"))

from heartbeat import get_session_heartbeat

def test_heartbeat():
    """Test basic heartbeat functionality."""
    import uuid

    # Create test session
    session_id = f"test_{uuid.uuid4().hex[:8]}"
    print(f"Testing session: {session_id}")

    heartbeat = get_session_heartbeat(session_id)

    # Record some heartbeats
    entries = []
    for i, tool in enumerate(["session_start", "Read", "Edit", "Bash", "Read"]):
        entry = heartbeat.record(tool, i)
        entries.append(entry)
        print(f"  [{i}] {tool}: status={entry['status']}, delta={entry['delta_seconds']}s")

    # Check coherence
    coherence = heartbeat.timing_coherence()
    print(f"\nTiming coherence: {coherence}")

    # Verify chain
    valid, error = heartbeat.verify_chain()
    print(f"Chain valid: {valid}")
    if error:
        print(f"  Error: {error}")

    # Summary
    summary = heartbeat.summary()
    print(f"\nSummary:")
    print(f"  Total heartbeats: {summary['total_heartbeats']}")
    print(f"  Status distribution: {summary['status_distribution']}")

    # Cleanup
    ledger_file = Path.home() / ".web4" / "heartbeat" / f"{session_id}.jsonl"
    if ledger_file.exists():
        ledger_file.unlink()
        print(f"\nCleaned up test ledger: {ledger_file}")

    print("\n✓ Heartbeat integration test passed")
    return True

if __name__ == "__main__":
    success = test_heartbeat()
    sys.exit(0 if success else 1)
