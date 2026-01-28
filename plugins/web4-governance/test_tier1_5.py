#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
"""
Tests for Tier 1.5 features: Presets, Rate Limiting, Audit Query, Reporter.
"""

import pytest
import time
import tempfile
from pathlib import Path

from governance.presets import (
    get_preset,
    list_presets,
    is_preset_name,
    resolve_preset,
    policy_config_to_dict,
    PolicyRule,
    PolicyMatch,
)
from governance.rate_limiter import RateLimiter
from governance.ledger import Ledger
from governance.reporter import AuditReporter


class TestPresets:
    """Tests for policy presets."""

    def test_list_presets_returns_four(self):
        """Should return all four presets."""
        presets = list_presets()
        assert len(presets) == 4
        names = {p.name for p in presets}
        assert names == {"permissive", "safety", "strict", "audit-only"}

    def test_presets_have_descriptions(self):
        """All presets should have non-empty descriptions."""
        for preset in list_presets():
            assert preset.description
            assert len(preset.description) > 0

    def test_get_preset_by_name(self):
        """Should return preset by name."""
        safety = get_preset("safety")
        assert safety is not None
        assert safety.name == "safety"

    def test_get_preset_unknown(self):
        """Should return None for unknown preset."""
        assert get_preset("nonexistent") is None

    def test_is_preset_name(self):
        """Should validate preset names."""
        assert is_preset_name("safety") is True
        assert is_preset_name("strict") is True
        assert is_preset_name("bogus") is False
        assert is_preset_name("") is False

    def test_permissive_preset_structure(self):
        """Permissive should have no rules and enforce=false."""
        preset = get_preset("permissive")
        assert preset.config.rules == []
        assert preset.config.enforce is False
        assert preset.config.default_policy == "allow"

    def test_safety_preset_has_rules(self):
        """Safety should have rules and enforce=true."""
        preset = get_preset("safety")
        assert len(preset.config.rules) > 0
        assert preset.config.enforce is True
        assert preset.config.default_policy == "allow"

    def test_strict_preset_denies_by_default(self):
        """Strict should default deny with allow rules."""
        preset = get_preset("strict")
        assert preset.config.default_policy == "deny"
        assert preset.config.enforce is True
        assert len(preset.config.rules) > 0
        # All strict rules should be allow
        for rule in preset.config.rules:
            assert rule.decision == "allow"

    def test_audit_only_matches_safety_rules(self):
        """Audit-only should have same rules as safety but enforce=false."""
        safety = get_preset("safety")
        audit_only = get_preset("audit-only")
        assert audit_only.config.enforce is False
        # Rules should match
        assert len(audit_only.config.rules) == len(safety.config.rules)

    def test_resolve_preset_no_overrides(self):
        """Should return preset config with no overrides."""
        config = resolve_preset("safety")
        preset = get_preset("safety")
        assert config.default_policy == preset.config.default_policy
        assert config.enforce == preset.config.enforce
        assert config.preset == "safety"

    def test_resolve_preset_override_enforce(self):
        """Should override enforce flag."""
        config = resolve_preset("safety", enforce=False)
        assert config.enforce is False

    def test_resolve_preset_override_default_policy(self):
        """Should override default policy."""
        config = resolve_preset("safety", default_policy="deny")
        assert config.default_policy == "deny"

    def test_resolve_preset_append_rules(self):
        """Should append additional rules."""
        extra = PolicyRule(
            id="extra-rule",
            name="Extra",
            priority=100,
            decision="deny",
            match=PolicyMatch(tools=["Write"]),
        )
        config = resolve_preset("safety", additional_rules=[extra])
        preset = get_preset("safety")
        assert len(config.rules) == len(preset.config.rules) + 1
        assert config.rules[-1].id == "extra-rule"

    def test_resolve_preset_unknown_raises(self):
        """Should raise for unknown preset."""
        with pytest.raises(ValueError, match="Unknown policy preset"):
            resolve_preset("bogus")

    def test_policy_config_to_dict(self):
        """Should convert config to dict."""
        config = resolve_preset("safety")
        d = policy_config_to_dict(config)
        assert d["default_policy"] == "allow"
        assert d["enforce"] is True
        assert d["preset"] == "safety"
        assert isinstance(d["rules"], list)


