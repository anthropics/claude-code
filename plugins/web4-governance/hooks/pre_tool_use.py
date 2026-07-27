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

# Import the pre->post correlation channel (per-call map + lock + logged expiry).
# See slot_channel.py for what the single unlocked ``pending_r6`` slot cost.
import slot_channel

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


def evaluate_policy(session, tool_name: str, category: str, target: str, full_command: str = None):
    """
    Evaluate tool call against policy entity.

    Args:
        session: Session dict with policy_entity_id
        tool_name: Name of the tool (e.g., "Bash", "Write")
        category: Tool category (e.g., "command", "file_write")
        target: Target of the operation (file path, command, URL)
        full_command: For Bash tools, the full command string (enables command_patterns matching)

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
        evaluation = policy_entity.evaluate(tool_name, category, target, rate_limiter, full_command)

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


def check_git_push_divergence(command: str) -> tuple:
    """
    Check if a git push command might fail due to remote divergence.

    This is a heuristic check that runs before git push to catch the common
    case where remote has commits we don't have locally.

    Future: This will be augmented with model-based reasoning for more
    sophisticated governance decisions.

    Args:
        command: The bash command being executed

    Returns:
        (should_block, reason) - (True, "reason") to block, (False, None) to allow
    """
    import re
    import subprocess

    # Only check git push commands
    if not re.search(r'\bgit\s+push\b', command):
        return False, None

    # Don't block force push - user explicitly wants to override
    if re.search(r'\bgit\s+push\s+.*(-f|--force)', command):
        return False, None

    try:
        # Get the repo root (if we're in a git repo)
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            # Not in a git repo - let git push fail naturally
            return False, None

        # Fetch to get current remote state (quiet, no output)
        subprocess.run(
            ["git", "fetch", "--quiet"],
            capture_output=True,
            timeout=30
        )

        # Get local HEAD
        local = subprocess.run(
            ["git", "rev-parse", "@"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if local.returncode != 0:
            return False, None
        local_ref = local.stdout.strip()

        # Get upstream HEAD
        remote = subprocess.run(
            ["git", "rev-parse", "@{u}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if remote.returncode != 0:
            # No upstream configured - allow push to set it
            return False, None
        remote_ref = remote.stdout.strip()

        # Get merge base
        base = subprocess.run(
            ["git", "merge-base", "@", "@{u}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if base.returncode != 0:
            return False, None
        base_ref = base.stdout.strip()

        # Determine divergence state
        if local_ref == remote_ref:
            # Already up to date - push will be a no-op but that's fine
            return False, None
        elif local_ref == base_ref:
            # Local is behind remote - push will fail, need to pull first
            return True, "Remote has commits you don't have. Run 'git pull --rebase' first."
        elif remote_ref == base_ref:
            # Local is ahead - normal push, allow
            return False, None
        else:
            # Diverged - both have unique commits
            return True, "Local and remote have diverged. Run 'git pull --rebase' to sync before pushing."

    except subprocess.TimeoutExpired:
        # Don't block on timeout - let git handle it
        return False, None
    except Exception:
        # Don't block on errors - let git handle it
        return False, None


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
        try:
            with open(session_file) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            # Corrupt or unreadable session file → quarantine and re-init.
            # Without this, every subsequent tool call hits the same decode
            # error and the hook reports "Failed with non-blocking status
            # code: Traceback..." on every call. Move the bad file aside so
            # we don't lose forensic data, and fall through to lazy init.
            try:
                quarantine = session_file.with_suffix(".json.corrupt")
                session_file.rename(quarantine)
            except OSError:
                pass

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

    # Save immediately — atomic write to avoid the partial-write race
    # that can leave another concurrent reader hitting JSONDecodeError.
    # Via slot_channel.save_atomic for the per-process tmp name; see
    # save_session below for what the shared tmp name cost.
    slot_channel.save_atomic(session)

    # Initialize heartbeat for recovered session. Wrapped for the same reason
    # as the heartbeat call in main(): a locked ledger must not cost a session.
    try:
        heartbeat = get_session_heartbeat(session_id)
        heartbeat.record("session_recovered", 0)
    except Exception:
        pass

    # Session recovered - logging removed to avoid Claude Code "hook error" warnings
    # (Claude Code displays any stderr output as "hook error" even for informational messages)

    return session


def load_session(session_id):
    """Load session state (wrapper for compatibility)."""
    return load_or_create_session(session_id)


def save_session(session):
    """Save session state atomically.

    Writes to a per-process tmp then renames.

    The tmp name used to be a fixed ``<session>.json.tmp``, shared by every
    concurrent hook process. That made the *publish* atomic and left the
    *staging* unisolated, so two savers raced on one tmp file: the loser's
    ``os.replace`` hit FileNotFoundError (8 of 180 invocations at 6-way
    concurrency, measured 2026-07-26 against git HEAD) and the interleavings
    that did not crash silently published one process's stale copy over the
    other's update. Fixing corruption by making the write atomic was right and
    incomplete -- atomicity is not isolation. The pid suffix supplies the
    isolation; the lock in slot_channel supplies the serialization.
    """
    slot_channel.save_atomic(session)


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
    """Log R6 request for audit trail.

    ``timestamp`` is stamped in ``create_r6_request`` and this append happens
    later in the same process, so the record's own timestamp *leads* its
    write. That lead is not measurable from the record, which is why
    ``written_at`` is stamped here: both quantities in one store, no
    cross-store join needed to see the aperture.
    """
    R6_LOG_DIR.mkdir(parents=True, exist_ok=True)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log_file = R6_LOG_DIR / f"{today}.jsonl"

    record = dict(r6_request)
    record["written_at"] = datetime.now(timezone.utc).isoformat() + "Z"

    # Single-write append: this store already contains one torn line spliced
    # from two records. See slot_channel.append_jsonl.
    slot_channel.append_jsonl(log_file, record)


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
    # Present on PreToolUse payloads; not documented for PostToolUse, so it is
    # a tiebreaker inside a key, never the key itself (slot_channel.match_and_pop).
    tool_use_id = input_data.get("tool_use_id")

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
    # For Bash tools, pass full command to enable command_patterns matching
    full_command = tool_input.get("command") if tool_name == "Bash" else None

    # Git push divergence check (heuristic - will be model-augmented later)
    if tool_name == "Bash" and full_command:
        should_block, divergence_reason = check_git_push_divergence(full_command)
        if should_block:
            r6["git_check"] = {
                "blocked": True,
                "reason": divergence_reason,
            }
            r6["result"] = {
                "status": "blocked",
                "reason": divergence_reason,
                "rule_id": "git-divergence-check",
            }
            log_r6(r6)
            print(f"[Web4/Git] BLOCKED: {divergence_reason}", file=sys.stderr)
            print(json.dumps({"decision": "deny", "reason": divergence_reason}))
            sys.exit(0)

    decision, policy_eval = evaluate_policy(session, tool_name, category, target, full_command)

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
        # Log warning but allow — don't print to stderr (Claude Code treats any stderr as "hook error")
        pass

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
    spawned_agent = None
    pending_mcp = None
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

            # Track active agent in session (applied to the freshly-loaded
            # copy under the lock below, so a concurrent writer cannot drop it)
            spawned_agent = agent_name
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

            # Track the pending MCP call *on this call's channel entry*, not on
            # a session-level slot: the session-level field had the same
            # single-cell defect as pending_r6, so a concurrent non-MCP call
            # could clear it or an MCP witness could be attributed to the
            # wrong tool. Carried into the entry below.
            pending_mcp = {
                "server": mcp_server,
                "entity_id": mcp_entity_id,
                "tool": mcp_tool
            }

        except Exception as e:
            r6["mcp"] = {"server": mcp_server, "error": str(e)}

    # Record heartbeat for timing coherence tracking.
    #
    # Wrapped, because this was an uncaught crash path: heartbeat opens the
    # shared sqlite ledger, and 8 concurrent PreToolUse hooks reproduced
    # ``OperationalError: database is locked`` here, which killed the hook
    # *before* the r6 record was written. That is a worse loss than the one
    # this whole section exists to fix -- a slot loss leaves an r6 record with
    # no audit record, so it can at least be counted, while a dead hook leaves
    # nothing in either store and is invisible by construction. Instrumentation
    # is not allowed to cost the record it instruments.
    timing_coherence = None
    hb_error = None
    try:
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
    except Exception as e:
        hb_error = "%s: %s" % (type(e).__name__, e)
        r6["heartbeat"] = {"error": hb_error}
        slot_channel.log_channel_event(
            "heartbeat_unavailable", session_id,
            {"tool": tool_name, "error": hb_error},
        )

    # Publish this call on the channel, under an exclusive lock.
    #
    # Everything above this point is either read-only against the session or
    # local to this call; the session copy loaded at the top of main() may be
    # seconds stale by now, and blindly writing it back is how concurrent
    # hooks lost each other's updates. So: re-load fresh inside the lock,
    # apply only the fields this call actually owns, publish atomically.
    channel = {}
    with slot_channel.session_lock(session_id) as locked:
        fresh = slot_channel.load_raw(session_id) or session
        # A quarantine or lazy re-init between our load and now would give us a
        # different session identity; ours is the authoritative id for this call.
        fresh["session_id"] = session["session_id"]
        fresh.setdefault("token", session.get("token"))
        fresh.setdefault("r6_requests", session.get("r6_requests", []))
        fresh.setdefault("audit_chain", session.get("audit_chain", []))
        fresh.setdefault("preferences", session.get("preferences", {}))

        # action_index is re-stamped from the authoritative count: the value
        # computed at create_r6_request time came from a possibly stale copy,
        # which is how two concurrent calls could claim the same index.
        fresh_count = fresh.get("action_count", session.get("action_count", 0))
        if not isinstance(fresh_count, int):
            fresh_count = 0
        r6["role"]["action_index"] = fresh_count
        r6["reference"]["chain_length"] = len(fresh.get("r6_requests") or [])

        if spawned_agent:
            fresh["active_agent"] = spawned_agent

        slot_channel.sweep(fresh)
        slot_channel.enqueue(
            fresh, r6, tool_name, tool_input,
            tool_use_id=tool_use_id, mcp=pending_mcp,
        )
        # The single-slot field is retired. Clearing it (rather than leaving a
        # stale value) keeps post_tool_use's legacy fallback from matching a
        # months-old r6 record to some unrelated future tool call.
        fresh["pending_r6"] = None
        fresh["pending_mcp"] = None
        fresh["action_count"] = fresh_count + 1
        if timing_coherence is not None:
            fresh["timing_coherence"] = timing_coherence

        # Stamped before the write so the enqueued copy carries it too — the
        # map holds this same dict by reference, so the r6 store and the
        # channel entry stay one object, not two versions of one.
        channel = {
            "lock": "held" if locked else "timeout",
            "pending_depth": slot_channel.pending_depth(fresh),
            "tool_use_id": tool_use_id,
        }
        r6["channel"] = channel
        slot_channel.save_atomic(fresh)

    # Log for audit. Deliberately after the heartbeat block is attached and
    # after the action_index is re-stamped: this append used to happen at the
    # top of the section above, which is why 0 of 91,992 stored r6 records
    # carry a heartbeat while 76,293 of 76,293 audit records do. The two
    # stores were holding different versions of the same object.
    log_r6(r6)

    # Verbose R6 status removed - stderr output causes Claude Code "hook error" warnings
    # R6 data is still logged to r6_log/ for audit purposes

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
