# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance
# https://github.com/dp-web4/web4
"""
Lightweight governance for Claude Code plugin.

This is a software-only implementation of Web4 governance concepts:
- Soft LCT (software-bound identity, no TPM)
- Local SQLite ledger (session tracking, work products, ATP)
- R6 workflow (request → result with audit trail)
- Role trust accumulation (T3/V3 tensors per agent)
- Persistent references (learned context per role)
- Agent lifecycle governance (spawn, complete, capability modulation)

For hardware-bound identity and enterprise features, contact dp@metalinxx.io.

Note: This module can be used alongside the existing heartbeat tracking.
The hooks currently use heartbeat; this module provides additional
ledger-based coordination for session numbering and work tracking.

Usage:
    from governance import AgentGovernance

    gov = AgentGovernance()
    ctx = gov.on_agent_spawn(session_id, "code-reviewer")
    result = gov.on_agent_complete(session_id, "code-reviewer", success=True)
"""

from .ledger import Ledger
from .soft_lct import SoftLCT
from .session_manager import SessionManager
from .role_trust import RoleTrust, RoleTrustStore
from .references import Reference, ReferenceStore
from .agent_governance import AgentGovernance

__all__ = [
    'Ledger',
    'SoftLCT',
    'SessionManager',
    'RoleTrust',
    'RoleTrustStore',
    'Reference',
    'ReferenceStore',
    'AgentGovernance'
]
