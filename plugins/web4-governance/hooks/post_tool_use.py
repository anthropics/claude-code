#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Governance Plugin - Post-Tool-Use Hook
# https://github.com/dp-web4/web4

"""
Web4 Post-Tool-Use Hook

Completes the R6 workflow with Result:

    R6 = Rules + Role + Request + Reference + Resource → **Result**

Creates an audit record that:
- Links to the R6 request (intent)
- Records outcome (success/error)
- Maintains provenance chain
- Enables after-the-fact verification

## Audit Record Schema

Each action produces a record with:
- request_id: Links to R6 request
- result_status: success/error
- result_hash: Hash of output (not output itself)
- timestamp: When completed
- chain_link: Hash of previous record (provenance)

This creates a verifiable chain of actions with structured intent.
"""

import json
import os
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path

# Import agent governance
sys.path.insert(0, str(Path(__file__).parent.parent))
try:
    from governance import AgentGovernance, EntityTrustStore
    GOVERNANCE_AVAILABLE = True
except ImportError:
    GOVERNANCE_AVAILABLE = False
    EntityTrustStore = None

WEB4_DIR = Path.home() / ".web4"
SESSION_DIR = WEB4_DIR / "sessions"
AUDIT_DIR = WEB4_DIR / "audit"


def load_session(session_id):
    """Load session state."""
    session_file = SESSION_DIR / f"{session_id}.json"
    if not session_file.exists():
        return None
    with open(session_file) as f:
        return json.load(f)


def save_session(session):
    """Save session state."""
    session_file = SESSION_DIR / f"{session['session_id']}.json"
    with open(session_file, "w") as f:
        json.dump(session, f, indent=2)


def hash_content(content):
    """Create hash of content for audit."""
    if content is None:
        return "null"
    if isinstance(content, dict):
        content = json.dumps(content, sort_keys=True)
    elif not isinstance(content, str):
        content = str(content)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def create_audit_record(session, r6_request, tool_output, tool_error):
    """
    Create audit record completing the R6 workflow.

    The audit record links intent (R6 request) to outcome (result).
    """
    # Determine result
    if tool_error:
        status = "error"
        result_hash = hash_content(str(tool_error))
    else:
        status = "success"
        result_hash = hash_content(tool_output)

    # Chain link for provenance
    prev_hash = session["audit_chain"][-1] if session["audit_chain"] else "genesis"

    record = {
        "record_id": r6_request["id"].replace("r6:", "audit:"),
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",

        # Link to intent
        "r6_request_id": r6_request["id"],
        "tool": r6_request["request"]["tool"],
        "category": r6_request["request"]["category"],
        "target": r6_request["request"]["target"],

        # Result (R6 completion)
        "result": {
            "status": status,
            "output_hash": result_hash,
        },

        # Heartbeat timing (from R6 request)
        "heartbeat": r6_request.get("heartbeat", {}),

        # Provenance chain
        "provenance": {
            "session_id": session["session_id"],
            "session_token": session["token"]["token_id"],
            "action_index": r6_request["role"]["action_index"],
            "prev_record_hash": prev_hash
        }
    }

    # Compute this record's hash for chain
    record["record_hash"] = hash_content(record)

    return record


def store_audit_record(session, record):
    """Store audit record to session log."""
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    # Session-specific audit log
    audit_file = AUDIT_DIR / f"{session['session_id']}.jsonl"

    with open(audit_file, "a") as f:
        f.write(json.dumps(record) + "\n")


def main():
    """Post-tool-use hook entry point."""
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input) if raw_input.strip() else {}
    except json.JSONDecodeError:
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_output = input_data.get("tool_output")
    tool_error = input_data.get("tool_error")

    # Load session
    session = load_session(session_id)
    if not session:
        sys.exit(0)

    # Get pending R6 request
    r6_request = session.get("pending_r6")
    if not r6_request:
        sys.exit(0)

    # Create audit record
    record = create_audit_record(session, r6_request, tool_output, tool_error)

    # Handle agent completion (Task tool = agent delegation)
    if r6_request["request"]["tool"] == "Task" and GOVERNANCE_AVAILABLE:
        agent_name = session.get("active_agent")
        if agent_name:
            try:
                gov = AgentGovernance()
                success = tool_error is None
                trust_update = gov.on_agent_complete(session_id, agent_name, success)

                # Add trust update to audit record
                record["agent_completion"] = {
                    "agent_name": agent_name,
                    "success": success,
                    "trust_updated": trust_update.get("trust_updated", {})
                }

                # Clear active agent
                session["active_agent"] = None

            except Exception as e:
                record["agent_completion"] = {"error": str(e)}

    # Handle MCP tool completion - witness the MCP server
    pending_mcp = session.get("pending_mcp")
    if pending_mcp and GOVERNANCE_AVAILABLE and EntityTrustStore:
        try:
            store = EntityTrustStore()
            success = tool_error is None

            # Session witnesses the MCP server
            session_entity = f"session:{session_id}"
            mcp_entity = pending_mcp["entity_id"]

            witness_trust, target_trust = store.witness(
                session_entity, mcp_entity, success, magnitude=0.1
            )

            # Add MCP witnessing to audit record
            record["mcp_witnessed"] = {
                "server": pending_mcp["server"],
                "tool": pending_mcp["tool"],
                "success": success,
                "t3_after": round(target_trust.t3_average(), 3),
                "trust_level": target_trust.trust_level(),
                "action_count": target_trust.action_count
            }

            # Clear pending MCP
            session["pending_mcp"] = None

        except Exception as e:
            record["mcp_witnessed"] = {"error": str(e)}

    # Store audit record
    store_audit_record(session, record)

    # Update session
    session["r6_requests"].append(r6_request["id"])
    session["audit_chain"].append(record["record_hash"])
    session["pending_r6"] = None
    save_session(session)

    sys.exit(0)


if __name__ == "__main__":
    main()
