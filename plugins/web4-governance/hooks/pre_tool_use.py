#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Governance Plugin - Pre-Tool-Use Hook
# https://github.com/dp-web4/web4

"""
Web4 Pre-Tool-Use Hook

Implements R6 workflow formalism for every tool call:

    R6 = Rules + Role + Request + Reference + Resource → Result

This creates a structured, auditable record of intent before execution.

## R6 Framework

1. **Rules** - What constraints apply to this action?
2. **Role** - Who is requesting? What's their context?
3. **Request** - What action is being requested?
4. **Reference** - What's the relevant history?
5. **Resource** - What resources are needed/consumed?
6. **Result** - (Completed in post_tool_use)

The R6 framework provides:
- Structured intent capture
- Audit trail foundation
- Context for trust evaluation
- Basis for policy enforcement
"""

import json
import os
import sys
import uuid
import hashlib
from datetime import datetime, timezone
from pathlib import Path

# Import heartbeat tracker
from heartbeat import get_session_heartbeat

# Import agent governance
sys.path.insert(0, str(Path(__file__).parent.parent))
try:
    from governance import (
        AgentGovernance,
        EntityTrustStore,
        PolicyRegistry,
        PolicyEntity,
        resolve_preset,
        is_preset_name,
        RateLimiter,
    )
    GOVERNANCE_AVAILABLE = True
except ImportError:
    GOVERNANCE_AVAILABLE = False
    EntityTrustStore = None
    PolicyRegistry = None
    PolicyEntity = None
    RateLimiter = None

# Session-level rate limiter (memory-only, resets on restart)
_rate_limiter = None


def get_rate_limiter():
    """Get or create session rate limiter."""
    global _rate_limiter
    if _rate_limiter is None and RateLimiter is not None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


def evaluate_policy(session, tool_name: str, category: str, target: str):
    """
    Evaluate tool call against policy entity.

    Returns:
        Tuple of (decision, evaluation_dict) where decision is "allow", "deny", or "warn"
        Returns ("allow", None) if no policy or policy unavailable.
    """
    if not GOVERNANCE_AVAILABLE or PolicyRegistry is None:
        return "allow", None

    policy_entity_id = session.get("policy_entity_id")
    if not policy_entity_id:
        return "allow", None

    try:
        registry = PolicyRegistry()
        policy_entity = registry.get_policy(policy_entity_id)
        if not policy_entity:
            return "allow", None

        # Evaluate with rate limiter
        rate_limiter = get_rate_limiter()
        evaluation = policy_entity.evaluate(tool_name, category, target, rate_limiter)

        eval_dict = {
            "decision": evaluation.decision,
            "rule_id": evaluation.rule_id,
            "rule_name": evaluation.rule_name,
            "reason": evaluation.reason,
            "enforced": evaluation.enforced,
            "constraints": evaluation.constraints,
        }

        return evaluation.decision, eval_dict

    except Exception as e:
        # Policy evaluation failed - default to allow
        return "allow", {"error": str(e)}

WEB4_DIR = Path.home() / ".web4"
SESSION_DIR = WEB4_DIR / "sessions"
R6_LOG_DIR = WEB4_DIR / "r6"


def create_session_token():
    """Create a software-bound session token (mirrors session_start.py)."""
    seed = f"{os.uname().nodename}:{os.getuid()}:{datetime.now(timezone.utc).isoformat()}"
    token_hash = hashlib.sha256(seed.encode()).hexdigest()[:12]
    return {
        "token_id": f"web4:session:{token_hash}",
        "binding": "software",
        "created_at": datetime.now(timezone.utc).isoformat() + "Z",
        "machine_hint": hashlib.sha256(os.uname().nodename.encode()).hexdigest()[:8]
    }


def register_policy_for_session(session_id: str, prefs: dict):
    """
    Register policy entity for a session (used in lazy init).

    Returns (policy_entity_id, policy_entity_dict) or (None, None).
    """
    if not GOVERNANCE_AVAILABLE or PolicyRegistry is None:
        return None, None

    preset_name = prefs.get("policy_preset", "safety")
    if not is_preset_name(preset_name):
        preset_name = "safety"

    try:
        registry = PolicyRegistry()
        policy_entity = registry.register_policy(name=preset_name, preset=preset_name)
        registry.witness_session(policy_entity.entity_id, session_id)
        return policy_entity.entity_id, policy_entity.to_dict()
    except Exception as e:
        print(f"[Web4] Policy registration failed: {e}", file=sys.stderr)
        return None, None


