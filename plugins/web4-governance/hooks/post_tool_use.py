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
import time
import hashlib
from datetime import datetime, timezone
from pathlib import Path

# Import the pre->post correlation channel (per-call map + lock + logged expiry)
sys.path.insert(0, str(Path(__file__).parent))
import slot_channel

# Import agent governance
sys.path.insert(0, str(Path(__file__).parent.parent))
try:
    from governance import AgentGovernance, EntityTrustStore, PolicyRegistry
    GOVERNANCE_AVAILABLE = True
except ImportError:
    GOVERNANCE_AVAILABLE = False
    EntityTrustStore = None
    PolicyRegistry = None

WEB4_DIR = Path.home() / ".web4"
SESSION_DIR = WEB4_DIR / "sessions"
AUDIT_DIR = WEB4_DIR / "audit"


def load_session(session_id):
    """Load session state. Robust to corrupt files."""
    session_file = SESSION_DIR / f"{session_id}.json"
    if not session_file.exists():
        return None
    try:
        with open(session_file) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        # Same defense as pre_tool_use.py: quarantine + treat as missing.
        # A concurrent partial write from another hook can leave the file
        # in a half-written state; rather than crash every subsequent
        # tool call, set it aside and let the next call lazy-init.
        try:
            session_file.rename(session_file.with_suffix(".json.corrupt"))
        except OSError:
            pass
        return None


def save_session(session):
    """Save session state atomically (per-process tmp, then rename).

    This function was the top frame of the most common crash under
    concurrency: with a fixed ``<session>.json.tmp`` shared by all hook
    processes, the loser of a staging race raised FileNotFoundError out of
    ``os.replace``. 8 of 180 invocations at 6-way concurrency on git HEAD, all
    of them in this hook -- and a PostToolUse that dies leaves an r6 record
    with no audit record, i.e. it lands in the same 16,455-record gap the
    channel fix is aimed at, by a completely different mechanism. See
    slot_channel.save_atomic.
    """
    slot_channel.save_atomic(session)


def hash_content(content):
    """Create hash of content for audit."""
    if content is None:
        return "null"
    if isinstance(content, dict):
        content = json.dumps(content, sort_keys=True)
    elif not isinstance(content, str):
        content = str(content)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def create_audit_record(session, r6_request, tool_output, tool_error, channel=None):
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

        # How this record found its intent. Recorded rather than assumed: the
        # correlation key is derived from tool_name + tool_input, and whether
        # the harness hands both hooks byte-identical input is a claim about
        # someone else's serializer. ``match_mode == "fifo_fallback"`` means it
        # does not, and this field is how that becomes measurable instead of
        # invisible. See slot_channel.match_and_pop.
        "channel": channel or {},

        # Provenance chain. prev_record_hash is filled by finalize_record()
        # under the session lock, immediately before the append -- read here it
        # would come from a copy that a concurrent post-hook has already
        # extended, and two records would claim the same predecessor.
        "provenance": {
            "session_id": session["session_id"],
            "session_token": session["token"]["token_id"],
            "action_index": r6_request["role"]["action_index"],
        }
    }

    return record


def finalize_record(record, prev_hash):
    """Seal the record: link it to its predecessor, then hash it.

    ``hash_covers`` is stamped because this changed. Until 2026-07-26
    ``record_hash`` was computed in create_audit_record, *before*
    ``agent_completion`` / ``mcp_witnessed`` / ``policy_witnessed`` were
    attached -- so no stored record's hash covered its own witnessing
    evidence. Hashing later fixes that, and puts the rule in the record so a
    verifier can tell which one applies without consulting a changelog:
    absent field = pre-2026-07-26 subset hash.
    """
    record["provenance"]["prev_record_hash"] = prev_hash
    record["hash_covers"] = "full_record"
    record["record_hash"] = hash_content(record)
    return record


def store_audit_record(session, record):
    """Store audit record to session log."""
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)

    # Session-specific audit log. Single-write append (slot_channel.append_jsonl)
    # so a concurrent writer cannot splice a record and make it uncountable.
    audit_file = AUDIT_DIR / f"{session['session_id']}.jsonl"
    slot_channel.append_jsonl(audit_file, record)


def extract_outcome(input_data):
    """
    Pull (output, error) out of a PostToolUse payload.

    Claude Code sends the result under `tool_response`; this hook originally read
    `tool_output`/`tool_error`, keys the harness never sends. The effect was silent
    and total: every audit record since 2026-01-30 carried
    status="success" / output_hash="null", including for calls that failed, and the
    same always-True flag was handed to AgentGovernance.on_agent_complete(). Sibling
    hooks on this event (snarc's post-tool-use.js, hestia's witness.py) already read
    `tool_response` — the disagreement was the tell. Fallbacks are kept so a payload
    using the old key still works.
    """
    response = input_data.get("tool_response")
    if response is None:
        response = input_data.get("tool_result")
    if response is None:
        response = input_data.get("tool_output")

    error = input_data.get("tool_error")
    if error is None and isinstance(response, dict):
        if response.get("is_error") or response.get("isError"):
            error = (
                response.get("error")
                or response.get("message")
                or response.get("content")
                or "tool error"
            )

    return response, error


