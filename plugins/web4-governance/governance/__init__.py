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
from .presets import (
    PolicyConfig,
    PolicyRule,
    PolicyMatch,
    RateLimitSpec,
    PresetDefinition,
    get_preset,
    list_presets,
    resolve_preset,
    is_preset_name,
    policy_config_to_dict,
)
from .rate_limiter import RateLimiter, RateLimitResult
from .reporter import AuditReporter, AuditReport
from .policy_entity import PolicyEntity, PolicyRegistry, PolicyEvaluation

# Trust backend (Rust or Python fallback)
from .trust_backend import (
    get_backend_info,
    verify_backend,
    RUST_BACKEND,
    TrustStore,
    T3Tensor as BackendT3Tensor,  # Legacy backend tensor
    V3Tensor as BackendV3Tensor,  # Legacy backend tensor
)

# Canonical T3/V3 Tensors (fractal structure per Web4 spec)
from .tensors import (
    # Base 3D tensors
    T3Base,
    V3Base,
    # Full fractal tensors with subdimensions
    T3Tensor,
    V3Tensor,
    # Subdimension classes
    TalentSubdims,
    TrainingSubdims,
    TemperamentSubdims,
    ValuationSubdims,
    VeracitySubdims,
    ValiditySubdims,
    # Migration helpers
    migrate_legacy_t3,
    migrate_legacy_v3,
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
    # Trust backend (legacy)
    'get_backend_info',
    'verify_backend',
    'RUST_BACKEND',
    'TrustStore',
    'BackendT3Tensor',
    'BackendV3Tensor',
    # Canonical T3/V3 Tensors (fractal per Web4 spec)
    'T3Base',
    'V3Base',
    'T3Tensor',
    'V3Tensor',
    'TalentSubdims',
    'TrainingSubdims',
    'TemperamentSubdims',
    'ValuationSubdims',
    'VeracitySubdims',
    'ValiditySubdims',
    'migrate_legacy_t3',
    'migrate_legacy_v3',
    # Tier 1.5: Presets
    'PolicyConfig',
    'PolicyRule',
    'PolicyMatch',
    'RateLimitSpec',
    'PresetDefinition',
    'get_preset',
    'list_presets',
    'resolve_preset',
    'is_preset_name',
    'policy_config_to_dict',
    # Tier 1.5: Rate Limiter
    'RateLimiter',
    'RateLimitResult',
    # Tier 1.5: Reporter
    'AuditReporter',
    'AuditReport',
    # Tier 1.5: Policy Entity
    'PolicyEntity',
    'PolicyRegistry',
    'PolicyEvaluation',
]