def load_or_create_session(session_id):
    """
    Load session state, or create one if missing (lazy initialization).

    This handles context compaction continuations where SessionStart
    doesn't fire but PreToolUse does.
    """
    SESSION_DIR.mkdir(parents=True, exist_ok=True)
    session_file = SESSION_DIR / f"{session_id}.json"

    if session_file.exists():
        with open(session_file) as f:
            return json.load(f)

    # Lazy initialization for continued/recovered sessions
    prefs = {
        "audit_level": "standard",
        "show_r6_status": True,
        "action_budget": None,
        "policy_preset": "safety",
    }

    # Register policy as first-class entity (hash-tracked)
    policy_entity_id, policy_entity_dict = register_policy_for_session(session_id, prefs)

    session = {
        "session_id": session_id,
        "token": create_session_token(),
        "preferences": prefs,
        "started_at": datetime.now(timezone.utc).isoformat() + "Z",
        "recovered_at": datetime.now(timezone.utc).isoformat() + "Z",  # Mark as recovered
        "action_count": 0,
        "r6_requests": [],
        "audit_chain": [],
        "active_agent": None,
        "agents_used": [],
        "governance_available": GOVERNANCE_AVAILABLE,
        # Policy entity (society's law)
        "policy_entity_id": policy_entity_id,
        "policy_entity": policy_entity_dict,
    }

    # Save immediately
    with open(session_file, "w") as f:
        json.dump(session, f, indent=2)

    # Initialize heartbeat for recovered session
    heartbeat = get_session_heartbeat(session_id)
    heartbeat.record("session_recovered", 0)

    # Log recovery
    policy_name = policy_entity_id.split(":")[1] if policy_entity_id else "none"
    print(f"[Web4] Session recovered: {session['token']['token_id'].split(':')[-1]} [policy:{policy_name}]", file=sys.stderr)

    return session


def load_session(session_id):
    """Load session state (wrapper for compatibility)."""
    return load_or_create_session(session_id)


def save_session(session):
    """Save session state."""
    session_file = SESSION_DIR / f"{session['session_id']}.json"
    with open(session_file, "w") as f:
        json.dump(session, f, indent=2)


def detect_mcp_tool(tool_name: str) -> tuple:
    """
    Detect if a tool is from an MCP server.

    MCP tools typically follow patterns:
    - mcp__servername__toolname (double underscore)
    - mcp_servername_toolname (single underscore)
    - servername.toolname (dot notation)
    - web4.io/namespace/tool (URI style)

    Returns: (is_mcp, server_name, tool_name) or (False, None, None)
    """
    # Pattern 1: mcp__server__tool
    if tool_name.startswith("mcp__"):
        parts = tool_name.split("__")
        if len(parts) >= 3:
            return True, parts[1], "__".join(parts[2:])

    # Pattern 2: mcp_server_tool (but not native tools)
    if tool_name.startswith("mcp_"):
        parts = tool_name[4:].split("_", 1)
        if len(parts) >= 2:
            return True, parts[0], parts[1]

    # Pattern 3: web4.io/... or other.io/...
    if ".io/" in tool_name:
        parts = tool_name.split("/")
        if len(parts) >= 2:
            server = parts[0].replace(".io", "")
            tool = "/".join(parts[1:])
            return True, server, tool

    # Pattern 4: server.tool (dot notation, but not file extensions)
    if "." in tool_name and not tool_name.endswith((".py", ".js", ".ts", ".json")):
        parts = tool_name.split(".", 1)
        if len(parts) == 2 and parts[0].isalnum():
            return True, parts[0], parts[1]

    return False, None, None


def classify_action(tool_name):
    """Classify tool into action category."""
    # Check for MCP tool first
    is_mcp, server, _ = detect_mcp_tool(tool_name)
    if is_mcp:
        return "mcp"

    categories = {
        "file_read": ["Read", "Glob", "Grep"],
        "file_write": ["Write", "Edit", "NotebookEdit"],
        "command": ["Bash"],
        "network": ["WebFetch", "WebSearch"],
        "delegation": ["Task"],
        "state": ["TodoWrite"],
    }
    for category, tools in categories.items():
        if tool_name in tools:
            return category
    return "other"


def extract_target(tool_name, tool_input):
    """Extract primary target from tool input."""
    if tool_name in ["Read", "Write", "Edit", "Glob"]:
        return tool_input.get("file_path", tool_input.get("path", ""))
    elif tool_name == "Bash":
        cmd = tool_input.get("command", "")
        # First word or first 50 chars
        return cmd.split()[0] if cmd.split() else cmd[:50]
    elif tool_name == "Grep":
        return f"pattern:{tool_input.get('pattern', '')[:30]}"
    elif tool_name == "WebFetch":
        return tool_input.get("url", "")[:100]
    elif tool_name == "WebSearch":
        return f"search:{tool_input.get('query', '')[:50]}"
    elif tool_name == "Task":
        return tool_input.get("description", "")[:50]
    return ""


