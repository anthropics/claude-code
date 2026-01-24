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

# Storage location
ENTITIES_DIR = Path.home() / ".web4" / "governance" / "entities"


@dataclass
class EntityTrust:
    """
    Trust tensors for any Web4 entity.

    Same T3/V3 structure as RoleTrust but for any entity type.
    """
    entity_id: str  # Format: type:name (e.g., mcp:filesystem, role:code-reviewer)
    entity_type: str = ""  # Parsed from entity_id
    entity_name: str = ""  # Parsed from entity_id

    # T3 Trust Tensor (6 dimensions)
    competence: float = 0.5
    reliability: float = 0.5
    consistency: float = 0.5
    witnesses: float = 0.5  # How many have witnessed this entity
    lineage: float = 0.5
    alignment: float = 0.5

    # V3 Value Tensor (6 dimensions)
    energy: float = 0.5
    contribution: float = 0.5
    stewardship: float = 0.5
    network: float = 0.5
    reputation: float = 0.5
    temporal: float = 0.5

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
        Update trust based on direct action outcome.
        """
        self.action_count += 1
        if success:
            self.success_count += 1

        # Calculate delta (asymmetric: failures hit harder)
        if success:
            delta = magnitude * 0.05 * (1 - self.reliability)
        else:
            delta = -magnitude * 0.10 * self.reliability

        # Update T3 dimensions
        self.reliability = max(0, min(1, self.reliability + delta))
        self.consistency = max(0, min(1, self.consistency + delta * 0.5))
        self.competence = max(0, min(1, self.competence + delta * 0.3))

        # Update lineage based on action history
        if self.action_count > 0:
            success_rate = self.success_count / self.action_count
            self.lineage = 0.2 + 0.8 * (success_rate ** 0.5) * min(1.0, self.action_count / 100)

        self.last_action = datetime.now(timezone.utc).isoformat()

    def receive_witness(self, witness_id: str, success: bool, magnitude: float = 0.05):
        """
        Another entity witnessed this entity's action.

        Being witnessed builds:
        - witnesses score (more observers = more validated)
        - reputation (V3) - external perception
        - network (V3) - connection to other entities
        """
        self.witness_count += 1

        if witness_id not in self.witnessed_by:
            self.witnessed_by.append(witness_id)

        # Witnessing has a smaller effect than direct outcomes
        if success:
            delta = magnitude * 0.03 * (1 - self.witnesses)
        else:
            delta = -magnitude * 0.05 * self.witnesses

        # Update witness-related dimensions
        self.witnesses = max(0, min(1, self.witnesses + delta))
        self.reputation = max(0, min(1, self.reputation + delta * 0.8))
        self.network = max(0, min(1, self.network + 0.01))  # Network grows with connections

    def give_witness(self, target_id: str, success: bool, magnitude: float = 0.02):
        """
        This entity witnessed another entity's action.

        Being a witness builds:
        - alignment (if judgment was correct, entity is aligned with reality)
        - contribution (V3) - value added through validation
        """
        if target_id not in self.has_witnessed:
            self.has_witnessed.append(target_id)

        # Witnessing others builds own credibility slightly
        if success:
            delta = magnitude * 0.02 * (1 - self.alignment)
        else:
            # Witnessing failures doesn't hurt the witness
            delta = magnitude * 0.01 * (1 - self.alignment)

        self.alignment = max(0, min(1, self.alignment + delta))
        self.contribution = max(0, min(1, self.contribution + 0.005))

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
    def from_dict(cls, data: dict) -> 'EntityTrust':
        # Handle list fields that might be missing
        if 'witnessed_by' not in data:
            data['witnessed_by'] = []
        if 'has_witnessed' not in data:
            data['has_witnessed'] = []
        return cls(**data)


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
