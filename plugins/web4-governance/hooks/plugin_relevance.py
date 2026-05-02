#!/usr/bin/env python3
"""Plugin-relevance surfacer — closes the discoverability gap.

The mid-session problem (per insights/2026-05-01-plugin-utilization-honest-assessment.md):
the assistant doesn't see "plugins exist, here's when to call them" anywhere
in its working context. The MCP layer (gitnexus, snarc, etc.) and the
markdown-docs layer never cross. This hook bridges that gap by emitting
a small SessionStart context block that names the available plugins +
gives one-line use-case hints keyed to cwd.

Output goes to stdout as plain text and gets injected into Claude's
session-start context (same channel as SNARC's getSessionBriefing —
the on-disk directory is `engram/` for legacy reasons; the project
itself is named SNARC).

Designed to stay short (under 300 tokens). The point isn't to teach;
it's to remind. The discoverability problem is "I forgot it exists,"
not "I don't know how to use it."
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List


# ── Plugin catalog ────────────────────────────────────────────────
# Add or refine entries here as utilization patterns evolve.
# Each entry: id, when_relevant (cwd patterns / triggers), one-line use-case.

PLUGINS: List[Dict[str, Any]] = [
    {
        "id": "gitnexus",
        "tool_prefix": "mcp__gitnexus__",
        "when": ["any code repo"],
        "use_case": (
            "code navigation knowledge graph — `mcp__gitnexus__context` for "
            "360-view of a symbol; `query` to find by concept; `impact` "
            "before refactors. Use INSTEAD of grep/glob for cross-file "
            "navigation in large repos (SAGE, dev-SAGE, hardbound)."
        ),
    },
    {
        "id": "snarc",
        "tool_prefix": "mcp__snarc__",
        "when": ["all sessions"],
        "use_case": (
            "explicit query of session history — `mcp__snarc__snarc_search` "
            "for past observations matching a query; `snarc_patterns` for "
            "consolidated patterns; `snarc_stats` for db state. The Stop "
            "hook auto-consolidates; mid-session you can ASK what's there."
        ),
    },
    {
        "id": "playwright",
        "tool_prefix": "mcp__playwright__",
        "when": ["frontend work", "browser testing"],
        "use_case": (
            "browser automation — for UI verification, network capture, "
            "screenshots. Skip for backend-only sessions."
        ),
    },
    # Hardbound-specific plugins — only surfaced when cwd is a hardbound
    # workspace. The cowork-plugin/.mcp.json registers these for hardbound
    # sessions; they aren't globally available like gitnexus/snarc.
    {
        "id": "web4-identity",
        "tool_prefix": "mcp__web4_identity__",
        "when": ["hardbound"],
        "use_case": (
            "LCT identity ops — create/verify entity tokens, link/unlink "
            "identities. Open-source half of the hardbound stack."
        ),
    },
    {
        "id": "web4-trust",
        "tool_prefix": "mcp__web4_trust__",
        "when": ["hardbound"],
        "use_case": (
            "T3/V3 trust tensor ops — score, query, compose trust "
            "relationships. Open-source half of the hardbound stack."
        ),
    },
    {
        "id": "web4-economy",
        "tool_prefix": "mcp__web4_economy__",
        "when": ["hardbound"],
        "use_case": (
            "ATP/ADP attention-token ops — budget, debit, credit. "
            "Open-source half of the hardbound stack."
        ),
    },
    {
        "id": "hardbound-policy",
        "tool_prefix": "mcp__hardbound_policy__",
        "when": ["hardbound"],
        "use_case": (
            "Policy evaluation + enforcement (proprietary). Use when "
            "consequential operations need an oversight gate."
        ),
    },
    {
        "id": "hardbound-audit",
        "tool_prefix": "mcp__hardbound_audit__",
        "when": ["hardbound"],
        "use_case": (
            "Audit bundle generation + verification (proprietary). Use "
            "when an action needs after-the-fact provenance."
        ),
    },
]


# Triggers that indicate which plugins are MOST relevant for this cwd.
# Designed to be permissive — better to nudge slightly too often than too rarely.
def _relevance_for_cwd(cwd: str) -> List[Dict[str, Any]]:
    """Return plugins relevant to this cwd, ordered by relevance."""
    cwd_lower = cwd.lower()
    is_code_repo = any(
        marker in cwd_lower for marker in [
            "sage", "dev-sage", "hardbound", "synchronism", "claude-code",
            "memory", "private-context", "shared-context", "engram", "gitnexus",
            "ai-agents",
        ]
    )
    is_frontend = any(
        marker in cwd_lower for marker in ["frontend", "ui", "web", "site"]
    )
    is_hardbound = "hardbound" in cwd_lower

    relevant: List[Dict[str, Any]] = []
    for p in PLUGINS:
        when = set(p.get("when", []))
        if "all sessions" in when:
            relevant.append(p)
        elif "any code repo" in when and is_code_repo:
            relevant.append(p)
        elif "frontend work" in when and is_frontend:
            relevant.append(p)
        elif "browser testing" in when and is_frontend:
            # Already added under frontend, skip
            pass
        elif "hardbound" in when and is_hardbound:
            relevant.append(p)
    return relevant


def main() -> int:
    # Read hook input from stdin (Claude Code passes session metadata)
    try:
        input_data = sys.stdin.read()
        data = json.loads(input_data) if input_data else {}
    except Exception:
        data = {}

    cwd = data.get("cwd") or os.environ.get("PWD") or os.getcwd()
    plugins = _relevance_for_cwd(cwd)

    if not plugins:
        return 0  # silent — no relevant plugins for this cwd

    # Build a compact stdout block. Plain text gets injected into context.
    lines: List[str] = []
    lines.append("<plugin-relevance>")
    lines.append(
        "Available MCP plugins for this cwd (call when the use-case fits — "
        "the markdown-docs layer doesn't surface this otherwise):"
    )
    for p in plugins:
        lines.append(f"  • {p['id']} ({p['tool_prefix']}*): {p['use_case']}")
    lines.append("</plugin-relevance>")

    sys.stdout.write("\n".join(lines) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