def create_r6_request(session, tool_name, tool_input):
    """
    Create R6 request capturing intent.

    This is the core of the R6 framework - structured intent capture.
    """
    r6_id = str(uuid.uuid4())[:8]
    action_category = classify_action(tool_name)
    target = extract_target(tool_name, tool_input)

    r6 = {
        "id": f"r6:{r6_id}",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",

        # R1: Rules - constraints (policy entity is society's law)
        "rules": {
            "audit_level": session["preferences"]["audit_level"],
            "budget_remaining": session["preferences"].get("action_budget"),
            "policy_entity_id": session.get("policy_entity_id"),
        },

        # R2: Role - who's asking
        "role": {
            "session_token": session["token"]["token_id"],
            "binding": session["token"]["binding"],
            "action_index": session["action_count"]
        },

        # R3: Request - what's being asked
        "request": {
            "tool": tool_name,
            "category": action_category,
            "target": target,
            "input_hash": hashlib.sha256(
                json.dumps(tool_input, sort_keys=True).encode()
            ).hexdigest()[:16]
        },

        # R4: Reference - history context
        "reference": {
            "session_id": session["session_id"],
            "prev_r6": session["r6_requests"][-1] if session["r6_requests"] else None,
            "chain_length": len(session["r6_requests"])
        },

        # R5: Resource - what's needed (extensible)
        "resource": {
            "estimated_tokens": None,  # Could be estimated
            "requires_approval": False  # Could be policy-driven
        }

        # R6: Result - filled in by post_tool_use
    }

    return r6


def log_r6(r6_request):
    """Log R6 request for audit trail."""
    R6_LOG_DIR.mkdir(parents=True, exist_ok=True)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log_file = R6_LOG_DIR / f"{today}.jsonl"

    with open(log_file, "a") as f:
        f.write(json.dumps(r6_request) + "\n")