class TestRateLimiter:
    """Tests for sliding window rate limiter."""

    def test_check_allows_when_empty(self):
        """Should allow when no actions recorded."""
        limiter = RateLimiter()
        result = limiter.check("key1", max_count=5, window_ms=60000)
        assert result.allowed is True
        assert result.current == 0
        assert result.limit == 5

    def test_check_allows_under_limit(self):
        """Should allow when under limit."""
        limiter = RateLimiter()
        limiter.record("key1")
        limiter.record("key1")
        result = limiter.check("key1", max_count=5, window_ms=60000)
        assert result.allowed is True
        assert result.current == 2

    def test_check_denies_at_limit(self):
        """Should deny when at limit."""
        limiter = RateLimiter()
        for _ in range(5):
            limiter.record("key1")
        result = limiter.check("key1", max_count=5, window_ms=60000)
        assert result.allowed is False
        assert result.current == 5

    def test_check_denies_over_limit(self):
        """Should deny when over limit."""
        limiter = RateLimiter()
        for _ in range(10):
            limiter.record("key1")
        result = limiter.check("key1", max_count=5, window_ms=60000)
        assert result.allowed is False
        assert result.current == 10

    def test_independent_keys(self):
        """Keys should be tracked independently."""
        limiter = RateLimiter()
        for _ in range(5):
            limiter.record("bash")
        limiter.record("read")
        assert limiter.check("bash", 5, 60000).allowed is False
        assert limiter.check("read", 5, 60000).allowed is True

    def test_key_count(self):
        """Should report correct key count."""
        limiter = RateLimiter()
        assert limiter.key_count == 0
        limiter.record("a")
        limiter.record("b")
        limiter.record("c")
        assert limiter.key_count == 3

    def test_count_method(self):
        """Should report count per key."""
        limiter = RateLimiter()
        assert limiter.count("new") == 0
        limiter.record("new")
        limiter.record("new")
        assert limiter.count("new") == 2

    def test_make_key(self):
        """Should build namespaced key."""
        assert RateLimiter.make_key("rule1", "Bash") == "ratelimit:rule1:Bash"


class TestAuditQuery:
    """Tests for audit query and filtering."""

    @pytest.fixture
    def ledger(self, tmp_path):
        """Create a ledger with test data."""
        db_path = tmp_path / "test.db"
        ledger = Ledger(db_path)

        # Create test session
        ledger.register_identity("lct:test", "machine", "user")
        ledger.start_session("sess1", "lct:test", "project")

        # Record various audit entries
        ledger.record_audit("sess1", "tool_use", "Read", "/foo/bar.ts", status="success",
                           r6_data={"request": {"category": "file_read"}})
        ledger.record_audit("sess1", "tool_use", "Bash", "ls -la", status="success",
                           r6_data={"request": {"category": "command"}})
        ledger.record_audit("sess1", "tool_use", "Bash", "rm -rf /", status="error",
                           r6_data={"request": {"category": "command"}, "result": {"error_message": "blocked"}})
        ledger.record_audit("sess1", "tool_use", "WebFetch", "https://example.com", status="blocked",
                           r6_data={"request": {"category": "network"}})
        ledger.record_audit("sess1", "tool_use", "Read", "/src/main.py", status="success",
                           r6_data={"request": {"category": "file_read"}})

        return ledger

    def test_query_all(self, ledger):
        """Should return all records when no filter."""
        results = ledger.query_audit(session_id="sess1")
        assert len(results) == 5

    def test_query_by_tool(self, ledger):
        """Should filter by tool name."""
        results = ledger.query_audit(session_id="sess1", tool="Bash")
        assert len(results) == 2
        assert all(r["tool_name"] == "Bash" for r in results)

    def test_query_by_status(self, ledger):
        """Should filter by status."""
        results = ledger.query_audit(session_id="sess1", status="error")
        assert len(results) == 1
        assert results[0]["status"] == "error"

    def test_query_by_status_blocked(self, ledger):
        """Should filter by blocked status."""
        results = ledger.query_audit(session_id="sess1", status="blocked")
        assert len(results) == 1
        assert results[0]["tool_name"] == "WebFetch"

    def test_query_by_category(self, ledger):
        """Should filter by category."""
        results = ledger.query_audit(session_id="sess1", category="file_read")
        assert len(results) == 2

    def test_query_by_target_pattern(self, ledger):
        """Should filter by target glob pattern."""
        results = ledger.query_audit(session_id="sess1", target_pattern="*.py")
        assert len(results) == 1
        assert "main.py" in results[0]["target"]

    def test_query_combined_filters(self, ledger):
        """Should combine multiple filters."""
        results = ledger.query_audit(session_id="sess1", tool="Bash", status="success")
        assert len(results) == 1

    def test_query_limit(self, ledger):
        """Should respect limit."""
        results = ledger.query_audit(session_id="sess1", limit=2)
        assert len(results) == 2

    def test_query_empty_results(self, ledger):
        """Should return empty for no matches."""
        results = ledger.query_audit(session_id="sess1", tool="NonexistentTool")
        assert len(results) == 0

    def test_get_audit_stats(self, ledger):
        """Should return aggregated stats."""
        stats = ledger.get_audit_stats(session_id="sess1")
        assert stats["total"] == 5
        assert stats["tool_counts"]["Read"] == 2
        assert stats["tool_counts"]["Bash"] == 2
        assert stats["status_counts"]["success"] == 3
        assert stats["category_counts"]["file_read"] == 2


