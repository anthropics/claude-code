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
