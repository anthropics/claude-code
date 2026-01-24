# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Agent Governance
# https://github.com/dp-web4/web4
"""
High-level API for Web4 agent governance.

Maps Claude Code agents to Web4 role entities:

    Agent (claude-code) → Role Entity (web4)

Provides:
- Role trust accumulation (T3/V3 tensors)
- Persistent references (learned context)
- Capability modulation based on trust
- Session integration with R6 audit trail

Usage in hooks:
    from governance import AgentGovernance

    gov = AgentGovernance()

    # When agent spawns
    ctx = gov.on_agent_spawn(session_id, "code-reviewer")

    # When agent completes
    result = gov.on_agent_complete(session_id, "code-reviewer", success=True)

    # Extract reference from agent work
    gov.extract_reference(session_id, "code-reviewer",
                         content="Pattern: null checks before array access",
                         source="analysis of auth.py")
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List, Any

from .ledger import Ledger
from .soft_lct import SoftLCT
from .session_manager import SessionManager
from .role_trust import RoleTrust, RoleTrustStore
from .references import Reference, ReferenceStore


class AgentGovernance:
    """
    High-level API for agent governance integration.

    Coordinates between:
    - Session management (current session context)
    - Role trust (per-agent trust tensors)
    - References (persistent learned context)
    - Audit ledger (R6 action trail)
    """

    def __init__(
        self,
        ledger: Optional[Ledger] = None,
        lct: Optional[SoftLCT] = None
    ):
        """
        Initialize agent governance.

        Args:
            ledger: Ledger instance for persistence
            lct: SoftLCT for identity
        """
        self.ledger = ledger or Ledger()
        self.lct = lct or SoftLCT(self.ledger)
        self.session_manager = SessionManager(self.ledger, self.lct)
        self.role_trust = RoleTrustStore(self.ledger)
        self.references = ReferenceStore(self.ledger)

        # Track active role per session
        self._active_roles: Dict[str, str] = {}

    def get_role_context(self, role_id: str) -> dict:
        """
        Get full context for a role (agent).

        Returns trust, references, and derived capabilities.
        Useful for understanding an agent's current standing.
        """
        trust = self.role_trust.get(role_id)
        refs = self.references.get_for_role(role_id, limit=30)
        capabilities = self.role_trust.derive_capabilities(role_id)
        context_str = self.references.get_context_for_role(role_id)

        return {
            "role_id": role_id,
            "trust": trust.to_dict(),
            "trust_level": trust.trust_level(),
            "t3_average": trust.t3_average(),
            "v3_average": trust.v3_average(),
            "capabilities": capabilities,
            "reference_count": len(refs),
            "references": [r.to_dict() for r in refs[:10]],  # Sample
            "context_summary": context_str[:500] if context_str else None
        }

    def on_agent_spawn(self, session_id: str, agent_name: str) -> dict:
        """
        Called when an agent is spawned.

        Records the agent activation in the ledger and returns
        role context including trust and references.

        Args:
            session_id: Current session ID
            agent_name: Agent/role identifier (e.g., "code-reviewer")

        Returns:
            Role context with trust, references, capabilities
        """
        # Track active role
        self._active_roles[session_id] = agent_name

        # Get role context
        trust = self.role_trust.get(agent_name)
        refs = self.references.get_for_role(agent_name, limit=20)
        capabilities = self.role_trust.derive_capabilities(agent_name)

        # Record in ledger
        self.ledger.record_audit(
            session_id=session_id,
            action_type="agent_spawn",
            tool_name=agent_name,
            target=f"t3={trust.t3_average():.2f}",
            input_hash=None,
            output_hash=None,
            status="success"
        )

        return {
            "role_id": agent_name,
            "session_id": session_id,
            "trust": {
                "t3_average": trust.t3_average(),
                "v3_average": trust.v3_average(),
                "trust_level": trust.trust_level(),
                "action_count": trust.action_count,
                "success_rate": trust.success_count / max(1, trust.action_count)
            },
            "capabilities": capabilities,
            "references_loaded": len(refs),
            "context": self.references.get_context_for_role(agent_name, max_tokens=1000)
        }

    def on_agent_complete(
        self,
        session_id: str,
        agent_name: str,
        success: bool,
        magnitude: float = 0.1
    ) -> dict:
        """
        Called when an agent completes its work.

        Updates trust based on outcome and records completion.

        Args:
            session_id: Current session ID
            agent_name: Agent/role identifier
            success: Whether agent completed successfully
            magnitude: Update magnitude (0.0-1.0)

        Returns:
            Updated trust information
        """
        # Update trust
        trust = self.role_trust.update(agent_name, success, magnitude)

        # Clear active role
        if session_id in self._active_roles:
            del self._active_roles[session_id]

        # Record in ledger
        self.ledger.record_audit(
            session_id=session_id,
            action_type="agent_complete",
            tool_name=agent_name,
            target=f"success={success}",
            input_hash=None,
            output_hash=f"t3={trust.t3_average():.3f}",
            status="success" if success else "failure"
        )

        return {
            "role_id": agent_name,
            "session_id": session_id,
            "success": success,
            "trust_updated": {
                "t3_average": trust.t3_average(),
                "v3_average": trust.v3_average(),
                "trust_level": trust.trust_level(),
                "reliability": trust.reliability,
                "competence": trust.competence
            }
        }

    def on_tool_use(
        self,
        session_id: str,
        role_id: str,
        tool_name: str,
        tool_input: dict,
        atp_cost: int = 1
    ) -> dict:
        """
        Called before tool use by an agent.

        Checks capabilities and records the action.

        Args:
            session_id: Current session
            role_id: Active role (agent)
            tool_name: Tool being used
            tool_input: Tool input parameters
            atp_cost: ATP cost for this action

        Returns:
            Action record with remaining budget
        """
        # Check capabilities
        caps = self.role_trust.derive_capabilities(role_id)

        # Verify tool is allowed
        tool_caps = {
            "Read": "can_read",
            "Glob": "can_read",
            "Grep": "can_read",
            "Write": "can_write",
            "Edit": "can_write",
            "Bash": "can_execute",
            "WebFetch": "can_network",
            "WebSearch": "can_network",
            "Task": "can_delegate"
        }

        required_cap = tool_caps.get(tool_name, "can_read")
        if not caps.get(required_cap, False):
            return {
                "allowed": False,
                "error": f"Insufficient trust for {tool_name}",
                "required": required_cap,
                "trust_level": caps["trust_level"]
            }

        # Record action
        try:
            action = self.session_manager.record_action(
                tool_name=tool_name,
                target=self._extract_target(tool_name, tool_input),
                input_data=tool_input,
                atp_cost=atp_cost
            )
            return {
                "allowed": True,
                "action": action,
                "role_id": role_id
            }
        except RuntimeError:
            # No active session
            return {
                "allowed": True,
                "action": None,
                "role_id": role_id,
                "note": "No active session"
            }

    def _extract_target(self, tool_name: str, tool_input: dict) -> str:
        """Extract target from tool input for audit."""
        if tool_name in ["Read", "Write", "Edit", "Glob"]:
            return tool_input.get("file_path", tool_input.get("path", ""))[:100]
        elif tool_name == "Bash":
            cmd = tool_input.get("command", "")
            return cmd.split()[0] if cmd.split() else cmd[:50]
        elif tool_name == "Grep":
            return f"pattern:{tool_input.get('pattern', '')[:30]}"
        elif tool_name == "WebFetch":
            return tool_input.get("url", "")[:100]
        elif tool_name == "Task":
            return tool_input.get("description", "")[:50]
        return ""

    def extract_reference(
        self,
        session_id: str,
        role_id: str,
        content: str,
        source: str,
        ref_type: str = "pattern",
        confidence: float = 0.5,
        tags: Optional[List[str]] = None
    ) -> dict:
        """
        Extract and store a reference from agent work.

        Call this when an agent learns something that should persist:
        - Patterns observed in code
        - Facts extracted from docs
        - User preferences inferred

        Args:
            session_id: Current session
            role_id: Role that learned this
            content: The reference content
            source: Where it came from
            ref_type: pattern, fact, preference, context, summary
            confidence: How confident in this reference
            tags: Optional categorization tags

        Returns:
            Created reference info
        """
        ref = self.references.add(
            role_id=role_id,
            content=content,
            source=source,
            ref_type=ref_type,
            confidence=confidence,
            tags=tags
        )

        # Record in ledger
        self.ledger.record_audit(
            session_id=session_id,
            action_type="reference_extract",
            tool_name=role_id,
            target=ref_type,
            input_hash=None,
            output_hash=ref.ref_id,
            status="success"
        )

        return {
            "ref_id": ref.ref_id,
            "role_id": role_id,
            "ref_type": ref_type,
            "content_preview": content[:100]
        }

    def search_references(
        self,
        role_id: str,
        query: str,
        ref_type: Optional[str] = None,
        limit: int = 10
    ) -> List[dict]:
        """Search references for a role."""
        refs = self.references.search(
            role_id=role_id,
            query=query,
            ref_type=ref_type,
            limit=limit
        )
        return [r.to_dict() for r in refs]

    def get_active_role(self, session_id: str) -> Optional[str]:
        """Get currently active role for a session."""
        return self._active_roles.get(session_id)

    def get_all_roles(self) -> List[dict]:
        """Get summary of all known roles."""
        roles = []
        for role_id in self.role_trust.list_roles():
            trust = self.role_trust.get(role_id)
            ref_stats = self.references.get_stats(role_id)

            roles.append({
                "role_id": role_id,
                "t3_average": trust.t3_average(),
                "trust_level": trust.trust_level(),
                "action_count": trust.action_count,
                "reference_count": ref_stats["total_references"]
            })

        return sorted(roles, key=lambda r: r["t3_average"], reverse=True)

    def prune_stale_references(self, max_age_days: int = 90) -> dict:
        """Prune stale references across all roles."""
        results = {}
        for role_id in self.role_trust.list_roles():
            pruned = self.references.prune_stale(role_id, max_age_days)
            if pruned > 0:
                results[role_id] = pruned
        return results
