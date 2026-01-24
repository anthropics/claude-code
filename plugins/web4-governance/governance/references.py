# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Reference Store
# https://github.com/dp-web4/web4
"""
Persistent reference store for agent roles with witnessing.

References are learned patterns, facts, and context extractions that
persist across sessions for a given role. This enables agents to:

- Remember patterns they've learned
- Recall facts extracted from previous sessions
- Build on prior context without re-reading everything
- Accumulate role-specific knowledge

References are Web4 entities with trust:
- Each reference has a trust score that evolves through witnessing
- When a reference is used and the task succeeds, its trust increases
- When a reference is used and the task fails, its trust decreases
- High-trust references are prioritized in context injection
- Low-trust references fade out (self-curation)

This is the "accumulating reference" part of Web4 agent governance.
"""

import json
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Tuple
from dataclasses import dataclass, field, asdict

from .ledger import Ledger


# Storage location
REFERENCES_DIR = Path.home() / ".web4" / "governance" / "references"


@dataclass
class Reference:
    """
    A piece of learned/extracted context for a role.

    Represents information that persists across sessions:
    - Patterns observed in code/data
    - Facts extracted from documents
    - User preferences learned over time
    - Context summaries from previous sessions

    References are Web4 entities with witnessed trust:
    - trust_score evolves through witnessing (usage outcomes)
    - success_count/failure_count track correlation with task outcomes
    - High trust = more likely to be included in context
    - Low trust = self-curated out over time
    """
    ref_id: str
    role_id: str
    content: str
    source: str  # Where it came from (file, session, user input)
    ref_type: str  # pattern, fact, preference, context, summary

    # Quality indicators
    confidence: float = 0.5  # Initial confidence when created
    relevance: float = 0.5   # How relevant to current work

    # Trust through witnessing (evolves over time)
    trust_score: float = 0.5  # Current trust (0.0-1.0)
    success_count: int = 0    # Times used in successful tasks
    failure_count: int = 0    # Times used in failed tasks

    # Lifecycle
    created_at: Optional[str] = None
    last_used: Optional[str] = None
    use_count: int = 0

    # Metadata
    tags: List[str] = field(default_factory=list)
    expires_at: Optional[str] = None  # Optional expiration

    def witness_outcome(self, success: bool, magnitude: float = 0.1):
        """
        Update trust based on task outcome when this reference was used.

        Same asymmetric pattern as other trust: easier to lose than gain.
        """
        self.use_count += 1
        self.last_used = datetime.now(timezone.utc).isoformat()

        if success:
            self.success_count += 1
            # Diminishing returns as trust approaches 1.0
            delta = magnitude * 0.05 * (1 - self.trust_score)
        else:
            self.failure_count += 1
            # Bigger fall from height
            delta = -magnitude * 0.10 * self.trust_score

        self.trust_score = max(0.0, min(1.0, self.trust_score + delta))

    def effective_trust(self) -> float:
        """
        Combined trust score considering initial confidence and witnessed trust.

        New references rely more on confidence, mature ones on trust_score.
        """
        if self.use_count == 0:
            return self.confidence
        elif self.use_count < 5:
            # Blend: more weight to confidence for new refs
            weight = self.use_count / 5
            return (1 - weight) * self.confidence + weight * self.trust_score
        else:
            # Mature: trust_score dominates
            return self.trust_score

    def trust_level(self) -> str:
        """Categorical trust level."""
        t = self.effective_trust()
        if t >= 0.8:
            return "high"
        elif t >= 0.6:
            return "medium-high"
        elif t >= 0.4:
            return "medium"
        elif t >= 0.2:
            return "low"
        else:
            return "minimal"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> 'Reference':
        # Handle missing fields gracefully
        if 'tags' not in data:
            data['tags'] = []
        if 'trust_score' not in data:
            data['trust_score'] = data.get('confidence', 0.5)
        if 'success_count' not in data:
            data['success_count'] = 0
        if 'failure_count' not in data:
            data['failure_count'] = 0
        return cls(**data)


