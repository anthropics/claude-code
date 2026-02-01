# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Role Trust Store
# https://github.com/dp-web4/web4
"""
Role-specific trust accumulation.

Maps Claude Code agents to Web4 role entities with:
- T3 Trust Tensor (fractal 3D: Talent/Training/Temperament)
- V3 Value Tensor (fractal 3D: Valuation/Veracity/Validity)
- Action history and success rates
- Trust-based capability modulation

Key concept: Trust is NEVER global. Each role (agent) accumulates
its own trust independently. A highly trusted code-reviewer may
have low trust as a test-generator (and vice versa).

## Fractal Tensor Structure

T3 (base 3D) with subdimensions:
    Talent     → (competence, alignment)
    Training   → (lineage, witnesses)
    Temperament → (reliability, consistency)

V3 (base 3D) with subdimensions:
    Valuation  → (reputation, contribution)
    Veracity   → (stewardship, energy)
    Validity   → (network, temporal)
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict

from .ledger import Ledger
from .tensors import (
    T3Tensor, V3Tensor,
    migrate_legacy_t3, migrate_legacy_v3,
)


# Storage location
ROLES_DIR = Path.home() / ".web4" / "governance" / "roles"


@dataclass
class RoleTrust:
    """
    Trust tensors for a specific role (agent type).

    Uses fractal T3/V3 tensor structure per Web4 spec:

    T3 Trust Tensor (base 3D, each with 2 subdimensions):
        - Talent     → (competence, alignment)
        - Training   → (lineage, witnesses)
        - Temperament → (reliability, consistency)

    V3 Value Tensor (base 3D, each with 2 subdimensions):
        - Valuation  → (reputation, contribution)
        - Veracity   → (stewardship, energy)
        - Validity   → (network, temporal)

    Trust is ROLE-CONTEXTUAL: an entity's T3/V3 exists only within
    a role context.
    """
    role_id: str

    # Fractal T3 Trust Tensor
    t3: T3Tensor = field(default_factory=T3Tensor)

    # Fractal V3 Value Tensor
    v3: V3Tensor = field(default_factory=V3Tensor)

    # Metadata
    action_count: int = 0
    success_count: int = 0
    last_action: Optional[str] = None
    created_at: Optional[str] = None

    # =========================================================================
    # Backward-compatible property accessors for subdimensions
    # =========================================================================

    @property
    def competence(self) -> float:
        return self.t3.competence

    @competence.setter
    def competence(self, value: float):
        self.t3.talent_sub.competence = value

    @property
    def alignment(self) -> float:
        return self.t3.alignment

    @alignment.setter
    def alignment(self, value: float):
        self.t3.talent_sub.alignment = value

    @property
    def lineage(self) -> float:
        return self.t3.lineage

    @lineage.setter
    def lineage(self, value: float):
        self.t3.training_sub.lineage = value

    @property
    def witnesses(self) -> float:
        return self.t3.witnesses

    @witnesses.setter
    def witnesses(self, value: float):
        self.t3.training_sub.witnesses = value

    @property
    def reliability(self) -> float:
        return self.t3.reliability

    @reliability.setter
    def reliability(self, value: float):
        self.t3.temperament_sub.reliability = value

    @property
    def consistency(self) -> float:
        return self.t3.consistency

    @consistency.setter
    def consistency(self, value: float):
        self.t3.temperament_sub.consistency = value

    # V3 subdimension accessors
    @property
    def reputation(self) -> float:
        return self.v3.reputation

    @reputation.setter
    def reputation(self, value: float):
        self.v3.valuation_sub.reputation = value

    @property
    def contribution(self) -> float:
        return self.v3.contribution

    @contribution.setter
    def contribution(self, value: float):
        self.v3.valuation_sub.contribution = value

    @property
    def stewardship(self) -> float:
        return self.v3.stewardship

    @stewardship.setter
    def stewardship(self, value: float):
        self.v3.veracity_sub.stewardship = value

    @property
    def energy(self) -> float:
        return self.v3.energy

    @energy.setter
    def energy(self, value: float):
        self.v3.veracity_sub.energy = value

    @property
    def network(self) -> float:
        return self.v3.network

    @network.setter
    def network(self, value: float):
        self.v3.validity_sub.network = value

    @property
    def temporal(self) -> float:
        return self.v3.temporal

    @temporal.setter
    def temporal(self, value: float):
        self.v3.validity_sub.temporal = value

    # =========================================================================
    # Tensor aggregate methods
    # =========================================================================

    def t3_composite(self) -> float:
        """
        Weighted composite T3 trust score per Web4 spec.

        Formula: talent * 0.3 + training * 0.4 + temperament * 0.3
        """
        return self.t3.composite()

    def t3_average(self) -> float:
        """
        @deprecated Use t3_composite() for spec-compliant scoring.
        Average of all 6 subdimensions for backward compatibility.
        """
        return (self.competence + self.reliability + self.consistency +
                self.witnesses + self.lineage + self.alignment) / 6

    def v3_composite(self) -> float:
        """Composite V3 value score."""
        return self.v3.composite()

    def v3_average(self) -> float:
        """
        @deprecated Use v3_composite() for spec-compliant scoring.
        Average of all 6 subdimensions for backward compatibility.
        """
        return (self.energy + self.contribution + self.stewardship +
                self.network + self.reputation + self.temporal) / 6

    def update_from_outcome(self, success: bool, is_novel: bool = False):
        """
        Update trust based on action outcome per Web4 spec.

        | Outcome         | Talent Impact | Training Impact | Temperament Impact |
        |-----------------|---------------|-----------------|-------------------|
        | Novel Success   | +0.02 to +0.05| +0.01 to +0.02  | +0.01             |
        | Standard Success| 0             | +0.005 to +0.01 | +0.005            |
        | Failure         | -0.02         | -0.01           | -0.02             |
        """
        self.action_count += 1
        if success:
            self.success_count += 1

        # Use the spec-compliant T3Tensor update
        self.t3.update_from_outcome(success, is_novel)

        # Update V3 contribution and energy based on outcome
        clamp = lambda v: max(0.0, min(1.0, v))
        if success:
            self.v3.valuation_sub.contribution = clamp(self.contribution + 0.01)
            self.v3.veracity_sub.energy = clamp(self.energy + 0.01)
        else:
            self.v3.valuation_sub.contribution = clamp(self.contribution - 0.005)

        self.last_action = datetime.now(timezone.utc).isoformat()

    def trust_level(self) -> str:
        """
        Categorical trust level based on T3 composite score.

        Uses weighted composite per Web4 spec, not simple average.
        """
        return self.t3.level()

    def apply_decay(self, days_inactive: float, decay_rate: float = 0.01) -> bool:
        """
        Apply trust decay based on inactivity.

        Trust decays slowly over time if not used. This prevents
        stale trust from persisting indefinitely.

        Decay primarily affects Temperament (reliability, consistency)
        and V3 temporal/energy dimensions.

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

        old_reliability = self.reliability

        # Decay Temperament subdimensions (reliability most affected)
        self.t3.temperament_sub.reliability = decay_value(self.reliability)
        self.t3.temperament_sub.consistency = decay_value(self.consistency * 0.98)

        # Talent.competence decays slower (skills don't fade as fast)
        self.t3.talent_sub.competence = decay_value(self.competence * 0.995)

        # Decay V3 Validity.temporal (time-based value)
        self.v3.validity_sub.temporal = decay_value(self.temporal)

        # Decay V3 Veracity.energy (effort fades)
        self.v3.veracity_sub.energy = decay_value(self.energy * 0.99)

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
        """
        Serialize to dict.

        Includes both fractal structure (t3/v3) and flattened subdimensions
        for backward compatibility.
        """
        return {
            "role_id": self.role_id,
            # Fractal T3 tensor
            "t3": self.t3.to_dict(),
            # Fractal V3 tensor (simplified)
            "v3": {
                "valuation": self.v3.valuation,
                "veracity": self.v3.veracity,
                "validity": self.v3.validity,
                "reputation": self.reputation,
                "contribution": self.contribution,
                "stewardship": self.stewardship,
                "energy": self.energy,
                "network": self.network,
                "temporal": self.temporal,
                "composite": self.v3.composite(),
            },
            # Legacy 6D flattened view (backward compatibility)
            "competence": self.competence,
            "reliability": self.reliability,
            "consistency": self.consistency,
            "witnesses": self.witnesses,
            "lineage": self.lineage,
            "alignment": self.alignment,
            "energy": self.energy,
            "contribution": self.contribution,
            "stewardship": self.stewardship,
            "network": self.network,
            "reputation": self.reputation,
            "temporal": self.temporal,
            # Metadata
            "action_count": self.action_count,
            "success_count": self.success_count,
            "last_action": self.last_action,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'RoleTrust':
        """
        Deserialize from dict.

        Handles both new fractal format and legacy 6D flat format.
        """
        role = cls(
            role_id=data.get("role_id", ""),
            action_count=data.get("action_count", 0),
            success_count=data.get("success_count", 0),
            last_action=data.get("last_action"),
            created_at=data.get("created_at"),
        )

        # Check if data has new fractal t3 structure
        if "t3" in data and isinstance(data["t3"], dict):
            role.t3 = T3Tensor.from_dict(data["t3"])
        else:
            # Migrate from legacy 6D flat format
            role.t3 = migrate_legacy_t3({
                "competence": data.get("competence", 0.5),
                "reliability": data.get("reliability", 0.5),
                "consistency": data.get("consistency", 0.5),
                "witnesses": data.get("witnesses", 0.5),
                "lineage": data.get("lineage", 0.5),
                "alignment": data.get("alignment", 0.5),
            })

        # Check if data has new fractal v3 structure
        if "v3" in data and isinstance(data["v3"], dict):
            role.v3 = migrate_legacy_v3({
                "reputation": data["v3"].get("reputation", 0.5),
                "contribution": data["v3"].get("contribution", 0.5),
                "stewardship": data["v3"].get("stewardship", 0.5),
                "energy": data["v3"].get("energy", 0.5),
                "network": data["v3"].get("network", 0.5),
                "temporal": data["v3"].get("temporal", 0.5),
            })
        else:
            # Migrate from legacy 6D flat format
            role.v3 = migrate_legacy_v3({
                "reputation": data.get("reputation", 0.5),
                "contribution": data.get("contribution", 0.5),
                "stewardship": data.get("stewardship", 0.5),
                "energy": data.get("energy", 0.5),
                "network": data.get("network", 0.5),
                "temporal": data.get("temporal", 0.5),
            })

        return role


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
        Uses spec-compliant T3 composite score.
        """
        trust = self.get(role_id)
        t3_composite = trust.t3_composite()

        return {
            "can_read": True,  # Always allowed
            "can_write": t3_composite >= 0.3,
            "can_execute": t3_composite >= 0.4,
            "can_network": t3_composite >= 0.5,
            "can_delegate": t3_composite >= 0.6,
            "max_atp_per_action": int(10 + 90 * t3_composite),
            "trust_level": trust.trust_level(),
            "t3_composite": round(t3_composite, 3),
            "t3_average": round(trust.t3_average(), 3),  # Legacy compatibility
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
