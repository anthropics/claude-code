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
    from governance import AgentGovernance
    GOVERNANCE_AVAILABLE = True
except ImportError:
    GOVERNANCE_AVAILABLE = False

WEB4_DIR = Path.home() / ".web4"
SESSION_DIR = WEB4_DIR / "sessions"
R6_LOG_DIR = WEB4_DIR / "r6"


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


def classify_action(tool_name):
    """Classify tool into action category."""
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

        # R1: Rules - constraints (extensible by user preferences)
        "rules": {
            "audit_level": session["preferences"]["audit_level"],
            "budget_remaining": session["preferences"].get("action_budget")
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
        print(f"[R6] {r6['request']['category']}:{r6['request']['target'][:30]} {coherence_indicator}{timing_coherence:.2f}", file=sys.stderr)

    # Always allow - this is observational, not enforcement
    sys.exit(0)


if __name__ == "__main__":
    main()
