"""
Entity Presence Tracking for Web4 Governance

Implements "silence as signal" - tracking expected heartbeats and detecting
when entities go quiet unexpectedly. Absence of expected activity is itself
trust-relevant information.

Key concepts:
- presence_interval: How often entity is expected to check in
- last_seen: When entity was last active
- presence_status: "active", "expected", "overdue", "missing"
- grace_factor: Multiplier before "expected" becomes "overdue" (default 1.5)

Integration with T3:
- Overdue entities see reliability/consistency decay
- Missing entities trigger witness notifications
- Return after absence can rebuild trust through demonstrated activity

Usage:
    from governance.presence import PresenceTracker, PresenceStatus

    tracker = PresenceTracker()
    tracker.register("agent:claude", interval_hours=6)
    tracker.heartbeat("agent:claude")  # Called on activity

    status = tracker.check("agent:claude")
    if status == PresenceStatus.OVERDUE:
        # Investigate or notify
        pass
"""

import json
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


class PresenceStatus(Enum):
    """Entity presence status."""
    ACTIVE = "active"          # Seen within expected interval
    EXPECTED = "expected"      # Within grace period, should check in soon
    OVERDUE = "overdue"        # Past grace period, warrants attention
    MISSING = "missing"        # Significantly past expected, may need intervention
    UNKNOWN = "unknown"        # No expectation registered


@dataclass
class PresenceRecord:
    """Presence tracking for a single entity."""
    entity_id: str
    interval_seconds: float           # Expected check-in interval
    grace_factor: float = 1.5         # Multiplier for grace period
    missing_factor: float = 3.0       # Multiplier for "missing" threshold
    last_seen: Optional[str] = None   # ISO timestamp
    last_status: str = "unknown"
    check_count: int = 0              # Total heartbeats received
    overdue_count: int = 0            # Times found overdue
    missing_count: int = 0            # Times found missing
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def heartbeat(self) -> None:
        """Record entity activity."""
        self.last_seen = datetime.now(timezone.utc).isoformat()
        self.check_count += 1
        self.last_status = PresenceStatus.ACTIVE.value

    def get_status(self) -> PresenceStatus:
        """Determine current presence status."""
        if self.last_seen is None:
            return PresenceStatus.UNKNOWN

        last = datetime.fromisoformat(self.last_seen)
        now = datetime.now(timezone.utc)
        elapsed = (now - last).total_seconds()

        expected = self.interval_seconds
        grace = expected * self.grace_factor
        missing = expected * self.missing_factor

        if elapsed <= expected:
            return PresenceStatus.ACTIVE
        elif elapsed <= grace:
            return PresenceStatus.EXPECTED
        elif elapsed <= missing:
            return PresenceStatus.OVERDUE
        else:
            return PresenceStatus.MISSING

    def seconds_until_expected(self) -> float:
        """Seconds until entity becomes 'expected' (negative if already past)."""
        if self.last_seen is None:
            return 0.0
        last = datetime.fromisoformat(self.last_seen)
        now = datetime.now(timezone.utc)
        elapsed = (now - last).total_seconds()
        return self.interval_seconds - elapsed

    def seconds_until_overdue(self) -> float:
        """Seconds until entity becomes 'overdue' (negative if already past)."""
        if self.last_seen is None:
            return 0.0
        last = datetime.fromisoformat(self.last_seen)
        now = datetime.now(timezone.utc)
        elapsed = (now - last).total_seconds()
        grace = self.interval_seconds * self.grace_factor
        return grace - elapsed


