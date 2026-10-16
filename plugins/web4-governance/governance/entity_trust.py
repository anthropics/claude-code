# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Entity Trust
# https://github.com/dp-web4/web4
"""
Entity trust with witnessing.

Any Web4 entity can accumulate trust through witnessing:
- MCP servers → tool calls witnessed by Claude
- Agent roles → task completions witnessed by session
- References → usage in successful tasks witnessed by agent
- Context blocks → helpfulness witnessed by outcomes

Key concept: Trust flows through witnessing relationships.
When entity A witnesses entity B succeed, both accumulate trust:
- B gains reliability (it worked)
- A gains alignment (its judgment was validated)

Entity Types:
- mcp:{server_name} - MCP server
- role:{agent_name} - Agent role
- ref:{reference_id} - Reference/context
- session:{session_id} - Session identity
"""

import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field, asdict

from .tensors import (
    T3Tensor, V3Tensor,
    TalentSubdims, TrainingSubdims, TemperamentSubdims,
    ValuationSubdims, VeracitySubdims, ValiditySubdims,
    migrate_legacy_t3, migrate_legacy_v3,
)

# Storage location
ENTITIES_DIR = Path.home() / ".web4" / "governance" / "entities"


@dataclass
class EntityTrust:
    """
    Trust tensors for any Web4 entity.

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
    a role context. Full implementation binds to RDF/LCT entities.
    """
    entity_id: str  # Format: type:name (e.g., mcp:filesystem, role:code-reviewer)
    entity_type: str = ""  # Parsed from entity_id
    entity_name: str = ""  # Parsed from entity_id

    # Fractal T3 Trust Tensor
    t3: T3Tensor = field(default_factory=T3Tensor)

    # Fractal V3 Value Tensor
    v3: V3Tensor = field(default_factory=V3Tensor)

    # Witnessing relationships
    witnessed_by: List[str] = field(default_factory=list)  # Entities that witnessed this
    has_witnessed: List[str] = field(default_factory=list)  # Entities this has witnessed

    # Metadata
    action_count: int = 0
    success_count: int = 0
    witness_count: int = 0  # Times witnessed by others
    last_action: Optional[str] = None
    created_at: Optional[str] = None

    def __post_init__(self):
        # Parse entity_id into type and name
        if ":" in self.entity_id and not self.entity_type:
            parts = self.entity_id.split(":", 1)
            self.entity_type = parts[0]
            self.entity_name = parts[1] if len(parts) > 1 else ""

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
        Update trust based on direct action outcome per Web4 spec.

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

        # Update V3 contribution based on outcome
        clamp = lambda v: max(0.0, min(1.0, v))
        if success:
            self.v3.valuation_sub.contribution = clamp(self.contribution + 0.01)
            self.v3.veracity_sub.energy = clamp(self.energy + 0.005)
        else:
            self.v3.valuation_sub.contribution = clamp(self.contribution - 0.005)

        self.last_action = datetime.now(timezone.utc).isoformat()

    def receive_witness(self, witness_id: str, success: bool, magnitude: float = 0.05):
        """
        Another entity witnessed this entity's action.

        Being witnessed builds:
        - witnesses score (Training subdim - more observers = more validated)
        - reputation (V3 Valuation subdim) - external perception
        - network (V3 Validity subdim) - connection to other entities
        """
        self.witness_count += 1

        if witness_id not in self.witnessed_by:
            self.witnessed_by.append(witness_id)

        clamp = lambda v: max(0.0, min(1.0, v))

        # Witnessing has a smaller effect than direct outcomes
        if success:
            delta = magnitude * 0.03 * (1 - self.witnesses)
        else:
            delta = -magnitude * 0.05 * self.witnesses

        # Update Training.witnesses subdimension
        self.t3.training_sub.witnesses = clamp(self.witnesses + delta)
        # Update V3 Valuation.reputation
        self.v3.valuation_sub.reputation = clamp(self.reputation + delta * 0.8)
        # Update V3 Validity.network (grows with connections)
        self.v3.validity_sub.network = clamp(self.network + 0.01)

    def give_witness(self, target_id: str, success: bool, magnitude: float = 0.02):
        """
        This entity witnessed another entity's action.

        Being a witness builds:
        - alignment (Talent subdim - if judgment was correct, entity is aligned)
        - contribution (V3 Valuation subdim) - value added through validation
        """
        if target_id not in self.has_witnessed:
            self.has_witnessed.append(target_id)

        clamp = lambda v: max(0.0, min(1.0, v))

        # Witnessing others builds own credibility slightly
        if success:
            delta = magnitude * 0.02 * (1 - self.alignment)
        else:
            # Witnessing failures doesn't hurt the witness
            delta = magnitude * 0.01 * (1 - self.alignment)

        # Update Talent.alignment subdimension
        self.t3.talent_sub.alignment = clamp(self.alignment + delta)
        # Update V3 Valuation.contribution
        self.v3.valuation_sub.contribution = clamp(self.contribution + 0.005)

    def trust_level(self) -> str:
        """
        Categorical trust level based on T3 composite score.

        Uses weighted composite per Web4 spec, not simple average.
        """
        return self.t3.level()

    def apply_decay(self, days_inactive: float, decay_rate: float = 0.01) -> bool:
        """
        Apply trust decay based on inactivity.

        Trust decays slowly over time if not used.
        Primarily affects Temperament (reliability, consistency) and temporal.

        Args:
            days_inactive: Days since last action
            decay_rate: Decay rate per day

        Returns:
            True if decay was applied
        """
        if days_inactive <= 0:
            return False

        decay_factor = (1 - decay_rate) ** days_inactive
        floor = 0.3

        def decay_value(current: float) -> float:
            return max(floor, floor + (current - floor) * decay_factor)

        old_reliability = self.reliability

        # Decay Temperament subdimensions (reliability and consistency)
        self.t3.temperament_sub.reliability = decay_value(self.reliability)
        self.t3.temperament_sub.consistency = decay_value(self.consistency * 0.98)

        # Decay V3 Validity.temporal
        self.v3.validity_sub.temporal = decay_value(self.temporal)

        return abs(old_reliability - self.reliability) > 0.001

    def apply_silence_penalty(self, severity: str = "overdue") -> bool:
        """
        Apply trust penalty for unexpected silence (absence when expected).

        Silence is a signal: entities that go quiet when expected to be active
        should see trust impact. This implements "the dog that didn't bark".

        Severity levels:
        - "expected": Minor - entity should check in soon (no penalty yet)
        - "overdue": Moderate - past grace period, warrants attention
        - "missing": Significant - well past expected, may indicate problem

        Args:
            severity: One of "expected", "overdue", "missing"

        Returns:
            True if penalty was applied
        """
        if severity == "expected":
            # No penalty yet, just tracking
            return False

        elif severity == "overdue":
            # Moderate impact on reliability and consistency
            penalty = 0.02
            self.reliability = max(0.1, self.reliability - penalty)
            self.consistency = max(0.1, self.consistency - penalty * 0.5)
            return True

        elif severity == "missing":
            # Significant impact - entity may be unreliable
            penalty = 0.05
            self.reliability = max(0.1, self.reliability - penalty)
            self.consistency = max(0.1, self.consistency - penalty)
            self.temporal = max(0.1, self.temporal - penalty * 0.5)
            return True

        return False

    def days_since_last_action(self) -> float:
        """Calculate days since last action."""
        if not self.last_action:
            if self.created_at:
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
            return delta.total_seconds() / 86400
        except (ValueError, TypeError):
            return 0

    def to_dict(self) -> dict:
        """
        Serialize to dict.

        Includes both fractal structure (t3/v3) and flattened subdimensions
        for backward compatibility.
        """
        return {
            "entity_id": self.entity_id,
            "entity_type": self.entity_type,
            "entity_name": self.entity_name,
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
            # Witnessing relationships
            "witnessed_by": self.witnessed_by,
            "has_witnessed": self.has_witnessed,
            # Metadata
            "action_count": self.action_count,
            "success_count": self.success_count,
            "witness_count": self.witness_count,
            "last_action": self.last_action,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'EntityTrust':
        """
        Deserialize from dict.

        Handles both new fractal format and legacy 6D flat format.
        """
        # Handle list fields that might be missing
        if 'witnessed_by' not in data:
            data['witnessed_by'] = []
        if 'has_witnessed' not in data:
            data['has_witnessed'] = []

        entity = cls(
            entity_id=data.get("entity_id", ""),
            entity_type=data.get("entity_type", ""),
            entity_name=data.get("entity_name", ""),
            witnessed_by=data.get("witnessed_by", []),
            has_witnessed=data.get("has_witnessed", []),
            action_count=data.get("action_count", 0),
            success_count=data.get("success_count", 0),
            witness_count=data.get("witness_count", 0),
            last_action=data.get("last_action"),
            created_at=data.get("created_at"),
        )

        # Check if data has new fractal t3 structure
        if "t3" in data and isinstance(data["t3"], dict):
            entity.t3 = T3Tensor.from_dict(data["t3"])
        else:
            # Migrate from legacy 6D flat format
            entity.t3 = migrate_legacy_t3({
                "competence": data.get("competence", 0.5),
                "reliability": data.get("reliability", 0.5),
                "consistency": data.get("consistency", 0.5),
                "witnesses": data.get("witnesses", 0.5),
                "lineage": data.get("lineage", 0.5),
                "alignment": data.get("alignment", 0.5),
            })

        # Check if data has new fractal v3 structure
        if "v3" in data and isinstance(data["v3"], dict):
            entity.v3 = migrate_legacy_v3({
                "reputation": data["v3"].get("reputation", 0.5),
                "contribution": data["v3"].get("contribution", 0.5),
                "stewardship": data["v3"].get("stewardship", 0.5),
                "energy": data["v3"].get("energy", 0.5),
                "network": data["v3"].get("network", 0.5),
                "temporal": data["v3"].get("temporal", 0.5),
            })
        else:
            # Migrate from legacy 6D flat format
            entity.v3 = migrate_legacy_v3({
                "reputation": data.get("reputation", 0.5),
                "contribution": data.get("contribution", 0.5),
                "stewardship": data.get("stewardship", 0.5),
                "energy": data.get("energy", 0.5),
                "network": data.get("network", 0.5),
                "temporal": data.get("temporal", 0.5),
            })

        return entity


class EntityTrustStore:
    """
    Persistent storage for entity trust with witnessing.

    Supports any entity type: MCP servers, agent roles, references, etc.
    """

    def __init__(self):
        ENTITIES_DIR.mkdir(parents=True, exist_ok=True)

    def _entity_file(self, entity_id: str) -> Path:
        """Get file path for entity trust data."""
        safe_name = hashlib.sha256(entity_id.encode()).hexdigest()[:16]
        return ENTITIES_DIR / f"{safe_name}.json"

    def get(self, entity_id: str) -> EntityTrust:
        """Get trust for entity, creating with defaults if new."""
        entity_file = self._entity_file(entity_id)

        if entity_file.exists():
            with open(entity_file) as f:
                data = json.load(f)
            return EntityTrust.from_dict(data)

        # New entity with default trust
        trust = EntityTrust(
            entity_id=entity_id,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        self.save(trust)
        return trust

    def save(self, trust: EntityTrust):
        """Save entity trust to disk."""
        entity_file = self._entity_file(trust.entity_id)
        with open(entity_file, "w") as f:
            json.dump(trust.to_dict(), f, indent=2)

    def update(self, entity_id: str, success: bool, magnitude: float = 0.1) -> EntityTrust:
        """Update entity trust based on action outcome."""
        trust = self.get(entity_id)
        trust.update_from_outcome(success, magnitude)
        self.save(trust)
        return trust

    def witness(self, witness_id: str, target_id: str, success: bool,
                magnitude: float = 0.1) -> Tuple[EntityTrust, EntityTrust]:
        """
        Record a witnessing event.

        witness_id observes target_id succeed or fail.
        Both entities' trust is updated.

        Returns: (witness_trust, target_trust)
        """
        # Update target (being witnessed)
        target = self.get(target_id)
        target.receive_witness(witness_id, success, magnitude)
        self.save(target)

        # Update witness (doing the witnessing)
        witness = self.get(witness_id)
        witness.give_witness(target_id, success, magnitude)
        self.save(witness)

        return witness, target

    def list_entities(self, entity_type: Optional[str] = None) -> List[str]:
        """List all known entity IDs, optionally filtered by type."""
        entities = []
        for f in ENTITIES_DIR.glob("*.json"):
            try:
                with open(f) as file:
                    data = json.load(file)
                    eid = data.get("entity_id", "")
                    if entity_type is None or data.get("entity_type") == entity_type:
                        entities.append(eid)
            except Exception:
                pass
        return entities

    def get_by_type(self, entity_type: str) -> Dict[str, EntityTrust]:
        """Get all entities of a specific type."""
        return {
            eid: self.get(eid)
            for eid in self.list_entities(entity_type)
        }

    def get_mcp_servers(self) -> Dict[str, EntityTrust]:
        """Get all MCP server entities."""
        return self.get_by_type("mcp")

    def get_witnessing_chain(self, entity_id: str, depth: int = 3) -> dict:
        """
        Get the witnessing chain for an entity.

        Shows who has witnessed this entity and who it has witnessed.
        """
        entity = self.get(entity_id)

        chain = {
            "entity_id": entity_id,
            "t3_average": entity.t3_average(),
            "trust_level": entity.trust_level(),
            "witnessed_by": [],
            "has_witnessed": []
        }

        if depth > 0:
            for witness_id in entity.witnessed_by[:10]:  # Limit for performance
                witness = self.get(witness_id)
                chain["witnessed_by"].append({
                    "entity_id": witness_id,
                    "t3_average": witness.t3_average(),
                    "trust_level": witness.trust_level()
                })

            for target_id in entity.has_witnessed[:10]:
                target = self.get(target_id)
                chain["has_witnessed"].append({
                    "entity_id": target_id,
                    "t3_average": target.t3_average(),
                    "trust_level": target.trust_level()
                })

        return chain

    def apply_decay_all(self, decay_rate: float = 0.01) -> Dict[str, dict]:
        """
        Apply trust decay to all entities based on inactivity.

        Should be called periodically (e.g., at session start) to
        ensure trust reflects recency.

        Args:
            decay_rate: Decay rate per day (default 1% per day)

        Returns:
            Dict of {entity_id: {decayed, days_inactive, t3_before, t3_after}}
        """
        results = {}

        for entity_id in self.list_entities():
            trust = self.get(entity_id)
            days_inactive = trust.days_since_last_action()

            if days_inactive > 1:  # Only decay if > 1 day inactive
                t3_before = trust.t3_average()
                decayed = trust.apply_decay(days_inactive, decay_rate)

                if decayed:
                    self.save(trust)
                    results[entity_id] = {
                        "decayed": True,
                        "days_inactive": round(days_inactive, 1),
                        "t3_before": round(t3_before, 3),
                        "t3_after": round(trust.t3_average(), 3),
                        "entity_type": trust.entity_type
                    }

        return results

    def get_with_decay(self, entity_id: str, decay_rate: float = 0.01) -> EntityTrust:
        """
        Get trust for entity, applying decay if needed.

        Convenience method that applies decay before returning trust.
        """
        trust = self.get(entity_id)
        days_inactive = trust.days_since_last_action()

        if days_inactive > 1:
            if trust.apply_decay(days_inactive, decay_rate):
                self.save(trust)

        return trust


# Convenience functions for common entity types
def get_mcp_trust(server_name: str) -> EntityTrust:
    """Get trust for an MCP server."""
    store = EntityTrustStore()
    return store.get(f"mcp:{server_name}")


def update_mcp_trust(server_name: str, success: bool, witness_id: str = "session:current") -> EntityTrust:
    """
    Update MCP server trust after a tool call.

    The session witnesses the MCP's action.
    """
    store = EntityTrustStore()

    # Direct outcome update
    mcp_trust = store.update(f"mcp:{server_name}", success)

    # Session witnesses the MCP
    store.witness(witness_id, f"mcp:{server_name}", success, magnitude=0.05)

    return mcp_trust
