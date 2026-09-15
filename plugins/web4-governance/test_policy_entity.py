#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Test suite for Policy Entity integration

"""
Tests for PolicyEntity - policy as a first-class participant in the trust network.

Covers:
- Policy creation with hash identification
- Policy registration and persistence
- Policy evaluation (allow/deny/warn)
- Policy witnessing
- Integration with presets
"""

import json
import pytest
import tempfile
import shutil
from pathlib import Path

from governance.policy_entity import PolicyEntity, PolicyRegistry, PolicyEvaluation
from governance.presets import (
    PolicyConfig,
    PolicyRule,
    PolicyMatch,
    RateLimitSpec,
    resolve_preset,
    get_preset,
    SAFETY_RULES,
)
from governance.rate_limiter import RateLimiter


@pytest.fixture
def temp_storage():
    """Create temporary storage directory."""
    tmp = tempfile.mkdtemp()
    yield Path(tmp)
    shutil.rmtree(tmp)


class TestPolicyEntity:
    """Tests for PolicyEntity class."""

    def test_entity_creation(self, temp_storage):
        """Test creating a policy entity."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("test", preset="safety")

        assert entity.name == "test"
        assert entity.source == "preset"
        assert entity.entity_id.startswith("policy:test:")
        assert len(entity.content_hash) == 16  # SHA256 first 16 chars

    def test_entity_hash_uniqueness(self, temp_storage):
        """Test that different configs produce different hashes."""
        registry = PolicyRegistry(temp_storage)

        entity1 = registry.register_policy("safety", preset="safety")
        entity2 = registry.register_policy("permissive", preset="permissive")

        assert entity1.content_hash != entity2.content_hash
        assert entity1.entity_id != entity2.entity_id

    def test_entity_hash_consistency(self, temp_storage):
        """Test that same config produces same hash."""
        registry = PolicyRegistry(temp_storage)

        entity1 = registry.register_policy("safety", preset="safety", version="v1")
        entity2 = registry.register_policy("safety", preset="safety", version="v1")

        # Same version and preset should return cached entity
        assert entity1.entity_id == entity2.entity_id
        assert entity1.content_hash == entity2.content_hash

    def test_entity_persistence(self, temp_storage):
        """Test that policy entity is persisted to disk."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("test", preset="strict")

        # Check file exists
        policy_file = temp_storage / "policies" / f"{entity.content_hash}.json"
        assert policy_file.exists()

        # Verify content
        data = json.loads(policy_file.read_text())
        assert data["name"] == "test"
        assert data["entity_id"] == entity.entity_id

    def test_entity_reload(self, temp_storage):
        """Test loading policy entity from disk."""
        registry1 = PolicyRegistry(temp_storage)
        entity1 = registry1.register_policy("test", preset="safety")

        # Create new registry (simulates restart)
        registry2 = PolicyRegistry(temp_storage)
        entity2 = registry2.get_policy(entity1.entity_id)

        assert entity2 is not None
        assert entity2.entity_id == entity1.entity_id
        assert entity2.content_hash == entity1.content_hash
        assert entity2.config.default_policy == entity1.config.default_policy

    def test_entity_to_dict(self, temp_storage):
        """Test serialization to dict."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("test", preset="safety")

        data = entity.to_dict()

        assert data["entity_id"] == entity.entity_id
        assert data["name"] == "test"
        assert data["content_hash"] == entity.content_hash
        assert "config" in data
        assert data["config"]["default_policy"] == "allow"


class TestPolicyEvaluation:
    """Tests for policy evaluation logic."""

    def test_evaluate_allow_default(self, temp_storage):
        """Test default allow policy."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("permissive", preset="permissive")

        result = entity.evaluate("Read", "file_read", "/tmp/test.txt")

        assert result.decision == "allow"
        assert result.rule_id is None
        assert "default" in result.reason.lower()

    def test_evaluate_deny_destructive(self, temp_storage):
        """Test safety preset blocks destructive commands."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("safety", preset="safety")

        # Test with realistic folder path, not root
        result = entity.evaluate("Bash", "command", "rm -rf ./temp_build")

        assert result.decision == "deny"
        assert result.rule_id == "deny-destructive-commands"
        assert result.enforced is True

    def test_evaluate_deny_secrets(self, temp_storage):
        """Test safety preset blocks secret file reads."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("safety", preset="safety")

        result = entity.evaluate("Read", "file_read", "/app/.env")

        assert result.decision == "deny"
        assert result.rule_id == "deny-secret-files"

    def test_evaluate_warn_network(self, temp_storage):
        """Test safety preset warns on network."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("safety", preset="safety")

        result = entity.evaluate("WebFetch", "network", "https://example.com")

        assert result.decision == "warn"
        assert result.rule_id == "warn-network"

    def test_evaluate_strict_deny_default(self, temp_storage):
        """Test strict preset denies by default."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("strict", preset="strict")

        result = entity.evaluate("Bash", "command", "ls")

        assert result.decision == "deny"
        assert result.rule_id is None  # Default policy, not a rule
        assert "default" in result.reason.lower()

    def test_evaluate_strict_allow_read(self, temp_storage):
        """Test strict preset allows read tools."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("strict", preset="strict")

        for tool in ["Read", "Glob", "Grep", "TodoWrite"]:
            result = entity.evaluate(tool, "file_read", "/tmp/test.txt")
            assert result.decision == "allow", f"Expected allow for {tool}"
            assert result.rule_id == "allow-read-tools"

    def test_evaluate_constraints(self, temp_storage):
        """Test evaluation returns constraints."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("safety", preset="safety")

        # Test with realistic folder path, not root
        result = entity.evaluate("Bash", "command", "rm -rf ./node_modules")

        assert f"policy:{entity.entity_id}" in result.constraints
        assert "decision:deny" in result.constraints
        assert "rule:deny-destructive-commands" in result.constraints