class PresenceTracker:
    """
    Track entity presence expectations and detect silence.

    Provides situational awareness for distributed Web4 systems.
    """

    def __init__(self, storage_path: Optional[Path] = None):
        """Initialize tracker with optional persistent storage."""
        self.storage_path = storage_path or Path.home() / ".web4" / "governance" / "presence.json"
        self.records: Dict[str, PresenceRecord] = {}
        self._load()

    def _load(self) -> None:
        """Load presence records from storage."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    for entity_id, record_data in data.items():
                        self.records[entity_id] = PresenceRecord(**record_data)
            except Exception:
                pass  # Start fresh on error

    def _save(self) -> None:
        """Persist presence records to storage."""
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.storage_path, 'w') as f:
            data = {eid: asdict(rec) for eid, rec in self.records.items()}
            json.dump(data, f, indent=2)

    def register(
        self,
        entity_id: str,
        interval_hours: float = 6.0,
        grace_factor: float = 1.5,
        missing_factor: float = 3.0
    ) -> PresenceRecord:
        """
        Register an entity with expected presence interval.

        Args:
            entity_id: Unique entity identifier (e.g., "agent:claude", "track:web4")
            interval_hours: Expected hours between check-ins
            grace_factor: Multiplier for grace period (default 1.5x)
            missing_factor: Multiplier for missing threshold (default 3x)

        Returns:
            PresenceRecord for the entity
        """
        if entity_id not in self.records:
            self.records[entity_id] = PresenceRecord(
                entity_id=entity_id,
                interval_seconds=interval_hours * 3600,
                grace_factor=grace_factor,
                missing_factor=missing_factor
            )
            self._save()
        return self.records[entity_id]

    def heartbeat(self, entity_id: str, auto_register: bool = True) -> PresenceStatus:
        """
        Record entity activity (heartbeat).

        Args:
            entity_id: Entity checking in
            auto_register: If True, register unknown entities with default interval

        Returns:
            Previous status before heartbeat (useful for detecting returns)
        """
        if entity_id not in self.records:
            if auto_register:
                self.register(entity_id)
            else:
                return PresenceStatus.UNKNOWN

        record = self.records[entity_id]
        prev_status = record.get_status()

        # Track overdue/missing events
        if prev_status == PresenceStatus.OVERDUE:
            record.overdue_count += 1
        elif prev_status == PresenceStatus.MISSING:
            record.missing_count += 1

        record.heartbeat()
        self._save()
        return prev_status

    def check(self, entity_id: str) -> PresenceStatus:
        """Check current presence status of an entity."""
        if entity_id not in self.records:
            return PresenceStatus.UNKNOWN
        status = self.records[entity_id].get_status()
        self.records[entity_id].last_status = status.value
        return status

    def check_all(self) -> Dict[str, PresenceStatus]:
        """Check status of all registered entities."""
        return {eid: self.check(eid) for eid in self.records}

    def get_overdue(self) -> List[str]:
        """Get list of entities that are overdue or missing."""
        return [
            eid for eid, status in self.check_all().items()
            if status in (PresenceStatus.OVERDUE, PresenceStatus.MISSING)
        ]

    def get_expected_soon(self, within_hours: float = 1.0) -> List[str]:
        """Get entities expected to check in within the specified hours."""
        result = []
        for eid, record in self.records.items():
            if 0 < record.seconds_until_expected() <= within_hours * 3600:
                result.append(eid)
        return result

    def get_record(self, entity_id: str) -> Optional[PresenceRecord]:
        """Get presence record for an entity."""
        return self.records.get(entity_id)

    def unregister(self, entity_id: str) -> bool:
        """Remove entity from tracking."""
        if entity_id in self.records:
            del self.records[entity_id]
            self._save()
            return True
        return False

    def summary(self) -> Dict[str, Any]:
        """Get summary of all tracked entities."""
        statuses = self.check_all()
        return {
            "total_tracked": len(self.records),
            "active": sum(1 for s in statuses.values() if s == PresenceStatus.ACTIVE),
            "expected": sum(1 for s in statuses.values() if s == PresenceStatus.EXPECTED),
            "overdue": sum(1 for s in statuses.values() if s == PresenceStatus.OVERDUE),
            "missing": sum(1 for s in statuses.values() if s == PresenceStatus.MISSING),
            "entities": {
                eid: {
                    "status": status.value,
                    "last_seen": self.records[eid].last_seen,
                    "check_count": self.records[eid].check_count,
                    "overdue_count": self.records[eid].overdue_count,
                }
                for eid, status in statuses.items()
            }
        }


# Convenience function for integration with existing governance
def check_presence(entity_id: str, tracker: Optional[PresenceTracker] = None) -> PresenceStatus:
    """Quick check of entity presence status."""
    if tracker is None:
        tracker = PresenceTracker()
    return tracker.check(entity_id)


# Default tracker instance for simple usage
_default_tracker: Optional[PresenceTracker] = None


def get_tracker() -> PresenceTracker:
    """Get or create the default presence tracker."""
    global _default_tracker
    if _default_tracker is None:
        _default_tracker = PresenceTracker()
    return _default_tracker
