# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Policy Entity
# https://github.com/dp-web4/web4
"""
Policy Entity - Policy as a first-class participant in the trust network.

Policy isn't just configuration — it's society's law. It has identity,
can be witnessed, and is hash-tracked in the audit chain.

Key concepts:
- Policy is immutable once registered (changing = new entity)
- Sessions witness operating under a policy
- Policy witnesses agent decisions (allow/deny)
- R6 records reference the policy_hash in effect

Usage:
    from governance.policy_entity import PolicyEntity, PolicyRegistry

    # Register a policy (creates hash-identified entity)
    registry = PolicyRegistry()
    entity = registry.register_policy("safety", config)

    # Evaluate a tool call
    decision = entity.evaluate(tool_name, category, target)

    # Witness a decision
    entity.witness_decision(session_id, tool_name, decision, success=True)
"""

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Any, Literal
import re
import fnmatch

from .presets import (
    PolicyConfig,
    PolicyRule,
    PolicyMatch,
    get_preset,
    resolve_preset,
    policy_config_to_dict,
)
from .entity_trust import EntityTrustStore, EntityTrust


PolicyDecision = Literal["allow", "deny", "warn"]


@dataclass
class PolicyEvaluation:
    """Result of evaluating a tool call against policy."""
    decision: PolicyDecision
    rule_id: Optional[str]
    rule_name: Optional[str]
    reason: str
    enforced: bool
    constraints: List[str]


@dataclass
class PolicyEntity:
    """
    A policy as a first-class entity in the trust network.

    Properties:
    - entity_id: Unique identifier (policy:<name>:<version>:<hash>)
    - content_hash: SHA-256 of the policy document (first 16 chars)
    - config: The actual policy configuration
    - created_at: When this version was created
    - trust: T3/V3 tensors (via EntityTrustStore)
    """
    name: str
    version: str
    config: PolicyConfig
    content_hash: str
    entity_id: str
    created_at: str
    source: str = "preset"  # "preset", "custom", "file"

    # Sorted rules for evaluation (lower priority = evaluated first)
    _sorted_rules: List[PolicyRule] = field(default_factory=list, repr=False)

    def __post_init__(self):
        """Sort rules by priority after initialization."""
        self._sorted_rules = sorted(self.config.rules, key=lambda r: r.priority)

    def evaluate(
        self,
        tool_name: str,
        category: str,
        target: Optional[str] = None,
        rate_limiter: Optional[Any] = None,
    ) -> PolicyEvaluation:
        """
        Evaluate a tool call against this policy.

        Args:
            tool_name: Name of the tool (e.g., "Bash", "Write")
            category: Tool category (e.g., "command", "file_write")
            target: Target of the operation (file path, command, URL)
            rate_limiter: Optional RateLimiter for rate-based rules

        Returns:
            PolicyEvaluation with decision and context
        """
        for rule in self._sorted_rules:
            if self._matches_rule(tool_name, category, target, rule.match):
                # Check rate limit if specified
                if rule.match.rate_limit and rate_limiter:
                    key = self._rate_limit_key(rule, tool_name, category)
                    result = rate_limiter.check(
                        key,
                        rule.match.rate_limit.max_count,
                        rule.match.rate_limit.window_ms,
                    )
                    if result.allowed:
                        continue  # Under limit, rule doesn't fire

                enforced = rule.decision != "deny" or self.config.enforce
                return PolicyEvaluation(
                    decision=rule.decision,
                    rule_id=rule.id,
                    rule_name=rule.name,
                    reason=rule.reason or f"Matched rule: {rule.name}",
                    enforced=enforced,
                    constraints=[
                        f"policy:{self.entity_id}",
                        f"decision:{rule.decision}",
                        f"rule:{rule.id}",
                    ],
                )

        # No rule matched — default policy
        return PolicyEvaluation(
            decision=self.config.default_policy,
            rule_id=None,
            rule_name=None,
            reason=f"Default policy: {self.config.default_policy}",
            enforced=True,
            constraints=[
                f"policy:{self.entity_id}",
                f"decision:{self.config.default_policy}",
                "rule:default",
            ],
        )

    def _matches_rule(
        self,
        tool_name: str,
        category: str,
        target: Optional[str],
        match: PolicyMatch,
    ) -> bool:
        """Check if a tool call matches a rule's criteria (AND logic)."""
        # Tool match
        if match.tools and tool_name not in match.tools:
            return False

        # Category match
        if match.categories and category not in match.categories:
            return False

        # Target pattern match
        if match.target_patterns:
            if target is None:
                return False
            matched = False
            for pattern in match.target_patterns:
                if match.target_patterns_are_regex:
                    if re.search(pattern, target):
                        matched = True
                        break
                else:
                    # Glob pattern
                    if fnmatch.fnmatch(target, pattern):
                        matched = True
                        break
            if not matched:
                return False

        return True

    def _rate_limit_key(self, rule: PolicyRule, tool_name: str, category: str) -> str:
        """Build rate limit key from rule context."""
        if rule.match.tools:
            return f"ratelimit:{rule.id}:tool:{tool_name}"
        if rule.match.categories:
            return f"ratelimit:{rule.id}:category:{category}"
        return f"ratelimit:{rule.id}:global"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        return {
            "entity_id": self.entity_id,
            "name": self.name,
            "version": self.version,
            "content_hash": self.content_hash,
            "created_at": self.created_at,
            "source": self.source,
            "config": policy_config_to_dict(self.config),
        }