class TestAuditReporter:
    """Tests for audit reporter."""

    def make_record(self, **kwargs):
        """Create a test audit record."""
        defaults = {
            "audit_id": "audit:test",
            "session_id": "sess1",
            "sequence": 1,
            "action_type": "tool_use",
            "tool_name": "Read",
            "target": "/foo/bar.ts",
            "status": "success",
            "timestamp": "2026-01-27T10:00:00Z",
            "r6_data": '{"request": {"category": "file_read"}, "result": {"duration_ms": 10}}',
        }
        defaults.update(kwargs)
        return defaults

    def make_records(self):
        """Create test records."""
        return [
            self.make_record(tool_name="Read", status="success", timestamp="2026-01-27T10:00:00Z"),
            self.make_record(tool_name="Read", status="success", timestamp="2026-01-27T10:00:30Z"),
            self.make_record(tool_name="Bash", status="success", timestamp="2026-01-27T10:01:00Z",
                            r6_data='{"request": {"category": "command"}, "result": {"duration_ms": 50}}'),
            self.make_record(tool_name="Bash", status="error", timestamp="2026-01-27T10:01:30Z",
                            r6_data='{"request": {"category": "command"}, "result": {"error_message": "exit 1"}}'),
            self.make_record(tool_name="WebFetch", status="blocked", timestamp="2026-01-27T10:02:00Z",
                            r6_data='{"request": {"category": "network"}}'),
        ]

    def test_empty_records(self):
        """Should handle empty records."""
        reporter = AuditReporter([])
        report = reporter.generate()
        assert report.total_records == 0
        assert report.time_range is None
        assert report.tool_stats == []
        assert report.category_breakdown == []

    def test_total_records(self):
        """Should compute correct total."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        assert report.total_records == 5

    def test_time_range(self):
        """Should compute time range."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        assert report.time_range is not None
        assert "10:00:00" in report.time_range["from"]
        assert "10:02:00" in report.time_range["to"]

    def test_tool_stats(self):
        """Should aggregate per tool."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        bash = next(ts for ts in report.tool_stats if ts.tool == "Bash")
        assert bash.invocations == 2
        assert bash.success_count == 1
        assert bash.error_count == 1

    def test_tool_stats_success_rate(self):
        """Should calculate success rate."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        read = next(ts for ts in report.tool_stats if ts.tool == "Read")
        assert read.success_rate == 1.0

    def test_tool_stats_sorted_by_invocations(self):
        """Should sort by invocation count."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        # Read and Bash both have 2, but order may vary
        assert report.tool_stats[0].invocations >= report.tool_stats[-1].invocations

    def test_category_breakdown(self):
        """Should compute category breakdown."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        categories = {cb.category: cb.count for cb in report.category_breakdown}
        assert categories["file_read"] == 2
        assert categories["command"] == 2
        assert categories["network"] == 1

    def test_policy_stats(self):
        """Should compute policy stats."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        assert report.policy_stats.total_evaluated == 5
        assert report.policy_stats.deny_count == 1  # blocked
        assert report.policy_stats.allow_count == 4

    def test_errors(self):
        """Should aggregate errors."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        assert len(report.errors) == 1
        assert report.errors[0].tool == "Bash"
        assert report.errors[0].count == 1

    def test_timeline(self):
        """Should bucket by minute."""
        reporter = AuditReporter(self.make_records())
        report = reporter.generate()
        assert len(report.timeline) > 0
        # First minute should have 2 records
        first_bucket = report.timeline[0]
        assert first_bucket.count == 2

    def test_format_text(self):
        """Should produce text output."""
        reporter = AuditReporter(self.make_records())
        text = reporter.format_text()
        assert "Audit Report" in text
        assert "Tool Stats" in text
        assert "Categories" in text
        assert "Policy" in text

    def test_to_dict(self):
        """Should convert to dict."""
        reporter = AuditReporter(self.make_records())
        d = reporter.to_dict()
        assert d["total_records"] == 5
        assert isinstance(d["tool_stats"], list)
        assert isinstance(d["category_breakdown"], list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
