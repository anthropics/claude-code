#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Governance Plugin - Heartbeat Ledger
# https://github.com/dp-web4/web4

"""
Lightweight Heartbeat Ledger for Claude Code Sessions

Provides timing-based coherence tracking for audit trails.
Now backed by SQLite via the governance Ledger for unified storage.

Records:
- Session activity heartbeats (each tool call)
- Timing validation (on_time, early, late, gap)
- Hash-linked chain for integrity verification
- Timing coherence score for overall session health
"""

import sys
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Tuple

# Add parent directory to path for governance import
sys.path.insert(0, str(Path(__file__).parent.parent))
from governance import Ledger
from governance.presence import get_tracker


# Configuration
EXPECTED_INTERVAL = timedelta(seconds=60)  # Expected time between tool calls
JITTER_TOLERANCE = 0.5  # 50% tolerance


class SessionHeartbeat:
    """
    Heartbeat tracker for a single session.

    Records each tool call as a heartbeat, creating a timing-auditable
    chain of activity. Now uses SQLite via Ledger for persistence.
    """

    def __init__(self, session_id: str, ledger: Optional[Ledger] = None):
        self.session_id = session_id
        self.ledger = ledger or Ledger()
        self._last_entry: Optional[dict] = None
        self._loaded = False

    def _load(self):
        """Load last entry from database."""
        if self._loaded:
            return

        self._last_entry = self.ledger.get_last_heartbeat(self.session_id)
        self._loaded = True

    def record(self, tool_name: str, action_index: int) -> dict:
        """
        Record a heartbeat for a tool call.

        Args:
            tool_name: Name of the tool being called
            action_index: Sequential action number

        Returns:
            Heartbeat entry dict
        """
        self._load()

        now = datetime.now()
        timestamp = now.isoformat()

        if self._last_entry is None:
            # First heartbeat
            status = "initial"
            delta_seconds = 0.0
            previous_hash = ""
            sequence = 1
        else:
            # Calculate timing
            last_time = datetime.fromisoformat(self._last_entry['timestamp'])
            elapsed = now - last_time
            delta_seconds = elapsed.total_seconds()

            # Classify timing
            expected = EXPECTED_INTERVAL.total_seconds()
            min_interval = expected * (1 - JITTER_TOLERANCE)
            max_interval = expected * (1 + JITTER_TOLERANCE)

            if delta_seconds < min_interval:
                status = "early"
            elif delta_seconds <= max_interval:
                status = "on_time"
            elif delta_seconds <= expected * 3:
                status = "late"
            else:
                status = "gap"

            previous_hash = self._last_entry['entry_hash']
            sequence = self._last_entry['sequence'] + 1

        # Compute entry hash
        hash_input = f"{self.session_id}:{timestamp}:{previous_hash}:{sequence}"
        entry_hash = hashlib.sha256(hash_input.encode()).hexdigest()[:32]

        entry = {
            'sequence': sequence,
            'timestamp': timestamp,
            'status': status,
            'delta_seconds': round(delta_seconds, 2),
            'tool_name': tool_name,
            'action_index': action_index,
            'previous_hash': previous_hash,
            'entry_hash': entry_hash
        }

        # Store in database
        self.ledger.record_heartbeat(
            session_id=self.session_id,
            sequence=sequence,
            timestamp=timestamp,
            status=status,
            delta_seconds=round(delta_seconds, 2),
            tool_name=tool_name,
            action_index=action_index,
            previous_hash=previous_hash,
            entry_hash=entry_hash
        )

        # Record presence heartbeat for session entity
        # This enables "silence as signal" detection
        try:
            tracker = get_tracker()
            tracker.heartbeat(f"session:{self.session_id}")
        except Exception:
            pass  # Don't fail heartbeat if presence tracking fails

        self._last_entry = entry
        return entry

    def timing_coherence(self, window: int = 10) -> float:
        """
        Compute timing coherence score.

        Returns [0.0, 1.0] based on how regular the heartbeats are.
        """
        entries = self.ledger.get_heartbeats(self.session_id, limit=window)

        if len(entries) < 2:
            return 1.0

        # Score each entry
        scores = []
        for entry in entries:
            status = entry['status']
            if status == 'initial':
                scores.append(1.0)
            elif status == 'on_time':
                scores.append(1.0)
            elif status == 'early':
                scores.append(0.8)  # Slightly suspicious
            elif status == 'late':
                scores.append(0.7)
            elif status == 'gap':
                scores.append(0.3)
            else:
                scores.append(0.5)

        # Weighted average (recent scores weighted higher)
        total_weight = 0.0
        weighted_sum = 0.0
        for i, score in enumerate(scores):
            weight = (i + 1) / len(scores)
            weighted_sum += score * weight
            total_weight += weight

        return round(weighted_sum / total_weight, 3) if total_weight > 0 else 1.0

    def verify_chain(self) -> Tuple[bool, Optional[str]]:
        """Verify hash chain integrity."""
        entries = self.ledger.get_heartbeats(self.session_id)

        if not entries:
            return (True, None)

        for i, entry in enumerate(entries):
            if i == 0:
                if entry.get('previous_hash'):
                    return (False, f"First entry has non-empty previous_hash")
                continue

            prev = entries[i - 1]

            # Check sequence
            if entry['sequence'] != prev['sequence'] + 1:
                return (False, f"Sequence gap at {i}")

            # Check hash chain
            if entry['previous_hash'] != prev['entry_hash']:
                return (False, f"Hash chain broken at {i}")

            # Check timestamp order
            if entry['timestamp'] <= prev['timestamp']:
                return (False, f"Timestamp order violation at {i}")

        return (True, None)

    def summary(self) -> dict:
        """Get heartbeat summary."""
        total = self.ledger.get_heartbeat_count(self.session_id)
        status_counts = self.ledger.get_heartbeat_status_distribution(self.session_id)
        last_entry = self.ledger.get_last_heartbeat(self.session_id)

        valid, error = self.verify_chain()

        return {
            'session_id': self.session_id,
            'total_heartbeats': total,
            'timing_coherence': self.timing_coherence(),
            'chain_valid': valid,
            'chain_error': error,
            'status_distribution': status_counts,
            'last_heartbeat': last_entry['timestamp'] if last_entry else None
        }

    def get_recent(self, count: int = 10) -> List[dict]:
        """Get recent heartbeat entries."""
        return self.ledger.get_heartbeats(self.session_id, limit=count)


def get_session_heartbeat(session_id: str) -> SessionHeartbeat:
    """Get or create heartbeat tracker for session."""
    return SessionHeartbeat(session_id)
