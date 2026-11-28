# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Event Stream
# https://github.com/dp-web4/web4
"""
Event Stream for Real-Time Monitoring.

Provides a JSONL-based event stream that external clients can consume
for real-time monitoring, alerting, and analytics.

Stream Location: ~/.web4/events.jsonl (configurable)

Event Format:
    Each line is a self-contained JSON object with consistent schema.
    See EVENT_SCHEMA below for field definitions.

Usage:
    from governance.event_stream import EventStream, EventType

    # Initialize stream
    stream = EventStream("~/.web4")

    # Emit events (typically called by hooks)
    stream.emit(
        event_type=EventType.TOOL_CALL,
        session_id="sess-123",
        tool="Bash",
        target="rm -rf /tmp/test",
        decision="deny",
        reason="Destructive command blocked"
    )

    # External clients can tail the stream file:
    # tail -f ~/.web4/events.jsonl | jq .

Consuming the Stream:
    Python:
        import json
        with open("~/.web4/events.jsonl", "r") as f:
            for line in f:
                event = json.loads(line)
                print(event)

    Shell (real-time):
        tail -f ~/.web4/events.jsonl | jq -c 'select(.severity == "alert")'

    Shell (filter by type):
        grep '"type":"policy_decision"' ~/.web4/events.jsonl | jq .
"""

import json
import os
import threading
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


class EventType(str, Enum):
    """Event types emitted by the governance system."""

    # Session lifecycle
    SESSION_START = "session_start"
    SESSION_END = "session_end"

    # Tool execution
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"

    # Policy decisions
    POLICY_DECISION = "policy_decision"
    POLICY_VIOLATION = "policy_violation"

    # Rate limiting
    RATE_LIMIT_CHECK = "rate_limit_check"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"

    # Trust updates
    TRUST_UPDATE = "trust_update"

    # Agent lifecycle
    AGENT_SPAWN = "agent_spawn"
    AGENT_COMPLETE = "agent_complete"

    # Audit
    AUDIT_RECORD = "audit_record"
    AUDIT_ALERT = "audit_alert"

    # System
    SYSTEM_INFO = "system_info"
    SYSTEM_ERROR = "system_error"


class Severity(str, Enum):
    """Event severity levels."""
    DEBUG = "debug"      # Verbose debugging info
    INFO = "info"        # Normal operations
    WARN = "warn"        # Potential issues, policy warnings
    ALERT = "alert"      # Policy violations, security events
    ERROR = "error"      # System errors


@dataclass
class Event:
    """
    Standard event structure for the monitoring stream.

    All events follow this schema for consistent parsing by clients.
    """
    # Required fields
    type: EventType                    # Event type enum
    timestamp: str                     # ISO 8601 UTC timestamp
    severity: Severity                 # Severity level

    # Context fields (optional but recommended)
    session_id: Optional[str] = None   # Session identifier
    agent_id: Optional[str] = None     # Agent/role identifier

    # Event-specific payload
    tool: Optional[str] = None         # Tool name (for tool events)
    target: Optional[str] = None       # Target path/URL/command
    category: Optional[str] = None     # Tool category
    decision: Optional[str] = None     # Policy decision (allow/deny/warn)
    reason: Optional[str] = None       # Human-readable reason
    rule_id: Optional[str] = None      # Matched policy rule ID

    # Metrics (optional)
    duration_ms: Optional[int] = None  # Operation duration
    count: Optional[int] = None        # Count (for rate limits, etc.)

    # Trust (optional)
    trust_before: Optional[float] = None
    trust_after: Optional[float] = None
    trust_delta: Optional[float] = None

    # Error details (optional)
    error: Optional[str] = None        # Error message
    error_type: Optional[str] = None   # Error class/type

    # Extensible metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values."""
        result = {}
        for key, value in asdict(self).items():
            if value is not None:
                if isinstance(value, Enum):
                    result[key] = value.value
                elif isinstance(value, dict) and not value:
                    continue  # Skip empty dicts
                else:
                    result[key] = value
        return result

    def to_json(self) -> str:
        """Convert to JSON string (single line)."""
        return json.dumps(self.to_dict(), separators=(',', ':'))


# Type alias for event callbacks
EventCallback = Callable[[Event], None]


