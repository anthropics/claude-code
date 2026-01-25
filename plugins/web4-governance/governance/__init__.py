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
- Entity trust with witnessing (MCP servers, agents, references)
- Role trust accumulation (T3/V3 tensors per agent)
- Persistent references with self-curation (learned context per role)
- Agent lifecycle governance (spawn, complete, capability modulation)

For hardware-bound identity and enterprise features, contact dp@metalinxx.io.

Usage:
    from governance import AgentGovernance, EntityTrustStore

    # Agent governance
    gov = AgentGovernance()
    ctx = gov.on_agent_spawn(session_id, "code-reviewer")
    result = gov.on_agent_complete(session_id, "code-reviewer", success=True)

    # Entity trust (MCP servers, etc.)
    store = EntityTrustStore()
    mcp_trust = store.get("mcp:filesystem")
    store.witness("session:abc", "mcp:filesystem", success=True)
"""

from .ledger import Ledger
from .soft_lct import SoftLCT
from .session_manager import SessionManager
from .role_trust import RoleTrust, RoleTrustStore
from .references import Reference, ReferenceStore
from .agent_governance import AgentGovernance
from .entity_trust import EntityTrust, EntityTrustStore, get_mcp_trust, update_mcp_trust

# Trust backend (Rust or Python fallback)
from .trust_backend import (
    get_backend_info,
    verify_backend,
    RUST_BACKEND,
    TrustStore,
    T3Tensor,
    V3Tensor,
)

__all__ = [
    'Ledger',
    'SoftLCT',
    'SessionManager',
    'RoleTrust',
    'RoleTrustStore',
    'Reference',
    'ReferenceStore',
    'AgentGovernance',
    'EntityTrust',
    'EntityTrustStore',
    'get_mcp_trust',
    'update_mcp_trust',
    # Trust backend
    'get_backend_info',
    'verify_backend',
    'RUST_BACKEND',
    'TrustStore',
    'T3Tensor',
    'V3Tensor',
]
