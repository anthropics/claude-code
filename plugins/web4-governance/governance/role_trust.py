# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Role Trust Store
# https://github.com/dp-web4/web4
"""
Role-specific trust accumulation.

Maps Claude Code agents to Web4 role entities with:
- T3 Trust Tensor (6 dimensions per role)
- V3 Value Tensor (6 dimensions per role)
- Action history and success rates
- Trust-based capability modulation

Key concept: Trust is NEVER global. Each role (agent) accumulates
its own trust independently. A highly trusted code-reviewer may
have low trust as a test-generator (and vice versa).
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict

from .ledger import Ledger


# Storage location
ROLES_DIR = Path.home() / ".web4" / "governance" / "roles"


@dataclass
class RoleTrust:
    """
    Trust tensors for a specific role (agent type).

    T3 Trust Tensor:
    - competence: Can they do it? (skill/ability)
    - reliability: Will they do it consistently?
    - consistency: Same quality over time?
    - witnesses: Corroborated by others?
    - lineage: Track record / history length?
    - alignment: Values match context?

    V3 Value Tensor:
    - energy: Effort/resources invested
    - contribution: Value added to ecosystem
    - stewardship: Care for shared resources
    - network: Connections / reach
    - reputation: External perception
    - temporal: Time-based value accumulation
    """
    role_id: str

    # T3 Trust Tensor (6 dimensions)
    competence: float = 0.5
    reliability: float = 0.5
    consistency: float = 0.5
    witnesses: float = 0.5
    lineage: float = 0.5
    alignment: float = 0.5

    # V3 Value Tensor (6 dimensions)
    energy: float = 0.5
    contribution: float = 0.5
    stewardship: float = 0.5
    network: float = 0.5
    reputation: float = 0.5
    temporal: float = 0.5

    # Metadata
    action_count: int = 0
    success_count: int = 0
    last_action: Optional[str] = None
    created_at: Optional[str] = None

    def t3_average(self) -> float:
        """Average T3 trust score."""
        return (self.competence + self.reliability + self.consistency +
                self.witnesses + self.lineage + self.alignment) / 6

    def v3_average(self) -> float:
        """Average V3 value score."""
        return (self.energy + self.contribution + self.stewardship +
                self.network + self.reputation + self.temporal) / 6

    def update_from_outcome(self, success: bool, magnitude: float = 0.1):
        """
        Update trust based on action outcome.

        Success increases trust slowly (asymptotic to 1.0).
        Failure decreases trust faster (trust is hard to earn, easy to lose).
        """
        self.action_count += 1
        if success:
            self.success_count += 1

        # Calculate delta (asymmetric: failures hit harder)
        if success:
            delta = magnitude * 0.05 * (1 - self.reliability)  # Diminishing returns
        else:
            delta = -magnitude * 0.10 * self.reliability  # Bigger fall from height

        # Update T3 dimensions
        self.reliability = max(0, min(1, self.reliability + delta))
        self.consistency = max(0, min(1, self.consistency + delta * 0.5))
        self.competence = max(0, min(1, self.competence + delta * 0.3))

        # Update lineage based on action history
        if self.action_count > 0:
            success_rate = self.success_count / self.action_count
            # Lineage builds slowly with consistent success
            self.lineage = 0.2 + 0.8 * (success_rate ** 0.5) * min(1.0, self.action_count / 100)

        # Update V3 energy (effort spent)
        self.energy = min(1.0, self.energy + 0.01)  # Small increase per action

        self.last_action = datetime.now(timezone.utc).isoformat()

    def trust_level(self) -> str:
        """Categorical trust level."""
        t3 = self.t3_average()
        if t3 >= 0.8:
            return "high"
        elif t3 >= 0.6:
            return "medium-high"
        elif t3 >= 0.4:
            return "medium"
        elif t3 >= 0.2:
            return "low"
        else:
            return "minimal"

    def apply_decay(self, days_inactive: float, decay_rate: float = 0.01) -> bool:
        """
        Apply trust decay based on inactivity.

        Trust decays slowly over time if not used. This prevents
        stale trust from persisting indefinitely.

        Decay affects:
        - reliability (most affected - "will they still do it?")
        - consistency (affected - "same quality after gap?")
        - temporal (V3 - time-based value)

        Decay is asymptotic to 0.3 (never fully decays to 0).

        Args:
            days_inactive: Days since last action
            decay_rate: Decay rate per day (default 1% per day)

        Returns:
            True if decay was applied, False if no decay needed
        """
        if days_inactive <= 0:
            return False

        # Calculate decay factor (exponential decay)
        # After 30 days: ~74% remaining, 60 days: ~55%, 90 days: ~41%
        decay_factor = (1 - decay_rate) ** days_inactive

        # Apply decay with floor at 0.3 (minimum trust)
        floor = 0.3

        def decay_value(current: float) -> float:
            decayed = floor + (current - floor) * decay_factor
            return max(floor, decayed)

        # Decay T3 dimensions (reliability most affected)
        old_reliability = self.reliability
        self.reliability = decay_value(self.reliability)
        self.consistency = decay_value(self.consistency * 0.98)  # Slightly less decay
        # competence decays slower (skills don't fade as fast)
        self.competence = decay_value(self.competence * 0.995)

        # Decay V3 temporal (time-based value)
        self.temporal = decay_value(self.temporal)
        # Energy decays (effort fades)
        self.energy = decay_value(self.energy * 0.99)

        # Return whether meaningful decay occurred
        return abs(old_reliability - self.reliability) > 0.001

    def days_since_last_action(self) -> float:
        """Calculate days since last action."""
        if not self.last_action:
            if self.created_at:
                # Use creation time if never acted
                try:
                    created = datetime.fromisoformat(
                        self.created_at.replace("Z", "+00:00")
                    )
                    return (datetime.now(timezone.utc) - created).days
                except (ValueError, TypeError):
                    return 0
            return 0

        try:
            last = datetime.fromisoformat(
                self.last_action.replace("Z", "+00:00")
            )
            delta = datetime.now(timezone.utc) - last
            return delta.total_seconds() / 86400  # Convert to days
        except (ValueError, TypeError):
            return 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> 'RoleTrust':
        return cls(**data)


class RoleTrustStore:
    """
    Persistent storage for role trust tensors.

    Each agent type (role) accumulates trust independently.
    Trust persists across sessions.
    """

    def __init__(self, ledger: Optional[Ledger] = None):
        ROLES_DIR.mkdir(parents=True, exist_ok=True)
        self.ledger = ledger

    def _role_file(self, role_id: str) -> Path:
        """Get file path for role trust data."""
        safe_name = hashlib.sha256(role_id.encode()).hexdigest()[:16]
        return ROLES_DIR / f"{safe_name}.json"

    def get(self, role_id: str) -> RoleTrust:
        """Get trust for role, creating with defaults if new."""
        role_file = self._role_file(role_id)

        if role_file.exists():
            with open(role_file) as f:
                data = json.load(f)
            return RoleTrust.from_dict(data)

        # New role with default trust (neutral starting point)
        trust = RoleTrust(
            role_id=role_id,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        self.save(trust)
        return trust

    def save(self, trust: RoleTrust):
        """Save role trust to disk."""
        role_file = self._role_file(trust.role_id)
        with open(role_file, "w") as f:
            json.dump(trust.to_dict(), f, indent=2)

    def update(self, role_id: str, success: bool, magnitude: float = 0.1) -> RoleTrust:
        """Update role trust based on action outcome."""
        trust = self.get(role_id)
        trust.update_from_outcome(success, magnitude)
        self.save(trust)

        # Record in ledger if available
        if self.ledger:
            try:
                self.ledger.record_audit(
                    session_id="role_trust",
                    action_type="trust_update",
                    tool_name=role_id,
                    target=f"success={success}",
                    input_hash=None,
                    output_hash=hashlib.sha256(
                        f"{trust.t3_average():.3f}".encode()
                    ).hexdigest()[:8],
                    status="success"
                )
            except Exception:
                pass  # Don't fail on audit issues

        return trust

    def list_roles(self) -> List[str]:
        """List all known role IDs."""
        roles = []
        for f in ROLES_DIR.glob("*.json"):
            try:
                with open(f) as file:
                    data = json.load(file)
                    roles.append(data.get("role_id", f.stem))
            except Exception:
                pass
        return roles

    def get_all(self) -> Dict[str, RoleTrust]:
        """Get all role trusts."""
        return {role_id: self.get(role_id) for role_id in self.list_roles()}

    def derive_capabilities(self, role_id: str) -> dict:
        """
        Derive capabilities from trust level.

        Higher trust = more permissions.
        """
        trust = self.get(role_id)
        t3_avg = trust.t3_average()

        return {
            "can_read": True,  # Always allowed
            "can_write": t3_avg >= 0.3,
            "can_execute": t3_avg >= 0.4,
            "can_network": t3_avg >= 0.5,
            "can_delegate": t3_avg >= 0.6,
            "max_atp_per_action": int(10 + 90 * t3_avg),
            "trust_level": trust.trust_level(),
            "t3_average": round(t3_avg, 3),
            "action_count": trust.action_count,
            "success_rate": trust.success_count / max(1, trust.action_count)
        }

    def apply_decay_all(self, decay_rate: float = 0.01) -> Dict[str, dict]:
        """
        Apply trust decay to all roles based on inactivity.

        Should be called periodically (e.g., at session start) to
        ensure trust reflects recency.

        Args:
            decay_rate: Decay rate per day (default 1% per day)

        Returns:
            Dict of {role_id: {"decayed": bool, "days_inactive": float, "t3_before": float, "t3_after": float}}
        """
        results = {}

        for role_id in self.list_roles():
            trust = self.get(role_id)
            days_inactive = trust.days_since_last_action()

            if days_inactive > 1:  # Only decay if > 1 day inactive
                t3_before = trust.t3_average()
                decayed = trust.apply_decay(days_inactive, decay_rate)

                if decayed:
                    self.save(trust)
                    results[role_id] = {
                        "decayed": True,
                        "days_inactive": round(days_inactive, 1),
                        "t3_before": round(t3_before, 3),
                        "t3_after": round(trust.t3_average(), 3)
                    }

                    # Record in ledger if available
                    if self.ledger:
                        try:
                            self.ledger.record_audit(
                                session_id="trust_decay",
                                action_type="decay",
                                tool_name=role_id,
                                target=f"days={days_inactive:.1f}",
                                input_hash=f"t3={t3_before:.3f}",
                                output_hash=f"t3={trust.t3_average():.3f}",
                                status="success"
                            )
                        except Exception:
                            pass

        return results

    def get_with_decay(self, role_id: str, decay_rate: float = 0.01) -> RoleTrust:
        """
        Get trust for role, applying decay if needed.

        Convenience method that applies decay before returning trust.
        """
        trust = self.get(role_id)
        days_inactive = trust.days_since_last_action()

        if days_inactive > 1:
            if trust.apply_decay(days_inactive, decay_rate):
                self.save(trust)

        return trust