class EventStream:
    """
    JSONL event stream for real-time monitoring.

    Writes events to a file that external clients can tail.
    Supports optional in-process callbacks for direct integration.
    """

    DEFAULT_FILENAME = "events.jsonl"
    MAX_FILE_SIZE_MB = 100  # Rotate at 100MB

    def __init__(
        self,
        storage_path: Optional[str] = None,
        filename: str = DEFAULT_FILENAME,
        min_severity: Severity = Severity.INFO,
    ):
        """
        Initialize the event stream.

        Args:
            storage_path: Base directory for stream file (default: ~/.web4)
            filename: Stream filename (default: events.jsonl)
            min_severity: Minimum severity to emit (default: INFO)
        """
        if storage_path:
            self.storage_path = Path(os.path.expanduser(storage_path))
        else:
            self.storage_path = Path.home() / ".web4"

        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.stream_file = self.storage_path / filename
        self.min_severity = min_severity

        # Thread safety
        self._lock = threading.Lock()

        # In-process callbacks (optional)
        self._callbacks: List[EventCallback] = []

        # Severity ordering for filtering
        self._severity_order = {
            Severity.DEBUG: 0,
            Severity.INFO: 1,
            Severity.WARN: 2,
            Severity.ALERT: 3,
            Severity.ERROR: 4,
        }

    @property
    def stream_path(self) -> str:
        """Get the full path to the stream file."""
        return str(self.stream_file)

    def register_callback(self, callback: EventCallback) -> None:
        """Register an in-process callback for events."""
        with self._lock:
            self._callbacks.append(callback)

    def unregister_callback(self, callback: EventCallback) -> None:
        """Unregister an in-process callback."""
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def _should_emit(self, severity: Severity) -> bool:
        """Check if event meets minimum severity threshold."""
        return self._severity_order[severity] >= self._severity_order[self.min_severity]

    def _check_rotation(self) -> None:
        """Check if file needs rotation (called under lock)."""
        try:
            if self.stream_file.exists():
                size_mb = self.stream_file.stat().st_size / (1024 * 1024)
                if size_mb >= self.MAX_FILE_SIZE_MB:
                    # Rotate: rename current to .1, start fresh
                    rotated = self.stream_file.with_suffix(".jsonl.1")
                    if rotated.exists():
                        rotated.unlink()
                    self.stream_file.rename(rotated)
        except Exception:
            pass  # Best effort rotation

    def emit(
        self,
        event_type: EventType,
        severity: Severity = Severity.INFO,
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        tool: Optional[str] = None,
        target: Optional[str] = None,
        category: Optional[str] = None,
        decision: Optional[str] = None,
        reason: Optional[str] = None,
        rule_id: Optional[str] = None,
        duration_ms: Optional[int] = None,
        count: Optional[int] = None,
        trust_before: Optional[float] = None,
        trust_after: Optional[float] = None,
        error: Optional[str] = None,
        error_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Event]:
        """
        Emit an event to the stream.

        Args:
            event_type: Type of event
            severity: Event severity (default: INFO)
            session_id: Session identifier
            agent_id: Agent/role identifier
            tool: Tool name
            target: Target path/URL/command
            category: Tool category
            decision: Policy decision
            reason: Human-readable reason
            rule_id: Matched policy rule ID
            duration_ms: Operation duration in milliseconds
            count: Generic count field
            trust_before: Trust value before update
            trust_after: Trust value after update
            error: Error message
            error_type: Error class/type
            metadata: Additional key-value data

        Returns:
            The emitted Event object, or None if filtered
        """
        if not self._should_emit(severity):
            return None

        # Calculate trust delta if both values provided
        trust_delta = None
        if trust_before is not None and trust_after is not None:
            trust_delta = trust_after - trust_before

        event = Event(
            type=event_type,
            timestamp=datetime.now(timezone.utc).isoformat(),
            severity=severity,
            session_id=session_id,
            agent_id=agent_id,
            tool=tool,
            target=target,
            category=category,
            decision=decision,
            reason=reason,
            rule_id=rule_id,
            duration_ms=duration_ms,
            count=count,
            trust_before=trust_before,
            trust_after=trust_after,
            trust_delta=trust_delta,
            error=error,
            error_type=error_type,
            metadata=metadata or {},
        )

        self._write_event(event)
        self._notify_callbacks(event)

        return event

    def emit_event(self, event: Event) -> None:
        """Emit a pre-constructed Event object."""
        if not self._should_emit(event.severity):
            return
        self._write_event(event)
        self._notify_callbacks(event)

    def _write_event(self, event: Event) -> None:
        """Write event to the stream file."""
        with self._lock:
            self._check_rotation()
            try:
                with open(self.stream_file, "a", encoding="utf-8") as f:
                    f.write(event.to_json() + "\n")
                    f.flush()
            except Exception as e:
                # Log to stderr if stream write fails
                import sys
                print(f"[web4-event-stream] Write error: {e}", file=sys.stderr)

    def _notify_callbacks(self, event: Event) -> None:
        """Notify registered callbacks."""
        with self._lock:
            callbacks = self._callbacks.copy()

        for callback in callbacks:
            try:
                callback(event)
            except Exception:
                pass  # Don't let callback errors break the stream

    # Convenience methods for common event types

    def session_start(
        self,
        session_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Event:
        """Emit session start event."""
        return self.emit(
            EventType.SESSION_START,
            Severity.INFO,
            session_id=session_id,
            metadata=metadata,
        )

    def session_end(
        self,
        session_id: str,
        duration_ms: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Event:
        """Emit session end event."""
        return self.emit(
            EventType.SESSION_END,
            Severity.INFO,
            session_id=session_id,
            duration_ms=duration_ms,
            metadata=metadata,
        )

    def policy_decision(
        self,
        session_id: str,
        tool: str,
        target: Optional[str],
        decision: str,
        reason: Optional[str] = None,
        rule_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Event:
        """Emit policy decision event."""
        # Determine severity based on decision
        if decision == "deny":
            severity = Severity.ALERT
        elif decision == "warn":
            severity = Severity.WARN
        else:
            severity = Severity.INFO

        return self.emit(
            EventType.POLICY_DECISION,
            severity,
            session_id=session_id,
            tool=tool,
            target=target,
            decision=decision,
            reason=reason,
            rule_id=rule_id,
            category=category,
        )

    def rate_limit_exceeded(
        self,
        session_id: str,
        key: str,
        count: int,
        max_count: int,
    ) -> Event:
        """Emit rate limit exceeded event."""
        return self.emit(
            EventType.RATE_LIMIT_EXCEEDED,
            Severity.ALERT,
            session_id=session_id,
            target=key,
            count=count,
            metadata={"max_count": max_count},
        )

    def trust_update(
        self,
        session_id: str,
        agent_id: str,
        trust_before: float,
        trust_after: float,
        reason: Optional[str] = None,
    ) -> Event:
        """Emit trust update event."""
        return self.emit(
            EventType.TRUST_UPDATE,
            Severity.INFO,
            session_id=session_id,
            agent_id=agent_id,
            trust_before=trust_before,
            trust_after=trust_after,
            reason=reason,
        )

    def audit_alert(
        self,
        session_id: str,
        tool: str,
        target: Optional[str],
        reason: str,
        category: Optional[str] = None,
    ) -> Event:
        """Emit audit alert (credential access, memory write, etc.)."""
        return self.emit(
            EventType.AUDIT_ALERT,
            Severity.ALERT,
            session_id=session_id,
            tool=tool,
            target=target,
            reason=reason,
            category=category,
        )

    def system_error(
        self,
        error: str,
        error_type: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Event:
        """Emit system error event."""
        return self.emit(
            EventType.SYSTEM_ERROR,
            Severity.ERROR,
            session_id=session_id,
            error=error,
            error_type=error_type,
        )


# Module-level default stream instance
_default_stream: Optional[EventStream] = None
_default_lock = threading.Lock()


def get_default_stream() -> EventStream:
    """Get or create the default event stream instance."""
    global _default_stream
    with _default_lock:
        if _default_stream is None:
            _default_stream = EventStream()
        return _default_stream


def emit(event_type: EventType, **kwargs) -> Optional[Event]:
    """Emit an event using the default stream."""
    return get_default_stream().emit(event_type, **kwargs)