def main():
    """Pre-tool-use hook entry point."""
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input) if raw_input.strip() else {}
    except json.JSONDecodeError:
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "unknown")
    tool_input = input_data.get("tool_input", {})

    # Load session
    session = load_session(session_id)
    if not session:
        # No session - allow tool to proceed without R6 tracking
        sys.exit(0)

    # Create R6 request
    r6 = create_r6_request(session, tool_name, tool_input)

    # Evaluate policy - society's law
    category = r6["request"]["category"]
    target = r6["request"]["target"]
    decision, policy_eval = evaluate_policy(session, tool_name, category, target)

    # Add policy evaluation to R6 record
    if policy_eval:
        r6["policy"] = policy_eval

    # Handle policy decision
    if decision == "deny" and policy_eval and policy_eval.get("enforced", True):
        # Policy blocks this action
        r6["result"] = {
            "status": "blocked",
            "reason": policy_eval.get("reason", "Blocked by policy"),
            "rule_id": policy_eval.get("rule_id"),
        }
        log_r6(r6)

        # Witness the policy decision (policy witnesses a deny)
        if GOVERNANCE_AVAILABLE and PolicyRegistry:
            try:
                registry = PolicyRegistry()
                policy_entity_id = session.get("policy_entity_id")
                if policy_entity_id:
                    registry.witness_decision(
                        policy_entity_id, session["session_id"], tool_name, "deny", success=False
                    )
            except Exception:
                pass  # Don't fail hook on witnessing error

        # Output block message
        print(f"[Web4/Policy] BLOCKED: {policy_eval.get('reason', 'Blocked by policy')}", file=sys.stderr)

        # Exit with non-zero to signal Claude Code to block the tool
        # Note: Claude Code hooks expect specific exit codes or JSON output
        # Exit 0 = allow, non-zero = deny (or output {"decision": "deny"})
        print(json.dumps({"decision": "deny", "reason": policy_eval.get("reason")}))
        sys.exit(0)  # Exit 0 but with deny decision in stdout

    elif decision == "warn":
        # Log warning but allow
        reason = policy_eval.get("reason", "Warning from policy") if policy_eval else "Warning"
        print(f"[Web4/Policy] WARNING: {reason}", file=sys.stderr)

    # Check trust-based capabilities if an agent is active
    active_agent = session.get("active_agent")
    if active_agent and GOVERNANCE_AVAILABLE and tool_name != "Task":
        try:
            gov = AgentGovernance()
            cap_check = gov.on_tool_use(
                session_id=session_id,
                role_id=active_agent,
                tool_name=tool_name,
                tool_input=tool_input,
                atp_cost=1
            )

            if not cap_check.get("allowed", True):
                # Agent lacks trust for this tool
                r6["capability"] = {
                    "blocked": True,
                    "agent": active_agent,
                    "required": cap_check.get("required"),
                    "trust_level": cap_check.get("trust_level"),
                    "error": cap_check.get("error"),
                }
                r6["result"] = {
                    "status": "blocked",
                    "reason": cap_check.get("error", "Insufficient trust"),
                }
                log_r6(r6)

                print(f"[Web4/Trust] BLOCKED: {cap_check.get('error')} (agent: {active_agent})", file=sys.stderr)
                print(json.dumps({"decision": "deny", "reason": cap_check.get("error")}))
                sys.exit(0)

            r6["capability"] = {
                "allowed": True,
                "agent": active_agent,
                "trust_level": cap_check.get("trust_level", "unknown"),
            }
        except Exception as e:
            r6["capability"] = {"error": str(e)}

    # Handle agent spawn (Task tool = agent delegation)
    agent_context = None
    if tool_name == "Task" and GOVERNANCE_AVAILABLE:
        agent_name = tool_input.get("subagent_type", tool_input.get("description", "unknown"))
        try:
            gov = AgentGovernance()
            agent_context = gov.on_agent_spawn(session_id, agent_name)

            # Add agent context to R6 request
            r6["agent"] = {
                "name": agent_name,
                "trust_level": agent_context.get("trust", {}).get("trust_level", "unknown"),
                "t3_average": agent_context.get("trust", {}).get("t3_average", 0.5),
                "references_loaded": agent_context.get("references_loaded", 0),
                "capabilities": agent_context.get("capabilities", {})
            }

            # Track active agent in session
            session["active_agent"] = agent_name

        except Exception as e:
            # Don't fail the hook on governance errors
            r6["agent"] = {"name": agent_name, "error": str(e)}

    # Handle MCP tool calls - track for witnessing
    is_mcp, mcp_server, mcp_tool = detect_mcp_tool(tool_name)
    if is_mcp and GOVERNANCE_AVAILABLE and EntityTrustStore:
        try:
            store = EntityTrustStore()
            mcp_entity_id = f"mcp:{mcp_server}"
            mcp_trust = store.get(mcp_entity_id)

            # Add MCP context to R6 request
            r6["mcp"] = {
                "server": mcp_server,
                "tool": mcp_tool,
                "entity_id": mcp_entity_id,
                "t3_average": mcp_trust.t3_average(),
                "trust_level": mcp_trust.trust_level(),
                "action_count": mcp_trust.action_count
            }

            # Track pending MCP call in session for witnessing on complete
            session["pending_mcp"] = {
                "server": mcp_server,
                "entity_id": mcp_entity_id,
                "tool": mcp_tool
            }

        except Exception as e:
            r6["mcp"] = {"server": mcp_server, "error": str(e)}

    # Log for audit
    log_r6(r6)

    # Record heartbeat for timing coherence tracking
    heartbeat = get_session_heartbeat(session_id)
    hb_entry = heartbeat.record(tool_name, session["action_count"])
    timing_coherence = heartbeat.timing_coherence()

    # Attach heartbeat info to R6 request
    r6["heartbeat"] = {
        "sequence": hb_entry["sequence"],
        "status": hb_entry["status"],
        "delta_seconds": hb_entry["delta_seconds"],
        "timing_coherence": timing_coherence
    }

    # Update session
    session["pending_r6"] = r6
    session["action_count"] += 1
    session["timing_coherence"] = timing_coherence
    save_session(session)

    # Show R6 status if verbose
    if session["preferences"]["audit_level"] == "verbose":
        coherence_indicator = "●" if timing_coherence >= 0.8 else "◐" if timing_coherence >= 0.5 else "○"
        policy_indicator = f"[{decision}]" if policy_eval else ""
        print(f"[R6] {r6['request']['category']}:{r6['request']['target'][:30]} {coherence_indicator}{timing_coherence:.2f} {policy_indicator}", file=sys.stderr)

    # Record rate limit usage for allowed actions
    if decision == "allow" and policy_eval and policy_eval.get("rule_id"):
        rate_limiter = get_rate_limiter()
        if rate_limiter:
            key = f"ratelimit:{policy_eval['rule_id']}:{tool_name}"
            rate_limiter.record(key)

    # Allow tool to proceed
    sys.exit(0)


if __name__ == "__main__":
    main()
