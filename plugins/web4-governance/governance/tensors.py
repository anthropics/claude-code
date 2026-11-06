# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Tensor Definitions
# https://github.com/dp-web4/web4
"""
Canonical T3/V3 Tensor Structure.

The tensors are FRACTAL:
- Base: 3 dimensions each
- Each dimension expands to implementation-specific subdimensions
- Full implementation: RDF-bound links to LCTs for roles, entities

## T3 Trust Tensor (Base 3D)

Per spec (t3-v3-tensors.md):
- Talent: Role-specific capability, natural aptitude
- Training: Role-specific expertise, learned skills
- Temperament: Role-contextual reliability, consistency

## V3 Value Tensor (Base 3D)

Per spec:
- Valuation: Subjective worth, perceived value
- Veracity: Objective accuracy, truthfulness
- Validity: Confirmed transfer, actual delivery

## Subdimension Mapping

This implementation expands each base dimension into 2 subdimensions
for finer-grained tracking:

T3:
  Talent     → competence (can do), alignment (values fit)
  Training   → lineage (history), witnesses (validation)
  Temperament → reliability (consistency), consistency (quality)

V3:
  Valuation  → reputation (perception), contribution (value added)
  Veracity   → stewardship (care), energy (effort)
  Validity   → network (reach), temporal (time-based)

## Role Context

CRITICAL: T3/V3 tensors are NEVER absolute properties.
They exist only within role contexts. An entity trusted as
a surgeon has no inherent trust as a mechanic.

In full implementation, each tensor binds to:
- Entity LCT (who)
- Role LCT (in what capacity)
- Context (when/where)

Example RDF:
  _:tensor1 a web4:T3Tensor ;
      web4:entity lct:alice ;
      web4:role web4:Surgeon ;
      web4:talent 0.95 ;
      web4:training 0.92 ;
      web4:temperament 0.88 .
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, List
from datetime import datetime, timezone


# =============================================================================
# Base 3D Tensors (Canonical)
# =============================================================================

@dataclass
class T3Base:
    """
    T3 Trust Tensor - Base 3 Dimensions.

    Per Web4 spec, these are the canonical dimensions:
    - Talent: Role-specific capability
    - Training: Role-specific expertise
    - Temperament: Role-contextual reliability
    """
    talent: float = 0.5
    training: float = 0.5
    temperament: float = 0.5

    def composite(self) -> float:
        """
        Weighted composite score per spec.
        Formula: talent * 0.3 + training * 0.4 + temperament * 0.3
        """
        return self.talent * 0.3 + self.training * 0.4 + self.temperament * 0.3

    def level(self) -> str:
        """Categorical trust level."""
        score = self.composite()
        if score >= 0.8:
            return "high"
        elif score >= 0.6:
            return "medium-high"
        elif score >= 0.4:
            return "medium"
        elif score >= 0.2:
            return "low"
        return "minimal"


@dataclass
class V3Base:
    """
    V3 Value Tensor - Base 3 Dimensions.

    Per Web4 spec, these are the canonical dimensions:
    - Valuation: Subjective worth
    - Veracity: Objective accuracy
    - Validity: Confirmed transfer
    """
    valuation: float = 0.5
    veracity: float = 0.5
    validity: float = 0.5

    def composite(self) -> float:
        """Weighted composite value score."""
        return (self.valuation + self.veracity + self.validity) / 3


# =============================================================================
# Subdimension Expansions
# =============================================================================

@dataclass
class TalentSubdims:
    """Subdimensions of Talent."""
    competence: float = 0.5  # Can they do it?
    alignment: float = 0.5   # Values match context?

    def aggregate(self) -> float:
        return (self.competence + self.alignment) / 2


@dataclass
class TrainingSubdims:
    """Subdimensions of Training."""
    lineage: float = 0.5    # Track record / history
    witnesses: float = 0.5  # Corroborated by others?

    def aggregate(self) -> float:
        return (self.lineage + self.witnesses) / 2


@dataclass
class TemperamentSubdims:
    """Subdimensions of Temperament."""
    reliability: float = 0.5   # Will they do it consistently?
    consistency: float = 0.5   # Same quality over time?

    def aggregate(self) -> float:
        return (self.reliability + self.consistency) / 2


@dataclass
class ValuationSubdims:
    """Subdimensions of Valuation."""
    reputation: float = 0.5    # External perception
    contribution: float = 0.5  # Value added

    def aggregate(self) -> float:
        return (self.reputation + self.contribution) / 2


@dataclass
class VeracitySubdims:
    """Subdimensions of Veracity."""
    stewardship: float = 0.5  # Care for resources
    energy: float = 0.5       # Effort invested

    def aggregate(self) -> float:
        return (self.stewardship + self.energy) / 2


@dataclass
class ValiditySubdims:
    """Subdimensions of Validity."""
    network: float = 0.5   # Connections / reach
    temporal: float = 0.5  # Time-based accumulation

    def aggregate(self) -> float:
        return (self.network + self.temporal) / 2


# =============================================================================
# Full Fractal Tensors
# =============================================================================

@dataclass
class T3Tensor:
    """
    Full T3 Trust Tensor with subdimensions.

    Structure:
        T3 (base 3D)
        ├── Talent
        │   ├── competence
        │   └── alignment
        ├── Training
        │   ├── lineage
        │   └── witnesses
        └── Temperament
            ├── reliability
            └── consistency
    """
    # Subdimensions (the 6D flattened view)
    talent_sub: TalentSubdims = field(default_factory=TalentSubdims)
    training_sub: TrainingSubdims = field(default_factory=TrainingSubdims)
    temperament_sub: TemperamentSubdims = field(default_factory=TemperamentSubdims)

    # Role context (for full implementation)
    role: Optional[str] = None
    entity: Optional[str] = None

    @property
    def talent(self) -> float:
        """Base Talent dimension (aggregate of subdimensions)."""
        return self.talent_sub.aggregate()

    @property
    def training(self) -> float:
        """Base Training dimension (aggregate of subdimensions)."""
        return self.training_sub.aggregate()

    @property
    def temperament(self) -> float:
        """Base Temperament dimension (aggregate of subdimensions)."""
        return self.temperament_sub.aggregate()

    def base(self) -> T3Base:
        """Get base 3D tensor."""
        return T3Base(
            talent=self.talent,
            training=self.training,
            temperament=self.temperament
        )

    def composite(self) -> float:
        """Weighted composite per spec."""
        return self.talent * 0.3 + self.training * 0.4 + self.temperament * 0.3

    def level(self) -> str:
        """Categorical trust level."""
        return self.base().level()

    # Convenience accessors for 6D flattened view
    @property
    def competence(self) -> float:
        return self.talent_sub.competence

    @property
    def alignment(self) -> float:
        return self.talent_sub.alignment

    @property
    def lineage(self) -> float:
        return self.training_sub.lineage

    @property
    def witnesses(self) -> float:
        return self.training_sub.witnesses

    @property
    def reliability(self) -> float:
        return self.temperament_sub.reliability

    @property
    def consistency(self) -> float:
        return self.temperament_sub.consistency

    def update_from_outcome(self, success: bool, is_novel: bool = False):
        """
        Update tensor from outcome per Web4 spec.

        | Outcome         | Talent Impact | Training Impact | Temperament Impact |
        |-----------------|---------------|-----------------|-------------------|
        | Novel Success   | +0.02 to +0.05| +0.01 to +0.02  | +0.01             |
        | Standard Success| 0             | +0.005 to +0.01 | +0.005            |
        | Failure         | -0.02         | -0.01           | -0.02             |
        """
        clamp = lambda v: max(0.0, min(1.0, v))

        if success:
            if is_novel:
                # Novel success: all dimensions improve
                self.talent_sub.competence = clamp(self.talent_sub.competence + 0.03)
                self.talent_sub.alignment = clamp(self.talent_sub.alignment + 0.02)
                self.training_sub.lineage = clamp(self.training_sub.lineage + 0.015)
                self.training_sub.witnesses = clamp(self.training_sub.witnesses + 0.01)
                self.temperament_sub.reliability = clamp(self.temperament_sub.reliability + 0.01)
                self.temperament_sub.consistency = clamp(self.temperament_sub.consistency + 0.01)
            else:
                # Standard success: training and temperament improve
                self.training_sub.lineage = clamp(self.training_sub.lineage + 0.008)
                self.training_sub.witnesses = clamp(self.training_sub.witnesses + 0.005)
                self.temperament_sub.reliability = clamp(self.temperament_sub.reliability + 0.005)
                self.temperament_sub.consistency = clamp(self.temperament_sub.consistency + 0.005)
        else:
            # Failure: all dimensions decrease
            self.talent_sub.competence = clamp(self.talent_sub.competence - 0.02)
            self.talent_sub.alignment = clamp(self.talent_sub.alignment - 0.01)
            self.training_sub.lineage = clamp(self.training_sub.lineage - 0.01)
            self.training_sub.witnesses = clamp(self.training_sub.witnesses - 0.01)
            self.temperament_sub.reliability = clamp(self.temperament_sub.reliability - 0.02)
            self.temperament_sub.consistency = clamp(self.temperament_sub.consistency - 0.02)

    def to_dict(self) -> dict:
        """Serialize to dict (6D flattened view for compatibility)."""
        return {
            # Base dimensions (computed)
            "talent": self.talent,
            "training": self.training,
            "temperament": self.temperament,
            # Subdimensions (stored)
            "competence": self.competence,
            "alignment": self.alignment,
            "lineage": self.lineage,
            "witnesses": self.witnesses,
            "reliability": self.reliability,
            "consistency": self.consistency,
            # Context
            "role": self.role,
            "entity": self.entity,
            # Computed
            "composite": self.composite(),
            "level": self.level(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'T3Tensor':
        """Deserialize from dict."""
        tensor = cls(
            role=data.get("role"),
            entity=data.get("entity"),
        )
        # Load subdimensions
        if "competence" in data:
            tensor.talent_sub.competence = data["competence"]
        if "alignment" in data:
            tensor.talent_sub.alignment = data["alignment"]
        if "lineage" in data:
            tensor.training_sub.lineage = data["lineage"]
        if "witnesses" in data:
            tensor.training_sub.witnesses = data["witnesses"]
        if "reliability" in data:
            tensor.temperament_sub.reliability = data["reliability"]
        if "consistency" in data:
            tensor.temperament_sub.consistency = data["consistency"]
        return tensor

    @classmethod
    def from_6d(cls, competence: float = 0.5, reliability: float = 0.5,
                consistency: float = 0.5, witnesses: float = 0.5,
                lineage: float = 0.5, alignment: float = 0.5,
                role: Optional[str] = None, entity: Optional[str] = None) -> 'T3Tensor':
        """Create from legacy 6D format."""
        tensor = cls(role=role, entity=entity)
        tensor.talent_sub.competence = competence
        tensor.talent_sub.alignment = alignment
        tensor.training_sub.lineage = lineage
        tensor.training_sub.witnesses = witnesses
        tensor.temperament_sub.reliability = reliability
        tensor.temperament_sub.consistency = consistency
        return tensor


@dataclass
class V3Tensor:
    """
    Full V3 Value Tensor with subdimensions.

    Structure:
        V3 (base 3D)
        ├── Valuation
        │   ├── reputation
        │   └── contribution
        ├── Veracity
        │   ├── stewardship
        │   └── energy
        └── Validity
            ├── network
            └── temporal
    """
    valuation_sub: ValuationSubdims = field(default_factory=ValuationSubdims)
    veracity_sub: VeracitySubdims = field(default_factory=VeracitySubdims)
    validity_sub: ValiditySubdims = field(default_factory=ValiditySubdims)

    @property
    def valuation(self) -> float:
        return self.valuation_sub.aggregate()

    @property
    def veracity(self) -> float:
        return self.veracity_sub.aggregate()

    @property
    def validity(self) -> float:
        return self.validity_sub.aggregate()

    def base(self) -> V3Base:
        return V3Base(
            valuation=self.valuation,
            veracity=self.veracity,
            validity=self.validity
        )

    def composite(self) -> float:
        return (self.valuation + self.veracity + self.validity) / 3

    # Convenience accessors for 6D flattened view
    @property
    def reputation(self) -> float:
        return self.valuation_sub.reputation

    @property
    def contribution(self) -> float:
        return self.valuation_sub.contribution

    @property
    def stewardship(self) -> float:
        return self.veracity_sub.stewardship

    @property
    def energy(self) -> float:
        return self.veracity_sub.energy

    @property
    def network(self) -> float:
        return self.validity_sub.network

    @property
    def temporal(self) -> float:
        return self.validity_sub.temporal


# =============================================================================
# Migration Helpers
# =============================================================================

def migrate_legacy_t3(legacy: dict) -> T3Tensor:
    """
    Migrate from legacy 6D format to fractal tensor.

    Legacy format:
        competence, reliability, consistency, witnesses, lineage, alignment

    Maps to:
        Talent     ← competence, alignment
        Training   ← lineage, witnesses
        Temperament ← reliability, consistency
    """
    return T3Tensor.from_6d(
        competence=legacy.get("competence", 0.5),
        reliability=legacy.get("reliability", 0.5),
        consistency=legacy.get("consistency", 0.5),
        witnesses=legacy.get("witnesses", 0.5),
        lineage=legacy.get("lineage", 0.5),
        alignment=legacy.get("alignment", 0.5),
    )


def migrate_legacy_v3(legacy: dict) -> V3Tensor:
    """
    Migrate from legacy 6D format to fractal tensor.

    Legacy format:
        energy, contribution, stewardship, network, reputation, temporal

    Maps to:
        Valuation ← reputation, contribution
        Veracity  ← stewardship, energy
        Validity  ← network, temporal
    """
    tensor = V3Tensor()
    tensor.valuation_sub.reputation = legacy.get("reputation", 0.5)
    tensor.valuation_sub.contribution = legacy.get("contribution", 0.5)
    tensor.veracity_sub.stewardship = legacy.get("stewardship", 0.5)
    tensor.veracity_sub.energy = legacy.get("energy", 0.5)
    tensor.validity_sub.network = legacy.get("network", 0.5)
    tensor.validity_sub.temporal = legacy.get("temporal", 0.5)
    return tensor
