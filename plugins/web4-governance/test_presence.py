"""Tests for presence tracking (silence as signal)."""

import tempfile
from pathlib import Path
from datetime import datetime, timedelta, timezone
from governance.presence import (
    PresenceTracker,
    PresenceStatus,
    PresenceRecord,
)


def test_presence_registration():
    """Test entity registration."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tracker = PresenceTracker(Path(tmpdir) / "presence.json")

        # Register entity
        record = tracker.register("track:web4", interval_hours=6)
        assert record.entity_id == "track:web4"
        assert record.interval_seconds == 6 * 3600

        # Check initial status (unknown - no heartbeat yet)
        status = tracker.check("track:web4")
        assert status == PresenceStatus.UNKNOWN

        return True


def test_heartbeat_and_status():
    """Test heartbeat updates status correctly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tracker = PresenceTracker(Path(tmpdir) / "presence.json")

        tracker.register("agent:claude", interval_hours=6)

        # First heartbeat
        prev = tracker.heartbeat("agent:claude")
        assert prev == PresenceStatus.UNKNOWN

        # Should now be active
        status = tracker.check("agent:claude")
        assert status == PresenceStatus.ACTIVE

        return True


def test_status_transitions():
    """Test status transitions based on time."""
    record = PresenceRecord(
        entity_id="test:entity",
        interval_seconds=3600,  # 1 hour
        grace_factor=1.5,       # 1.5 hours grace
        missing_factor=3.0      # 3 hours missing
    )

    # No heartbeat yet
    assert record.get_status() == PresenceStatus.UNKNOWN

    # Just seen
    record.heartbeat()
    assert record.get_status() == PresenceStatus.ACTIVE

    # Simulate time passing by backdating last_seen
    def backdate(hours):
        past = datetime.now(timezone.utc) - timedelta(hours=hours)
        record.last_seen = past.isoformat()

    # 30 minutes ago - still active
    backdate(0.5)
    assert record.get_status() == PresenceStatus.ACTIVE

    # 1.2 hours ago - expected (in grace period)
    backdate(1.2)
    assert record.get_status() == PresenceStatus.EXPECTED

    # 2 hours ago - overdue (past grace, before missing)
    backdate(2)
    assert record.get_status() == PresenceStatus.OVERDUE

    # 4 hours ago - missing
    backdate(4)
    assert record.get_status() == PresenceStatus.MISSING

    return True


def test_overdue_detection():
    """Test detecting overdue entities."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tracker = PresenceTracker(Path(tmpdir) / "presence.json")

        # Register multiple entities
        tracker.register("track:web4", interval_hours=6)
        tracker.register("track:4life", interval_hours=6)
        tracker.register("agent:test", interval_hours=1)

        # Heartbeat for web4 only
        tracker.heartbeat("track:web4")

        # Check overdue list (4life and test never heartbeated, but status is UNKNOWN not OVERDUE)
        overdue = tracker.get_overdue()
        assert len(overdue) == 0  # Unknown entities aren't "overdue"

        # Now heartbeat 4life, then backdate it
        tracker.heartbeat("track:4life")
        record = tracker.get_record("track:4life")
        past = datetime.now(timezone.utc) - timedelta(hours=12)  # Way past 6hr interval
        record.last_seen = past.isoformat()

        # Now should show as overdue/missing
        overdue = tracker.get_overdue()
        assert "track:4life" in overdue

        return True


def test_summary():
    """Test summary generation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tracker = PresenceTracker(Path(tmpdir) / "presence.json")

        tracker.register("entity:a", interval_hours=1)
        tracker.register("entity:b", interval_hours=1)
        tracker.heartbeat("entity:a")

        summary = tracker.summary()
        assert summary["total_tracked"] == 2
        assert summary["active"] == 1
        assert "entity:a" in summary["entities"]
        assert "entity:b" in summary["entities"]

        return True


def test_auto_register():
    """Test auto-registration on heartbeat."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tracker = PresenceTracker(Path(tmpdir) / "presence.json")

        # Heartbeat unknown entity with auto_register=True (default)
        tracker.heartbeat("new:entity")
        assert "new:entity" in tracker.records

        # Heartbeat unknown entity with auto_register=False
        status = tracker.heartbeat("another:entity", auto_register=False)
        assert status == PresenceStatus.UNKNOWN
        assert "another:entity" not in tracker.records

        return True


def test_persistence():
    """Test that records persist across tracker instances."""
    with tempfile.TemporaryDirectory() as tmpdir:
        storage = Path(tmpdir) / "presence.json"

        # Create and populate
        tracker1 = PresenceTracker(storage)
        tracker1.register("persist:test", interval_hours=2)
        tracker1.heartbeat("persist:test")

        # New instance should load existing records
        tracker2 = PresenceTracker(storage)
        assert "persist:test" in tracker2.records
        record = tracker2.get_record("persist:test")
        assert record.check_count == 1

        return True


if __name__ == "__main__":
    tests = [
        test_presence_registration,
        test_heartbeat_and_status,
        test_status_transitions,
        test_overdue_detection,
        test_summary,
        test_auto_register,
        test_persistence,
    ]

    for test in tests:
        try:
            result = test()
            print(f"✓ {test.__name__}")
        except Exception as e:
            print(f"✗ {test.__name__}: {e}")
