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
    }


def initialize_session(session_id):
    """Initialize Web4 session state."""
    SESSION_DIR.mkdir(parents=True, exist_ok=True)

    token = create_session_token()
    prefs = load_preferences()

    session = {
        "session_id": session_id,
        "token": token,
        "preferences": prefs,
        "started_at": datetime.now(timezone.utc).isoformat() + "Z",
        "action_count": 0,
        "r6_requests": [],
        "audit_chain": []
    }

    session_file = SESSION_DIR / f"{session_id}.json"
    with open(session_file, "w") as f:
        json.dump(session, f, indent=2)

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
        print(f"[Web4] Session {token_short} (software-bound)", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
