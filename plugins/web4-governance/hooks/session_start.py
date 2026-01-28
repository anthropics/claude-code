#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Governance Plugin - Session Start Hook
# https://github.com/dp-web4/web4

"""
Web4 Session Start Hook

Initializes governance context for the Claude Code session:
- Creates session identity token
- Loads governance preferences
- Initializes audit trail

This is a lightweight implementation focused on the R6 workflow formalism.
For hardware-bound identity and enterprise features, see Hardbound.
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
    from governance import AgentGovernance, RoleTrustStore, PolicyRegistry, resolve_preset, is_preset_name
    GOVERNANCE_AVAILABLE = True
except ImportError:
    GOVERNANCE_AVAILABLE = False
    PolicyRegistry = None

# Web4 state directory
WEB4_DIR = Path.home() / ".web4"
SESSION_DIR = WEB4_DIR / "sessions"


def create_session_token():
    """
    Create a software-bound session token.

    In the full Web4 spec, this would be an LCT (Linked Context Token)
    bound to hardware. This light version uses a software-derived token.

    Trust interpretation is up to the relying party.
    """
    # Derive from machine + user + timestamp for uniqueness
    seed = f"{os.uname().nodename}:{os.getuid()}:{datetime.now(timezone.utc).isoformat()}"
    token_hash = hashlib.sha256(seed.encode()).hexdigest()[:12]

    return {
        "token_id": f"web4:session:{token_hash}",
        "binding": "software",  # Explicit: not hardware-bound
        "created_at": datetime.now(timezone.utc).isoformat() + "Z",
        "machine_hint": hashlib.sha256(os.uname().nodename.encode()).hexdigest()[:8]
    }


def load_preferences():
    """Load user governance preferences."""
    prefs_file = WEB4_DIR / "preferences.json"

    if prefs_file.exists():
        with open(prefs_file) as f:
            return json.load(f)

    # Default preferences
    return {
        "audit_level": "standard",  # minimal, standard, verbose
        "show_r6_status": True,
        "action_budget": None,  # No limit by default
        "policy_preset": "safety",  # Default policy preset (permissive, safety, strict, audit-only)
    }


def register_policy_entity(session_id: str, prefs: dict):
    """
    Register policy as a first-class entity in the trust network.

    Policy is society's law - immutable once registered, hash-tracked in the chain.
    Creates bidirectional witnessing: session witnesses operating under policy.

    Returns:
        Tuple of (policy_entity_id, policy_entity) or (None, None) if unavailable
    """
    if not GOVERNANCE_AVAILABLE or PolicyRegistry is None:
        return None, None

    preset_name = prefs.get("policy_preset", "safety")

    # Validate preset name
    if not is_preset_name(preset_name):
        # Fall back to safety if invalid preset specified
        preset_name = "safety"

    try:
        registry = PolicyRegistry()

        # Register policy (creates hash-identified entity, persists to disk)
        policy_entity = registry.register_policy(
            name=preset_name,
            preset=preset_name,
        )

        # Session witnesses operating under this policy
        registry.witness_session(policy_entity.entity_id, session_id)

        return policy_entity.entity_id, policy_entity.to_dict()
    except Exception as e:
        # Policy registration failed - continue without policy entity
        print(f"[Web4] Policy registration failed: {e}", file=sys.stderr)
        return None, None


def initialize_session(session_id):
    """Initialize Web4 session state."""
    SESSION_DIR.mkdir(parents=True, exist_ok=True)

    token = create_session_token()
    prefs = load_preferences()

    # Register policy as first-class entity (hash-tracked, witnessable)
    policy_entity_id, policy_entity_dict = register_policy_entity(session_id, prefs)

    session = {
        "session_id": session_id,
        "token": token,
        "preferences": prefs,
        "started_at": datetime.now(timezone.utc).isoformat() + "Z",
        "action_count": 0,
        "r6_requests": [],
        "audit_chain": [],
        # Agent governance tracking
        "active_agent": None,
        "agents_used": [],
        "governance_available": GOVERNANCE_AVAILABLE,
        # Policy entity (society's law - hash-tracked in chain)
        "policy_entity_id": policy_entity_id,
        "policy_entity": policy_entity_dict,
    }

    session_file = SESSION_DIR / f"{session_id}.json"
    with open(session_file, "w") as f:
        json.dump(session, f, indent=2)

    # Initialize heartbeat tracker and record session start
    heartbeat = get_session_heartbeat(session_id)
    heartbeat.record("session_start", 0)

    return session


def main():
    """Session start hook entry point."""
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input) if raw_input.strip() else {}
    except json.JSONDecodeError:
        input_data = {}

    session_id = input_data.get("session_id", str(uuid.uuid4())[:8])

    # Initialize session
    session = initialize_session(session_id)

    # Show status if preference enabled
    if session["preferences"]["show_r6_status"]:
        token_short = session["token"]["token_id"].split(":")[-1]
        gov_status = "+" if GOVERNANCE_AVAILABLE else "-"
        policy_status = ""
        if session.get("policy_entity_id"):
            # Extract preset name from entity_id (policy:<name>:<version>:<hash>)
            policy_parts = session["policy_entity_id"].split(":")
            if len(policy_parts) >= 2:
                policy_status = f" [policy:{policy_parts[1]}]"
        print(f"[Web4] Session {token_short} (software-bound) [gov{gov_status}]{policy_status}", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