class ReferenceStore:
    """
    Persistent storage for role-specific references.

    Each role (agent type) has its own reference collection.
    References persist across sessions and can be:
    - Added during work
    - Queried for context
    - Updated with usage stats
    - Pruned when stale
    """

    def __init__(self, ledger: Optional[Ledger] = None):
        REFERENCES_DIR.mkdir(parents=True, exist_ok=True)
        self.ledger = ledger

    def _role_refs_file(self, role_id: str) -> Path:
        """Get file path for role references."""
        safe_name = hashlib.sha256(role_id.encode()).hexdigest()[:16]
        return REFERENCES_DIR / f"{safe_name}.jsonl"

    def add(
        self,
        role_id: str,
        content: str,
        source: str,
        ref_type: str = "context",
        confidence: float = 0.5,
        tags: Optional[List[str]] = None
    ) -> Reference:
        """
        Add a reference for a role.

        Args:
            role_id: The agent role this reference belongs to
            content: The reference content (pattern, fact, etc.)
            source: Where this came from (file path, session ID, etc.)
            ref_type: Type of reference (pattern, fact, preference, context, summary)
            confidence: Confidence in this reference (0.0-1.0)
            tags: Optional tags for categorization

        Returns:
            The created Reference
        """
        ref = Reference(
            ref_id=f"ref:{uuid.uuid4().hex[:12]}",
            role_id=role_id,
            content=content,
            source=source,
            ref_type=ref_type,
            confidence=confidence,
            tags=tags or [],
            created_at=datetime.now(timezone.utc).isoformat()
        )

        # Append to role's reference file
        refs_file = self._role_refs_file(role_id)
        with open(refs_file, "a") as f:
            f.write(json.dumps(ref.to_dict()) + "\n")

        return ref

    def get_for_role(self, role_id: str, limit: int = 50) -> List[Reference]:
        """
        Get recent references for a role.

        Returns most recent references up to limit.
        """
        refs_file = self._role_refs_file(role_id)

        if not refs_file.exists():
            return []

        refs = []
        with open(refs_file) as f:
            for line in f:
                if line.strip():
                    try:
                        refs.append(Reference.from_dict(json.loads(line)))
                    except (json.JSONDecodeError, TypeError):
                        pass

        # Return most recent
        return refs[-limit:]

    def search(
        self,
        role_id: str,
        query: str,
        ref_type: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[Reference]:
        """
        Search references by content, type, or tags.

        Args:
            role_id: Role to search
            query: Text to search in content
            ref_type: Filter by reference type
            tags: Filter by tags (any match)
            limit: Maximum results

        Returns:
            Matching references sorted by relevance
        """
        refs = self.get_for_role(role_id, limit=500)
        query_lower = query.lower()

        matches = []
        for ref in refs:
            # Check content match
            if query_lower not in ref.content.lower():
                continue

            # Check type filter
            if ref_type and ref.ref_type != ref_type:
                continue

            # Check tags filter
            if tags:
                if not any(t in ref.tags for t in tags):
                    continue

            matches.append(ref)

        # Sort by confidence, recency, and use count
        matches.sort(key=lambda r: (
            r.confidence,
            r.use_count,
            r.created_at or ""
        ), reverse=True)

        return matches[:limit]

    def mark_used(self, ref_id: str, role_id: str):
        """
        Mark a reference as used (update stats).

        This helps track which references are valuable.
        """
        refs_file = self._role_refs_file(role_id)

        if not refs_file.exists():
            return

        # Read all, update matching, rewrite
        refs = []
        with open(refs_file) as f:
            for line in f:
                if line.strip():
                    try:
                        ref = Reference.from_dict(json.loads(line))
                        if ref.ref_id == ref_id:
                            ref.use_count += 1
                            ref.last_used = datetime.now(timezone.utc).isoformat()
                        refs.append(ref)
                    except (json.JSONDecodeError, TypeError):
                        pass

        # Rewrite file
        with open(refs_file, "w") as f:
            for ref in refs:
                f.write(json.dumps(ref.to_dict()) + "\n")

    def witness_references(
        self,
        role_id: str,
        ref_ids: List[str],
        success: bool,
        magnitude: float = 0.1
    ) -> List[Reference]:
        """
        Witness multiple references based on task outcome.

        When a task completes, all references that were used get their
        trust updated based on whether the task succeeded or failed.

        This enables self-curation: helpful references gain trust,
        unhelpful ones lose it and eventually fade out.

        Args:
            role_id: The role whose references to update
            ref_ids: List of reference IDs that were used
            success: Whether the task succeeded
            magnitude: How much to adjust trust (default 0.1)

        Returns:
            List of updated references
        """
        refs_file = self._role_refs_file(role_id)

        if not refs_file.exists():
            return []

        # Read all, update matching, rewrite
        refs = []
        updated = []
        ref_ids_set = set(ref_ids)

        with open(refs_file) as f:
            for line in f:
                if line.strip():
                    try:
                        ref = Reference.from_dict(json.loads(line))
                        if ref.ref_id in ref_ids_set:
                            ref.witness_outcome(success, magnitude)
                            updated.append(ref)
                        refs.append(ref)
                    except (json.JSONDecodeError, TypeError):
                        pass

        # Rewrite file
        with open(refs_file, "w") as f:
            for ref in refs:
                f.write(json.dumps(ref.to_dict()) + "\n")

        return updated

    def witness_all_for_role(
        self,
        role_id: str,
        success: bool,
        magnitude: float = 0.05
    ) -> int:
        """
        Witness all recently-used references for a role.

        Simpler version: if a role's task succeeds/fails, all references
        that were recently used get a trust update.

        Returns: Number of references updated
        """
        refs_file = self._role_refs_file(role_id)

        if not refs_file.exists():
            return 0

        now = datetime.now(timezone.utc)
        refs = []
        updated_count = 0

        with open(refs_file) as f:
            for line in f:
                if line.strip():
                    try:
                        ref = Reference.from_dict(json.loads(line))

                        # Check if recently used (within last hour)
                        if ref.last_used:
                            last = datetime.fromisoformat(ref.last_used.replace("Z", "+00:00"))
                            if (now - last).total_seconds() < 3600:
                                ref.witness_outcome(success, magnitude)
                                updated_count += 1

                        refs.append(ref)
                    except (json.JSONDecodeError, TypeError, ValueError):
                        pass

        # Rewrite file
        with open(refs_file, "w") as f:
            for ref in refs:
                f.write(json.dumps(ref.to_dict()) + "\n")

        return updated_count

    def get_context_for_role(
        self,
        role_id: str,
        max_tokens: int = 2000,
        min_trust: float = 0.2
    ) -> Tuple[str, List[str]]:
        """
        Get consolidated context string for a role, prioritized by trust.

        Self-curation: High-trust references are included first.
        Low-trust references (below min_trust) are excluded.

        Args:
            role_id: Role to get context for
            max_tokens: Approximate token limit (chars / 4)
            min_trust: Minimum trust score to include (default 0.2)

        Returns:
            Tuple of (formatted context string, list of ref_ids used)
        """
        refs = self.get_for_role(role_id, limit=50)

        if not refs:
            return "", []

        # Filter by minimum trust and sort by effective trust
        trusted_refs = [r for r in refs if r.effective_trust() >= min_trust]
        trusted_refs.sort(key=lambda r: r.effective_trust(), reverse=True)

        # Group by type
        by_type: Dict[str, List[Reference]] = {}
        for ref in trusted_refs:
            if ref.ref_type not in by_type:
                by_type[ref.ref_type] = []
            by_type[ref.ref_type].append(ref)

        # Build context string
        lines = ["## Prior Context for This Role\n"]
        char_count = 0
        char_limit = max_tokens * 4
        used_ref_ids = []

        for ref_type in ["pattern", "fact", "preference", "context", "summary"]:
            if ref_type not in by_type:
                continue

            lines.append(f"\n### {ref_type.title()}s\n")

            # Already sorted by trust within type
            for ref in by_type[ref_type][:5]:  # Max 5 per type
                if char_count > char_limit:
                    break

                entry = f"- {ref.content[:200]}"

                # Show trust indicator
                trust_lvl = ref.trust_level()
                if trust_lvl == "high":
                    entry += " ★"
                elif trust_lvl == "medium-high":
                    entry += " ☆"

                lines.append(entry)
                char_count += len(entry)
                used_ref_ids.append(ref.ref_id)

                # Mark as used
                ref.use_count += 1
                ref.last_used = datetime.now(timezone.utc).isoformat()

        # Save updated use counts
        self._save_refs(role_id, refs)

        return "\n".join(lines), used_ref_ids

    def _save_refs(self, role_id: str, refs: List[Reference]):
        """Save all references for a role."""
        refs_file = self._role_refs_file(role_id)
        with open(refs_file, "w") as f:
            for ref in refs:
                f.write(json.dumps(ref.to_dict()) + "\n")

    def prune_stale(self, role_id: str, max_age_days: int = 90) -> int:
        """
        Remove old, unused references.

        Returns number of references pruned.
        """
        refs_file = self._role_refs_file(role_id)

        if not refs_file.exists():
            return 0

        now = datetime.now(timezone.utc)
        kept = []
        pruned = 0

        with open(refs_file) as f:
            for line in f:
                if line.strip():
                    try:
                        ref = Reference.from_dict(json.loads(line))

                        # Keep if used recently or high confidence
                        if ref.use_count > 0 or ref.confidence >= 0.8:
                            kept.append(ref)
                            continue

                        # Check age
                        if ref.created_at:
                            created = datetime.fromisoformat(ref.created_at.replace("Z", "+00:00"))
                            age = (now - created).days
                            if age <= max_age_days:
                                kept.append(ref)
                                continue

                        pruned += 1

                    except (json.JSONDecodeError, TypeError, ValueError):
                        pass

        # Rewrite file
        with open(refs_file, "w") as f:
            for ref in kept:
                f.write(json.dumps(ref.to_dict()) + "\n")

        return pruned

    def get_stats(self, role_id: str) -> dict:
        """Get statistics about references for a role."""
        refs = self.get_for_role(role_id, limit=1000)

        if not refs:
            return {
                "role_id": role_id,
                "total_references": 0,
                "by_type": {},
                "avg_confidence": 0.0,
                "total_uses": 0
            }

        by_type: Dict[str, int] = {}
        total_confidence = 0.0
        total_uses = 0

        for ref in refs:
            by_type[ref.ref_type] = by_type.get(ref.ref_type, 0) + 1
            total_confidence += ref.confidence
            total_uses += ref.use_count

        return {
            "role_id": role_id,
            "total_references": len(refs),
            "by_type": by_type,
            "avg_confidence": total_confidence / len(refs),
            "total_uses": total_uses
        }
