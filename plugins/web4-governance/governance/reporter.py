# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Audit Reporter
# https://github.com/dp-web4/web4
"""
Audit Reporter - Aggregate audit data into summary reports.

Accepts audit records and computes stats for tool usage,
category breakdown, policy decisions, errors, and timeline.

Usage:
    from governance.reporter import AuditReporter

    reporter = AuditReporter(audit_records)
    report = reporter.generate()

    # Or formatted text
    print(reporter.format_text())
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any


@dataclass
class ToolStats:
    """Statistics for a single tool."""
    tool: str
    invocations: int
    success_count: int
    error_count: int
    blocked_count: int
    success_rate: float
    avg_duration_ms: Optional[float]


@dataclass
class CategoryBreakdown:
    """Breakdown for a category."""
    category: str
    count: int
    percentage: float


@dataclass
class PolicyStats:
    """Policy decision statistics."""
    total_evaluated: int
    allow_count: int
    deny_count: int
    warn_count: int
    block_rate: float


@dataclass
class ErrorSummary:
    """Error summary for a tool."""
    tool: str
    count: int
    top_messages: List[str]


@dataclass
class TimelineBucket:
    """Activity in a time bucket."""
    minute: str
    count: int


@dataclass
class AuditReport:
    """Complete audit report."""
    total_records: int
    time_range: Optional[Dict[str, str]]
    tool_stats: List[ToolStats]
    category_breakdown: List[CategoryBreakdown]
    policy_stats: PolicyStats
    errors: List[ErrorSummary]
    timeline: List[TimelineBucket]


class AuditReporter:
    """Generate aggregated reports from audit records."""

    def __init__(self, records: List[Dict[str, Any]]):
        """
        Initialize reporter with audit records.

        Args:
            records: List of audit record dicts (from ledger.get_session_audit_trail
                    or ledger.query_audit)
        """
        self._records = records

    def generate(self) -> AuditReport:
        """Generate complete audit report."""
        return AuditReport(
            total_records=len(self._records),
            time_range=self._compute_time_range(),
            tool_stats=self._compute_tool_stats(),
            category_breakdown=self._compute_category_breakdown(),
            policy_stats=self._compute_policy_stats(),
            errors=self._compute_errors(),
            timeline=self._compute_timeline(),
        )

    def _compute_time_range(self) -> Optional[Dict[str, str]]:
        """Compute time range of records."""
        if not self._records:
            return None

        timestamps = [r.get("timestamp") for r in self._records if r.get("timestamp")]
        if not timestamps:
            return None

        sorted_ts = sorted(timestamps)
        return {"from": sorted_ts[0], "to": sorted_ts[-1]}

    def _compute_tool_stats(self) -> List[ToolStats]:
        """Compute per-tool statistics."""
        tool_data: Dict[str, Dict] = {}

        for r in self._records:
            tool = r.get("tool_name")
            if not tool:
                continue

            if tool not in tool_data:
                tool_data[tool] = {
                    "success": 0,
                    "error": 0,
                    "blocked": 0,
                    "durations": [],
                }

            entry = tool_data[tool]
            status = r.get("status", "")

            if status == "success":
                entry["success"] += 1
            elif status == "error":
                entry["error"] += 1
            elif status == "blocked":
                entry["blocked"] += 1

            # Try to extract duration from r6_data
            if r.get("r6_data"):
                try:
                    r6 = json.loads(r["r6_data"]) if isinstance(r["r6_data"], str) else r["r6_data"]
                    result = r6.get("result", {})
                    if result and result.get("duration_ms") is not None:
                        entry["durations"].append(result["duration_ms"])
                except (json.JSONDecodeError, TypeError, KeyError):
                    pass

        stats = []
        for tool, data in tool_data.items():
            total = data["success"] + data["error"] + data["blocked"]
            avg_dur = sum(data["durations"]) / len(data["durations"]) if data["durations"] else None

            stats.append(ToolStats(
                tool=tool,
                invocations=total,
                success_count=data["success"],
                error_count=data["error"],
                blocked_count=data["blocked"],
                success_rate=data["success"] / total if total > 0 else 0.0,
                avg_duration_ms=avg_dur,
            ))

        return sorted(stats, key=lambda s: s.invocations, reverse=True)

    def _compute_category_breakdown(self) -> List[CategoryBreakdown]:
        """Compute category breakdown."""
        counts: Dict[str, int] = {}

        for r in self._records:
            # Try to get category from r6_data
            category = None
            if r.get("r6_data"):
                try:
                    r6 = json.loads(r["r6_data"]) if isinstance(r["r6_data"], str) else r["r6_data"]
                    category = r6.get("request", {}).get("category")
                except (json.JSONDecodeError, TypeError, KeyError):
                    pass

            if category:
                counts[category] = counts.get(category, 0) + 1

        total = sum(counts.values())
        breakdown = [
            CategoryBreakdown(
                category=cat,
                count=count,
                percentage=(count / total * 100) if total > 0 else 0.0,
            )
            for cat, count in counts.items()
        ]

        return sorted(breakdown, key=lambda b: b.count, reverse=True)

    def _compute_policy_stats(self) -> PolicyStats:
        """Compute policy decision statistics."""
        # Derive from status: blocked → deny, otherwise → allow
        allow_count = 0
        deny_count = 0

        for r in self._records:
            status = r.get("status", "")
            if status == "blocked":
                deny_count += 1
            else:
                allow_count += 1

        total = len(self._records)
        return PolicyStats(
            total_evaluated=total,
            allow_count=allow_count,
            deny_count=deny_count,
            warn_count=0,  # Warn doesn't appear in status
            block_rate=deny_count / total if total > 0 else 0.0,
        )

    def _compute_errors(self) -> List[ErrorSummary]:
        """Compute error summaries by tool."""
        error_data: Dict[str, Dict] = {}

        for r in self._records:
            status = r.get("status", "")
            if status != "error":
                continue

            tool = r.get("tool_name", "unknown")
            if tool not in error_data:
                error_data[tool] = {"count": 0, "messages": {}}

            entry = error_data[tool]
            entry["count"] += 1

            # Try to get error message from r6_data
            if r.get("r6_data"):
                try:
                    r6 = json.loads(r["r6_data"]) if isinstance(r["r6_data"], str) else r["r6_data"]
                    result = r6.get("result", {})
                    msg = result.get("error_message")
                    if msg:
                        entry["messages"][msg] = entry["messages"].get(msg, 0) + 1
                except (json.JSONDecodeError, TypeError, KeyError):
                    pass

        summaries = []
        for tool, data in error_data.items():
            # Sort messages by frequency
            sorted_msgs = sorted(data["messages"].items(), key=lambda x: x[1], reverse=True)
            top_msgs = [msg for msg, _ in sorted_msgs[:5]]

            summaries.append(ErrorSummary(
                tool=tool,
                count=data["count"],
                top_messages=top_msgs,
            ))

        return sorted(summaries, key=lambda s: s.count, reverse=True)

    def _compute_timeline(self) -> List[TimelineBucket]:
        """Compute activity timeline bucketed by minute."""
        buckets: Dict[str, int] = {}

        for r in self._records:
            ts = r.get("timestamp")
            if not ts:
                continue

            try:
                # Parse and truncate to minute
                if ts.endswith("Z"):
                    ts = ts[:-1] + "+00:00"
                dt = datetime.fromisoformat(ts)
                minute = dt.strftime("%Y-%m-%dT%H:%M")
                buckets[minute] = buckets.get(minute, 0) + 1
            except (ValueError, TypeError):
                pass

        timeline = [TimelineBucket(minute=m, count=c) for m, c in buckets.items()]
        return sorted(timeline, key=lambda b: b.minute)

    def format_text(self) -> str:
        """Format report as structured text."""
        report = self.generate()
        lines: List[str] = []

        lines.append("=== Audit Report ===")
        lines.append(f"Total records: {report.total_records}")
        if report.time_range:
            lines.append(f"Time range: {report.time_range['from']} → {report.time_range['to']}")
        lines.append("")

        # Tool stats
        lines.append("--- Tool Stats ---")
        if not report.tool_stats:
            lines.append("  (no data)")
        for ts in report.tool_stats:
            dur = f"{ts.avg_duration_ms:.0f}ms avg" if ts.avg_duration_ms is not None else "n/a"
            lines.append(f"  {ts.tool}: {ts.invocations} calls, {ts.success_rate * 100:.0f}% success, {dur}")
        lines.append("")

        # Category breakdown
        lines.append("--- Categories ---")
        for cb in report.category_breakdown:
            lines.append(f"  {cb.category}: {cb.count} ({cb.percentage:.1f}%)")
        lines.append("")

        # Policy
        lines.append("--- Policy ---")
        lines.append(f"  Evaluated: {report.policy_stats.total_evaluated}")
        lines.append(f"  Allowed: {report.policy_stats.allow_count}")
        lines.append(f"  Denied: {report.policy_stats.deny_count}")
        lines.append(f"  Block rate: {report.policy_stats.block_rate * 100:.1f}%")
        lines.append("")

        # Errors
        if report.errors:
            lines.append("--- Errors ---")
            for err in report.errors:
                lines.append(f"  {err.tool}: {err.count} errors")
                for msg in err.top_messages:
                    lines.append(f"    - {msg}")
            lines.append("")

        # Timeline
        if report.timeline:
            lines.append("--- Timeline (actions/min) ---")
            for bucket in report.timeline:
                lines.append(f"  {bucket.minute}: {bucket.count}")

        return "\n".join(lines)

    def to_dict(self) -> Dict[str, Any]:
        """Convert report to JSON-serializable dict."""
        report = self.generate()
        return {
            "total_records": report.total_records,
            "time_range": report.time_range,
            "tool_stats": [
                {
                    "tool": ts.tool,
                    "invocations": ts.invocations,
                    "success_count": ts.success_count,
                    "error_count": ts.error_count,
                    "blocked_count": ts.blocked_count,
                    "success_rate": ts.success_rate,
                    "avg_duration_ms": ts.avg_duration_ms,
                }
                for ts in report.tool_stats
            ],
            "category_breakdown": [
                {"category": cb.category, "count": cb.count, "percentage": cb.percentage}
                for cb in report.category_breakdown
            ],
            "policy_stats": {
                "total_evaluated": report.policy_stats.total_evaluated,
                "allow_count": report.policy_stats.allow_count,
                "deny_count": report.policy_stats.deny_count,
                "warn_count": report.policy_stats.warn_count,
                "block_rate": report.policy_stats.block_rate,
            },
            "errors": [
                {"tool": err.tool, "count": err.count, "top_messages": err.top_messages}
                for err in report.errors
            ],
            "timeline": [
                {"minute": b.minute, "count": b.count}
                for b in report.timeline
            ],
        }