class TestPolicyWithRateLimiter:
    """Tests for rate limit evaluation."""

    def test_rate_limit_under_threshold(self, temp_storage):
        """Test rate limit allows under threshold."""
        config = PolicyConfig(
            default_policy="deny",
            enforce=True,
            rules=[
                PolicyRule(
                    id="rate-bash",
                    name="Rate limit Bash",
                    priority=1,
                    decision="deny",
                    match=PolicyMatch(
                        tools=["Bash"],
                        rate_limit=RateLimitSpec(max_count=5, window_ms=60000),
                    ),
                ),
            ],
        )

        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("rate-test", config=config)
        limiter = RateLimiter()

        # Under limit - rule doesn't fire, falls through to default
        result = entity.evaluate("Bash", "command", "ls", rate_limiter=limiter)
        # Since rate limit check passes (0 < 5), the rule doesn't match
        # Falls through to default policy which is "deny"
        assert result.decision == "deny"
        assert result.rule_id is None  # Default, not the rate rule

    def test_rate_limit_over_threshold(self, temp_storage):
        """Test rate limit triggers over threshold."""
        config = PolicyConfig(
            default_policy="allow",
            enforce=True,
            rules=[
                PolicyRule(
                    id="rate-bash",
                    name="Rate limit Bash",
                    priority=1,
                    decision="deny",
                    match=PolicyMatch(
                        tools=["Bash"],
                        rate_limit=RateLimitSpec(max_count=2, window_ms=60000),
                    ),
                ),
            ],
        )

        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("rate-test", config=config)
        limiter = RateLimiter()

        # Record actions to exceed limit
        key = "ratelimit:rate-bash:tool:Bash"
        limiter.record(key)
        limiter.record(key)

        # Now at limit - rule fires
        result = entity.evaluate("Bash", "command", "ls", rate_limiter=limiter)
        assert result.decision == "deny"
        assert result.rule_id == "rate-bash"