class PolicyRegistry:
    """
    Registry of policy entities with hash-tracking and witnessing.

    Policies are registered once and become immutable. Changing a policy
    creates a new entity with a new hash.
    """

    def __init__(self, storage_path: Optional[Path] = None):
        """
        Initialize registry.

        Args:
            storage_path: Base path for storage. Defaults to ~/.web4
        """
        if storage_path is None:
            storage_path = Path.home() / ".web4"
        self.storage_path = Path(storage_path)
        self.policies_path = self.storage_path / "policies"
        self.policies_path.mkdir(parents=True, exist_ok=True)

        # Entity trust store for witnessing
        self._trust_store = EntityTrustStore()

        # In-memory cache of loaded policies
        self._cache: Dict[str, PolicyEntity] = {}

    def register_policy(
        self,
        name: str,
        config: Optional[PolicyConfig] = None,
        preset: Optional[str] = None,
        version: Optional[str] = None,
    ) -> PolicyEntity:
        """
        Register a policy and create its entity.

        Args:
            name: Policy name (e.g., "safety", "my-custom-policy")
            config: PolicyConfig to register (mutually exclusive with preset)
            preset: Preset name to use as base (mutually exclusive with config)
            version: Version string (auto-generated if not provided)

        Returns:
            PolicyEntity with hash-identified entity_id
        """
        if config is None and preset is None:
            raise ValueError("Must provide either config or preset")
        if config is not None and preset is not None:
            raise ValueError("Cannot provide both config and preset")

        # Resolve config
        if preset:
            config = resolve_preset(preset)
            source = "preset"
        else:
            source = "custom"

        # Generate version if not provided
        if version is None:
            version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")

        # Compute content hash
        config_dict = policy_config_to_dict(config)
        content_str = json.dumps(config_dict, sort_keys=True)
        content_hash = hashlib.sha256(content_str.encode()).hexdigest()[:16]

        # Build entity ID
        entity_id = f"policy:{name}:{version}:{content_hash}"

        # Check cache
        if entity_id in self._cache:
            return self._cache[entity_id]

        # Create entity
        now = datetime.now(timezone.utc).isoformat() + "Z"
        entity = PolicyEntity(
            name=name,
            version=version,
            config=config,
            content_hash=content_hash,
            entity_id=entity_id,
            created_at=now,
            source=source,
        )

        # Persist policy document
        policy_file = self.policies_path / f"{content_hash}.json"
        if not policy_file.exists():
            policy_file.write_text(json.dumps(entity.to_dict(), indent=2))

        # Register in entity trust store (creates T3/V3 tensors)
        self._trust_store.get(entity_id)

        # Cache
        self._cache[entity_id] = entity

        return entity

    def get_policy(self, entity_id: str) -> Optional[PolicyEntity]:
        """Get a policy by entity ID."""
        if entity_id in self._cache:
            return self._cache[entity_id]

        # Try to load from disk by hash
        parts = entity_id.split(":")
        if len(parts) >= 4:
            content_hash = parts[3]
            policy_file = self.policies_path / f"{content_hash}.json"
            if policy_file.exists():
                data = json.loads(policy_file.read_text())
                entity = self._entity_from_dict(data)
                self._cache[entity_id] = entity
                return entity

        return None

    def get_policy_by_hash(self, content_hash: str) -> Optional[PolicyEntity]:
        """Get a policy by content hash."""
        policy_file = self.policies_path / f"{content_hash}.json"
        if policy_file.exists():
            data = json.loads(policy_file.read_text())
            entity = self._entity_from_dict(data)
            self._cache[entity.entity_id] = entity
            return entity
        return None

    def _entity_from_dict(self, data: Dict[str, Any]) -> PolicyEntity:
        """Reconstruct PolicyEntity from dict."""
        config_data = data["config"]
        rules = [
            PolicyRule(
                id=r["id"],
                name=r["name"],
                priority=r["priority"],
                decision=r["decision"],
                reason=r.get("reason"),
                match=PolicyMatch(
                    tools=r["match"].get("tools"),
                    categories=r["match"].get("categories"),
                    target_patterns=r["match"].get("target_patterns"),
                    target_patterns_are_regex=r["match"].get("target_patterns_are_regex", False),
                ),
            )
            for r in config_data.get("rules", [])
        ]
        config = PolicyConfig(
            default_policy=config_data["default_policy"],
            enforce=config_data["enforce"],
            rules=rules,
            preset=config_data.get("preset"),
        )
        return PolicyEntity(
            name=data["name"],
            version=data["version"],
            config=config,
            content_hash=data["content_hash"],
            entity_id=data["entity_id"],
            created_at=data["created_at"],
            source=data.get("source", "custom"),
        )

    def witness_session(self, policy_entity_id: str, session_id: str) -> None:
        """
        Record that a session is operating under this policy.

        Creates bidirectional witnessing:
        - Session witnesses the policy (I operate under these rules)
        - Policy witnesses the session (this session uses me)
        """
        session_entity = f"session:{session_id}"
        self._trust_store.witness(session_entity, policy_entity_id, success=True)

    def witness_decision(
        self,
        policy_entity_id: str,
        session_id: str,
        tool_name: str,
        decision: PolicyDecision,
        success: bool,
    ) -> None:
        """
        Record a policy decision in the witnessing chain.

        The policy witnesses the tool use, and the outcome (success/failure)
        affects trust in both directions.
        """
        session_entity = f"session:{session_id}"
        # Policy witnesses the decision
        self._trust_store.witness(policy_entity_id, session_entity, success=success)

    def get_policy_trust(self, policy_entity_id: str) -> EntityTrust:
        """Get trust tensors for a policy entity."""
        return self._trust_store.get(policy_entity_id)

    def list_policies(self) -> List[PolicyEntity]:
        """List all registered policies."""
        policies = []
        for policy_file in self.policies_path.glob("*.json"):
            try:
                data = json.loads(policy_file.read_text())
                entity = self._entity_from_dict(data)
                policies.append(entity)
            except (json.JSONDecodeError, KeyError):
                pass
        return policies
