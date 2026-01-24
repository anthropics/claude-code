# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Reference Store
# https://github.com/dp-web4/web4
"""
Persistent reference store for agent roles.

References are learned patterns, facts, and context extractions that
persist across sessions for a given role. This enables agents to:

- Remember patterns they've learned
- Recall facts extracted from previous sessions
- Build on prior context without re-reading everything
- Accumulate role-specific knowledge

This is the "accumulating reference" part of Web4 agent governance.
"""

import json
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict
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
    """
    ref_id: str
    role_id: str
    content: str
    source: str  # Where it came from (file, session, user input)
    ref_type: str  # pattern, fact, preference, context, summary

    # Quality indicators
    confidence: float = 0.5  # How confident in this reference
    relevance: float = 0.5   # How relevant to current work

    # Lifecycle
    created_at: Optional[str] = None
    last_used: Optional[str] = None
    use_count: int = 0

    # Metadata
    tags: List[str] = field(default_factory=list)
    expires_at: Optional[str] = None  # Optional expiration

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> 'Reference':
        # Handle missing fields gracefully
        if 'tags' not in data:
            data['tags'] = []
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

    def get_context_for_role(self, role_id: str, max_tokens: int = 2000) -> str:
        """
        Get consolidated context string for a role.

        Useful for injecting prior knowledge into agent prompts.

        Args:
            role_id: Role to get context for
            max_tokens: Approximate token limit (chars / 4)

        Returns:
            Formatted context string
        """
        refs = self.get_for_role(role_id, limit=30)

        if not refs:
            return ""

        # Group by type
        by_type: Dict[str, List[Reference]] = {}
        for ref in refs:
            if ref.ref_type not in by_type:
                by_type[ref.ref_type] = []
            by_type[ref.ref_type].append(ref)

        # Build context string
        lines = ["## Prior Context for This Role\n"]
        char_count = 0
        char_limit = max_tokens * 4

        for ref_type in ["pattern", "fact", "preference", "context", "summary"]:
            if ref_type not in by_type:
                continue

            lines.append(f"\n### {ref_type.title()}s\n")

            for ref in by_type[ref_type][:5]:  # Max 5 per type
                if char_count > char_limit:
                    break

                entry = f"- {ref.content[:200]}"
                if ref.confidence >= 0.8:
                    entry += " [high confidence]"

                lines.append(entry)
                char_count += len(entry)

        return "\n".join(lines)

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