class TestPolicyWitnessing:
    """Tests for policy witnessing."""

    def test_witness_session(self, temp_storage):
        """Test session witnessing policy."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("safety", preset="safety")

        # Witness session
        registry.witness_session(entity.entity_id, "session-123")

        # Check entity trust was affected (witnessing records in witnessed_by)
        trust = registry.get_policy_trust(entity.entity_id)
        assert "session:session-123" in trust.witnessed_by

    def test_witness_decision(self, temp_storage):
        """Test policy witnessing decision."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("safety", preset="safety")

        # Initial trust
        trust_before = registry.get_policy_trust(entity.entity_id)
        initial_witness_count = trust_before.witness_count

        # Witness successful decision
        registry.witness_decision(entity.entity_id, "session-123", "Read", "allow", success=True)

        # Check trust updated (policy witnesses the session, so has_witnessed grows)
        trust_after = registry.get_policy_trust(entity.entity_id)
        assert "session:session-123" in trust_after.has_witnessed

    def test_witness_deny_failure(self, temp_storage):
        """Test witnessing a denied action (counts as failure)."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("safety", preset="safety")

        # Witness denied action
        registry.witness_decision(entity.entity_id, "session-123", "Bash", "deny", success=False)

        # Entity should record the witnessing
        trust = registry.get_policy_trust(entity.entity_id)
        assert "session:session-123" in trust.has_witnessed

    def test_witness_host_lct(self, temp_storage):
        """Test session witnessing a host LCT (reverse direction of fleet bootstrap scan)."""
        import json
        registry = PolicyRegistry(temp_storage)

        registry.witness_host_lct(
            session_id="session-abc",
            host_lct_id="83810b44-2289-4c14-854f-ae5114f747cf",
            host_lct_fingerprint="3d13e0dd2d426e9f",
            salience_axis="host-lct fingerprint at observation time",
        )

        host_entity = "lct:web4:host:83810b44-2289-4c14-854f-ae5114f747cf"
        session_entity = "session:session-abc"

        # Bidirectional graph: session is recorded as a witness of the host LCT
        assert session_entity in registry.get_witnessed_by(host_entity)
        assert host_entity in registry.get_has_witnessed(session_entity)

        # Persistence: a registry rebuilt from disk preserves the relationship
        registry2 = PolicyRegistry(temp_storage)
        assert session_entity in registry2.get_witnessed_by(host_entity)

        # And the JSONL line carries the salience-aware fields
        records = [json.loads(l) for l in (temp_storage / "witnesses.jsonl").read_text().splitlines() if l.strip()]
        host_records = [r for r in records if r.get("type") == "host_lct_witness"]
        assert len(host_records) == 1
        r = host_records[0]
        assert r["entity"] == host_entity
        assert r["witness"] == session_entity
        assert r["host_lct_fingerprint"] == "3d13e0dd2d426e9f"
        assert r["salience_axis"] == "host-lct fingerprint at observation time"

    def test_witness_host_lct_multiple_sessions(self, temp_storage):
        """Multiple sessions on the same host all witness the same host LCT — convergence is the trust signal."""
        registry = PolicyRegistry(temp_storage)
        host_lct_id = "83810b44-2289-4c14-854f-ae5114f747cf"

        for sid in ("session-1", "session-2", "session-3"):
            registry.witness_host_lct(
                session_id=sid,
                host_lct_id=host_lct_id,
                host_lct_fingerprint="3d13e0dd2d426e9f",
            )

        host_entity = f"lct:web4:host:{host_lct_id}"
        witnesses = registry.get_witnessed_by(host_entity)
        assert len(witnesses) == 3
        assert "session:session-1" in witnesses
        assert "session:session-2" in witnesses
        assert "session:session-3" in witnesses


class TestPolicyRegistry:
    """Tests for PolicyRegistry."""

    def test_list_policies(self, temp_storage):
        """Test listing all policies."""
        registry = PolicyRegistry(temp_storage)
        registry.register_policy("safety", preset="safety")
        registry.register_policy("strict", preset="strict")

        policies = registry.list_policies()

        assert len(policies) == 2
        names = [p.name for p in policies]
        assert "safety" in names
        assert "strict" in names

    def test_get_policy_by_hash(self, temp_storage):
        """Test getting policy by content hash."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("test", preset="safety")

        found = registry.get_policy_by_hash(entity.content_hash)

        assert found is not None
        assert found.entity_id == entity.entity_id

    def test_register_custom_config(self, temp_storage):
        """Test registering custom policy config."""
        config = PolicyConfig(
            default_policy="warn",
            enforce=False,
            rules=[
                PolicyRule(
                    id="custom-rule",
                    name="Custom Rule",
                    priority=1,
                    decision="deny",
                    match=PolicyMatch(categories=["command"]),
                ),
            ],
        )

        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("custom", config=config)

        assert entity.source == "custom"
        assert entity.config.default_policy == "warn"
        assert len(entity.config.rules) == 1

    def test_register_requires_config_or_preset(self, temp_storage):
        """Test that registration requires config or preset."""
        registry = PolicyRegistry(temp_storage)

        with pytest.raises(ValueError):
            registry.register_policy("invalid")

    def test_register_rejects_both_config_and_preset(self, temp_storage):
        """Test that registration rejects both config and preset."""
        registry = PolicyRegistry(temp_storage)
        config = PolicyConfig(default_policy="allow", enforce=False, rules=[])

        with pytest.raises(ValueError):
            registry.register_policy("invalid", config=config, preset="safety")


class TestPolicyEntityId:
    """Tests for policy entity ID format."""

    def test_entity_id_format(self, temp_storage):
        """Test entity ID follows policy:<name>:<version>:<hash> format."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("test", preset="safety", version="v1")

        parts = entity.entity_id.split(":")
        assert len(parts) == 4
        assert parts[0] == "policy"
        assert parts[1] == "test"
        assert parts[2] == "v1"
        assert parts[3] == entity.content_hash

    def test_auto_version(self, temp_storage):
        """Test auto-generated version is timestamp."""
        registry = PolicyRegistry(temp_storage)
        entity = registry.register_policy("test", preset="safety")

        parts = entity.entity_id.split(":")
        version = parts[2]

        # Should be YYYYMMDDHHmmss format
        assert len(version) == 14
        assert version.isdigit()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
