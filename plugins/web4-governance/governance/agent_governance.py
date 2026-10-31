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
from .entity_trust import EntityTrustStore


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

        # Track references used per session (for witnessing on complete)
        self._session_refs: Dict[str, List[str]] = {}

        # Track work attribution per session (which agent did what)
        # Format: {session_id: [(agent_name, work_type, work_id), ...]}
        self._work_attribution: Dict[str, List[tuple]] = {}

        # Track recent agents per session (for inter-agent witnessing)
        # Format: {session_id: [agent_name, ...]} (most recent first)
        self._recent_agents: Dict[str, List[str]] = {}

        # Entity trust store for inter-agent witnessing
        self.entity_trust = EntityTrustStore()

    def get_role_context(self, role_id: str) -> dict:
        """
        Get full context for a role (agent).

        Returns trust, references, and derived capabilities.
        Useful for understanding an agent's current standing.
        """
        trust = self.role_trust.get(role_id)
        refs = self.references.get_for_role(role_id, limit=30)
        capabilities = self.role_trust.derive_capabilities(role_id)
        context_str, used_ref_ids = self.references.get_context_for_role(role_id)

        return {
            "role_id": role_id,
            "trust": trust.to_dict(),
            "trust_level": trust.trust_level(),
            "t3_average": trust.t3_average(),
            "v3_average": trust.v3_average(),
            "capabilities": capabilities,
            "reference_count": len(refs),
            "references": [r.to_dict() for r in refs[:10]],  # Sample
            "context_summary": context_str[:500] if context_str else None,
            "context_refs_used": len(used_ref_ids)
        }

    def on_agent_spawn(self, session_id: str, agent_name: str) -> dict:
        """
        Called when an agent is spawned.

        Records the agent activation in the ledger and returns
        role context including trust and references.

        References used are tracked for witnessing on completion.

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

        # Get context with self-curation (returns used ref IDs)
        context_str, used_ref_ids = self.references.get_context_for_role(
            agent_name, max_tokens=1000
        )

        # Track which refs were used (for witnessing on complete)
        self._session_refs[session_id] = used_ref_ids

        # Record in ledger
        self.ledger.record_audit(
            session_id=session_id,
            action_type="agent_spawn",
            tool_name=agent_name,
            target=f"t3={trust.t3_average():.2f}",
            input_hash=None,
            output_hash=f"refs={len(used_ref_ids)}",
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
            "references_used": len(used_ref_ids),
            "context": context_str
        }

    def on_agent_complete(
        self,
        session_id: str,
        agent_name: str,
        success: bool,
        magnitude: float = 0.1,
        validates_previous: bool = True
    ) -> dict:
        """
        Called when an agent completes its work.

        Updates trust based on outcome, witnesses used references,
        and performs inter-agent witnessing.

        Reference witnessing enables self-curation:
        - References used in successful tasks gain trust
        - References used in failed tasks lose trust
        - Over time, helpful references rise, unhelpful ones fade

        Inter-agent witnessing:
        - When agent B completes successfully after agent A
        - B's success validates A's work
        - B witnesses A (A gains trust through validation)

        Args:
            session_id: Current session ID
            agent_name: Agent/role identifier
            success: Whether agent completed successfully
            magnitude: Update magnitude (0.0-1.0)
            validates_previous: Whether to witness previous agent

        Returns:
            Updated trust information including reference witnessing
        """
        # Update agent trust
        trust = self.role_trust.update(agent_name, success, magnitude)

        # Witness references that were used (self-curation)
        refs_witnessed = 0
        if session_id in self._session_refs:
            used_refs = self._session_refs[session_id]
            if used_refs:
                updated_refs = self.references.witness_references(
                    role_id=agent_name,
                    ref_ids=used_refs,
                    success=success,
                    magnitude=magnitude * 0.5  # Refs update more slowly
                )
                refs_witnessed = len(updated_refs)

            # Clear tracked refs
            del self._session_refs[session_id]

        # Inter-agent witnessing
        # If this agent succeeded, it validates the previous agent's work
        agents_witnessed = []
        if success and validates_previous and session_id in self._recent_agents:
            recent = self._recent_agents[session_id]
            for prev_agent in recent[:2]:  # Witness up to 2 previous agents
                if prev_agent != agent_name:
                    try:
                        witness_result = self.witness_agent(
                            session_id=session_id,
                            witness_agent=agent_name,
                            target_agent=prev_agent,
                            success=True,  # Successful completion = positive witness
                            magnitude=magnitude * 0.3  # Inter-agent witnessing is gentler
                        )
                        agents_witnessed.append(witness_result)
                    except Exception:
                        pass  # Don't fail on witnessing errors

        # Track this agent in recent agents
        if session_id not in self._recent_agents:
            self._recent_agents[session_id] = []
        if agent_name not in self._recent_agents[session_id]:
            self._recent_agents[session_id].insert(0, agent_name)
            # Keep only last 5 agents
            self._recent_agents[session_id] = self._recent_agents[session_id][:5]

        # Clear active role
        if session_id in self._active_roles:
            del self._active_roles[session_id]

        # Record in ledger
        self.ledger.record_audit(
            session_id=session_id,
            action_type="agent_complete",
            tool_name=agent_name,
            target=f"success={success}",
            input_hash=f"refs={refs_witnessed},agents={len(agents_witnessed)}",
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
            },
            "references_witnessed": refs_witnessed,
            "agents_witnessed": agents_witnessed
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

    def witness_agent(
        self,
        session_id: str,
        witness_agent: str,
        target_agent: str,
        success: bool,
        magnitude: float = 0.1
    ) -> dict:
        """
        Record inter-agent witnessing.

        When one agent's work validates another's, the witnessing agent
        can attest to the target agent's quality.

        Example:
        - code-reviewer reviews code
        - test-runner runs tests, they pass
        - test-runner witnesses code-reviewer (tests validate the review)

        Args:
            session_id: Current session
            witness_agent: Agent doing the witnessing (e.g., test-runner)
            target_agent: Agent being witnessed (e.g., code-reviewer)
            success: Whether the witnessed work was validated
            magnitude: Update magnitude

        Returns:
            Witnessing result with updated trust
        """
        witness_id = f"role:{witness_agent}"
        target_id = f"role:{target_agent}"

        # Record the witnessing in entity trust
        witness_trust, target_trust = self.entity_trust.witness(
            witness_id, target_id, success, magnitude
        )

        # Also update the role trust store (T3 witnesses dimension)
        target_role = self.role_trust.get(target_agent)
        if success:
            # Being validated increases witnesses dimension
            delta = magnitude * 0.05 * (1 - target_role.witnesses)
        else:
            delta = -magnitude * 0.08 * target_role.witnesses
        target_role.witnesses = max(0, min(1, target_role.witnesses + delta))
        self.role_trust.save(target_role)

        # Record in ledger
        self.ledger.record_audit(
            session_id=session_id,
            action_type="agent_witness",
            tool_name=f"{witness_agent}->{target_agent}",
            target=f"success={success}",
            input_hash=None,
            output_hash=f"t3={target_trust.t3_average():.3f}",
            status="success"
        )

        return {
            "witness": witness_agent,
            "target": target_agent,
            "success": success,
            "target_trust": {
                "t3_average": target_trust.t3_average(),
                "witnesses_dim": round(target_role.witnesses, 3),
                "trust_level": target_role.trust_level()
            }
        }

    def get_witnessing_chain(self, agent_name: str) -> dict:
        """
        Get the witnessing chain for an agent.

        Shows which agents have witnessed this one and vice versa.
        """
        entity_id = f"role:{agent_name}"
        return self.entity_trust.get_witnessing_chain(entity_id)

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

    def auto_extract_references(
        self,
        session_id: str,
        role_id: str,
        content: str,
        source: str = "auto-extracted",
        min_confidence: float = 0.4
    ) -> List[dict]:
        """
        Automatically extract references from task output.

        Analyzes content for extractable patterns, facts, and learnings.
        Called after successful task completion to capture knowledge.

        Extraction patterns:
        - "Pattern: ..." or "Always ..." → pattern reference
        - "Note: ..." or "Important: ..." → fact reference
        - "The ... uses/contains/is ..." → fact reference
        - "Prefer ... over ..." or "Use ... instead of ..." → preference
        - Code patterns (function signatures, imports) → pattern reference

        Args:
            session_id: Current session
            role_id: Role to attribute references to
            content: Content to analyze
            source: Source attribution
            min_confidence: Minimum confidence to extract (0.0-1.0)

        Returns:
            List of extracted references
        """
        import re

        extracted = []

        # Pattern indicators (high confidence)
        pattern_markers = [
            (r'[Pp]attern:\s*(.+?)(?:\n|$)', 'pattern', 0.8),
            (r'[Aa]lways\s+(.+?)(?:\.|$)', 'pattern', 0.7),
            (r'[Nn]ever\s+(.+?)(?:\.|$)', 'pattern', 0.7),
            (r'[Bb]est practice:\s*(.+?)(?:\n|$)', 'pattern', 0.8),
        ]

        # Fact indicators (medium confidence)
        fact_markers = [
            (r'[Nn]ote:\s*(.+?)(?:\n|$)', 'fact', 0.6),
            (r'[Ii]mportant:\s*(.+?)(?:\n|$)', 'fact', 0.7),
            (r'[Tt]he (\w+) (?:uses|contains|is|has) (.+?)(?:\.|$)', 'fact', 0.5),
            (r'[Ff]ound that (.+?)(?:\.|$)', 'fact', 0.6),
        ]

        # Preference indicators (medium confidence)
        pref_markers = [
            (r'[Pp]refer (.+?) over (.+?)(?:\.|$)', 'preference', 0.6),
            (r'[Uu]se (.+?) instead of (.+?)(?:\.|$)', 'preference', 0.6),
            (r'[Rr]ecommend(?:ed|s)? (.+?)(?:\.|$)', 'preference', 0.5),
        ]

        # Summary indicators (lower confidence, longer content)
        summary_markers = [
            (r'[Ss]ummary:\s*(.+?)(?:\n\n|$)', 'summary', 0.5),
            (r'[Oo]verview:\s*(.+?)(?:\n\n|$)', 'summary', 0.5),
        ]

        all_markers = pattern_markers + fact_markers + pref_markers + summary_markers

        for regex, ref_type, base_confidence in all_markers:
            if base_confidence < min_confidence:
                continue

            matches = re.findall(regex, content, re.MULTILINE | re.DOTALL)
            for match in matches:
                # Handle tuple matches (multiple groups)
                if isinstance(match, tuple):
                    text = " ".join(m.strip() for m in match if m)
                else:
                    text = match.strip()

                # Skip very short or very long extractions
                if len(text) < 10 or len(text) > 500:
                    continue

                # Adjust confidence based on content quality
                confidence = base_confidence
                if len(text) > 100:
                    confidence *= 0.9  # Longer = slightly less certain
                if any(word in text.lower() for word in ['might', 'maybe', 'possibly']):
                    confidence *= 0.8  # Uncertainty markers reduce confidence

                if confidence >= min_confidence:
                    ref = self.references.add(
                        role_id=role_id,
                        content=text,
                        source=source,
                        ref_type=ref_type,
                        confidence=confidence,
                        tags=["auto-extracted"]
                    )
                    extracted.append({
                        "ref_id": ref.ref_id,
                        "ref_type": ref_type,
                        "content": text[:100],
                        "confidence": confidence
                    })

        # Record extraction in ledger
        if extracted:
            self.ledger.record_audit(
                session_id=session_id,
                action_type="auto_extract",
                tool_name=role_id,
                target=f"extracted={len(extracted)}",
                input_hash=None,
                output_hash=None,
                status="success"
            )

        return extracted

    def on_task_output(
        self,
        session_id: str,
        role_id: str,
        output: str,
        success: bool
    ) -> dict:
        """
        Process task output for reference extraction.

        Called when a task completes with output that might contain
        learnings worth persisting.

        Args:
            session_id: Current session
            role_id: Agent role
            output: Task output content
            success: Whether task succeeded

        Returns:
            Extraction results
        """
        if not success or not output or len(output) < 50:
            return {"extracted": 0, "reason": "No extractable content"}

        # Only extract from successful tasks
        extracted = self.auto_extract_references(
            session_id=session_id,
            role_id=role_id,
            content=output,
            source=f"task-output:{session_id}",
            min_confidence=0.5  # Higher threshold for auto-extraction
        )

        return {
            "extracted": len(extracted),
            "references": extracted
        }