def main():
    """Post-tool-use hook entry point."""
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input) if raw_input.strip() else {}
    except json.JSONDecodeError:
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name_in = input_data.get("tool_name", "unknown")
    tool_input_in = input_data.get("tool_input", {})
    tool_use_id = input_data.get("tool_use_id")
    tool_output, tool_error = extract_outcome(input_data)

    # Claim this call's pending entry under the session lock.
    #
    # The pop has to be atomic with respect to other PostToolUse invocations,
    # and that is not a hypothetical: 1,460 record_ids in ~/.web4/audit appear
    # more than once, with identical output hashes and a p50 separation of
    # 6.4 ms, while the corresponding r6 records are NOT duplicated. The
    # pre-hook ran once; two post-hooks both read the single slot before
    # either cleared it. Under the lock the second one finds nothing and says
    # so in the channel log, instead of writing a second audit record.
    lock = slot_channel.session_lock(session_id)
    with lock as locked:
        session = load_session(session_id)
        if not session:
            sys.exit(0)

        entry, match_mode = slot_channel.match_and_pop(
            session, tool_name_in, tool_input_in, tool_use_id=tool_use_id
        )
        if entry is None:
            # Nothing outstanding for this call. Either a duplicate PostToolUse
            # (see above), or a tool whose PreToolUse never enqueued -- both are
            # worth counting, neither is worth an audit record.
            slot_channel.log_channel_event(
                "unmatched_post", session_id,
                {
                    "tool": tool_name_in,
                    "tool_use_id": tool_use_id,
                    "key": slot_channel.call_key(tool_name_in, tool_input_in),
                    "lock": lock.state,
                },
            )
            sys.exit(0)

        r6_request = entry.get("r6")
        if not r6_request:
            sys.exit(0)

        pending_mcp = entry.get("mcp") or session.get("pending_mcp")
        channel = {
            "match_mode": match_mode,
            "lock": lock.state,
            "pending_depth_after": slot_channel.pending_depth(session),
            "tool_use_id": tool_use_id,
        }
        if entry.get("enqueued_ts"):
            channel["queued_seconds"] = round(time.time() - entry["enqueued_ts"], 4)
        # Publish the pop before doing any governance work below: the entry is
        # claimed the moment we decide to use it, so a concurrent post-hook
        # cannot claim it while we are still witnessing trust stores.
        slot_channel.save_atomic(session)

    # Create audit record
    record = create_audit_record(
        session, r6_request, tool_output, tool_error, channel=channel
    )

    # Handle agent completion (Task tool = agent delegation)
    clear_active_agent = False
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

                # Clear active agent (applied under the lock below)
                clear_active_agent = True

            except Exception as e:
                record["agent_completion"] = {"error": str(e)}

    # Handle MCP tool completion - witness the MCP server.
    # pending_mcp comes off *this call's* channel entry (falling back to the
    # legacy session field for pre-migration sessions), so a concurrent
    # non-MCP call can no longer consume or misattribute the witness.
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

        except Exception as e:
            record["mcp_witnessed"] = {"error": str(e)}

    # Handle policy witnessing - policy witnesses the allowed decision outcome
    policy_entity_id = session.get("policy_entity_id")
    policy_eval = r6_request.get("policy")
    if policy_entity_id and GOVERNANCE_AVAILABLE and PolicyRegistry:
        try:
            registry = PolicyRegistry()
            tool_name = r6_request["request"]["tool"]
            success = tool_error is None
            decision = policy_eval.get("decision", "allow") if policy_eval else "allow"

            # Policy witnesses this decision's outcome
            registry.witness_decision(
                policy_entity_id,
                session["session_id"],
                tool_name,
                decision,
                success=success,
            )

            # Add policy witnessing to audit record
            record["policy_witnessed"] = {
                "policy_entity_id": policy_entity_id,
                "decision": decision,
                "success": success,
                "rule_id": policy_eval.get("rule_id") if policy_eval else None,
            }

        except Exception as e:
            record["policy_witnessed"] = {"error": str(e)}

    # Seal and store the record, then commit the session, under the lock.
    #
    # Second locked phase rather than one long one: the witnessing above does
    # trust-store I/O, and holding an exclusive session lock across it would
    # push concurrent hooks into their fail-open path. The chain link is read
    # and written inside this phase, so the read-then-append is atomic even
    # though the record was built outside it.
    lock2 = slot_channel.session_lock(session_id)
    with lock2 as locked2:
        fresh = slot_channel.load_raw(session_id) or session
        fresh["session_id"] = session["session_id"]
        chain = fresh.get("audit_chain")
        if not isinstance(chain, list):
            chain = []
        prev_hash = chain[-1] if chain else "genesis"
        record["channel"]["commit_lock"] = lock2.state
        finalize_record(record, prev_hash)

        store_audit_record(session, record)

        requests = fresh.get("r6_requests")
        if not isinstance(requests, list):
            requests = []
        fresh["r6_requests"] = requests + [r6_request["id"]]
        fresh["audit_chain"] = chain + [record["record_hash"]]
        if clear_active_agent:
            fresh["active_agent"] = None
        # Legacy single slots: retired, and cleared so a stale value can never
        # be matched to an unrelated future call by the legacy_slot fallback.
        fresh["pending_r6"] = None
        fresh["pending_mcp"] = None
        slot_channel.save_atomic(fresh)

    sys.exit(0)


if __name__ == "__main__":
    main()
