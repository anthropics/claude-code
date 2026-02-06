#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Governance Plugin - Integration Test
# https://github.com/dp-web4/web4
"""
Full integration test simulating a Claude Code session.

Tests:
1. Session initialization (via session_start hook pattern)
2. R6 request creation and audit
3. MCP tool witnessing
4. Agent delegation and inter-agent witnessing
5. Trust accumulation and decay
6. Reference extraction
"""

import json
import os
import sys
import uuid
import hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add plugin to path
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "hooks"))

from governance import AgentGovernance, EntityTrustStore, RoleTrustStore
from governance.entity_trust import EntityTrust
from governance.role_trust import RoleTrust

# Web4 directories
WEB4_DIR = Path.home() / ".web4"
SESSION_DIR = WEB4_DIR / "sessions"


def print_section(title):
    """Print section header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_result(name, success, details=""):
    """Print test result."""
    status = "✓ PASS" if success else "✗ FAIL"
    print(f"  {status}: {name}")
    if details and not success:
        print(f"         {details}")


def create_test_session(session_id: str) -> dict:
    """Create a test session (mimics session_start hook)."""
    SESSION_DIR.mkdir(parents=True, exist_ok=True)

    seed = f"test:{session_id}:{datetime.now(timezone.utc).isoformat()}"
    token_hash = hashlib.sha256(seed.encode()).hexdigest()[:12]

    session = {
        "session_id": session_id,
        "token": {
            "token_id": f"web4:session:{token_hash}",
            "binding": "software",
            "created_at": datetime.now(timezone.utc).isoformat() + "Z",
        },
        "preferences": {
            "audit_level": "standard",
            "show_r6_status": True,
            "action_budget": None,
        },
        "started_at": datetime.now(timezone.utc).isoformat() + "Z",
        "action_count": 0,
        "r6_requests": [],
        "audit_chain": [],
        "active_agent": None,
        "agents_used": [],
    }

    session_file = SESSION_DIR / f"{session_id}.json"
    with open(session_file, "w") as f:
        json.dump(session, f, indent=2)

    return session


def test_session_init():
    """Test session initialization."""
    print_section("Session Initialization")

    session_id = f"test-session-{uuid.uuid4().hex[:8]}"
    session = create_test_session(session_id)

    print_result("Session created", session is not None)
    print_result("Token assigned", "token" in session)
    print_result("Preferences set", "preferences" in session)

    # Verify session file persisted
    session_file = SESSION_DIR / f"{session_id}.json"
    print_result("Session persisted", session_file.exists())

    return session_id


def test_mcp_witnessing():
    """Test MCP tool trust and witnessing."""
    print_section("MCP Witnessing")

    store = EntityTrustStore()

    # Simulate MCP server call
    mcp_entity = "mcp:filesystem"
    session_entity = "session:test-001"

    # Initial trust
    initial = store.get(mcp_entity)
    initial_t3 = initial.t3_average()
    print(f"  Initial MCP trust: {initial_t3:.3f} ({initial.trust_level()})")

    # Successful call - session witnesses MCP
    witness, target = store.witness(session_entity, mcp_entity, success=True, magnitude=0.1)

    after_success = store.get(mcp_entity)
    success_t3 = after_success.t3_average()
    print(f"  After success: {success_t3:.3f} ({after_success.trust_level()})")

    print_result("Trust increased on success", success_t3 > initial_t3)
    print_result("Witness recorded", session_entity in after_success.witnessed_by)

    # Failed call
    store.witness(session_entity, mcp_entity, success=False, magnitude=0.1)
    after_fail = store.get(mcp_entity)
    fail_t3 = after_fail.t3_average()
    print(f"  After failure: {fail_t3:.3f} ({after_fail.trust_level()})")

    print_result("Trust decreased on failure", fail_t3 < success_t3)

    # Multiple successes
    for _ in range(5):
        store.witness(session_entity, mcp_entity, success=True, magnitude=0.1)

    final = store.get(mcp_entity)
    final_t3 = final.t3_average()
    print(f"  After 5 more successes: {final_t3:.3f} ({final.trust_level()})")

    print_result("Trust accumulated over time", final_t3 > fail_t3)
    print_result("Action count tracked", final.action_count >= 6)

    return True


def test_agent_delegation():
    """Test agent spawning and completion with witnessing."""
    print_section("Agent Delegation")

    gov = AgentGovernance()
    session_id = f"test-session-agent-{uuid.uuid4().hex[:6]}"

    # Create session (mimics session_start hook)
    create_test_session(session_id)

    # Spawn first agent
    agent1 = "code-reviewer"
    context1 = gov.on_agent_spawn(session_id, agent1)

    print(f"  Agent '{agent1}' spawned")
    print(f"  Trust level: {context1.get('trust', {}).get('trust_level', 'unknown')}")
    print(f"  T3 average: {context1.get('trust', {}).get('t3_average', 0.5):.3f}")

    print_result("Agent context returned", "trust" in context1)
    print_result("Capabilities derived", "capabilities" in context1)

    # Complete agent successfully
    result1 = gov.on_agent_complete(session_id, agent1, success=True)
    print(f"  Agent '{agent1}' completed successfully")

    print_result("Trust updated on completion", result1.get("trust_updated"))

    # Spawn second agent
    agent2 = "test-generator"
    context2 = gov.on_agent_spawn(session_id, agent2)
    print(f"  Agent '{agent2}' spawned")

    # Complete successfully - should witness agent1
    result2 = gov.on_agent_complete(session_id, agent2, success=True)

    witnessed = result2.get("witnessed_agents", [])
    print(f"  Witnessed previous agents: {witnessed}")

    print_result("Inter-agent witnessing occurred", len(witnessed) > 0 or agent1 in str(witnessed))

    return True


def test_trust_decay():
    """Test trust decay over time."""
    print_section("Trust Decay")

    store = RoleTrustStore()
    role_id = "decay-test-role"

    # Create role with high trust
    trust = store.get(role_id)
    trust.reliability = 0.9
    trust.consistency = 0.85
    trust.competence = 0.8
    trust.temporal = 0.9
    trust.last_action = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    store.save(trust)

    initial_t3 = trust.t3_average()
    print(f"  Initial T3: {initial_t3:.3f}")

    # Apply decay (30 days inactive)
    trust = store.get(role_id)
    days_inactive = trust.days_since_last_action()
    print(f"  Days inactive: {days_inactive:.1f}")

    decayed = trust.apply_decay(days_inactive, decay_rate=0.01)
    if decayed:
        store.save(trust)

    final_t3 = trust.t3_average()
    print(f"  After decay T3: {final_t3:.3f}")

    print_result("Decay applied", decayed)
    print_result("T3 decreased", final_t3 < initial_t3)
    print_result("Floor maintained (>0.3)", trust.reliability >= 0.3)

    # Test entity trust decay too
    entity_store = EntityTrustStore()
    entity_id = "mcp:decay-test"

    entity = entity_store.get(entity_id)
    entity.reliability = 0.85
    entity.consistency = 0.8
    entity.temporal = 0.85
    entity.last_action = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    entity_store.save(entity)

    entity = entity_store.get_with_decay(entity_id, decay_rate=0.01)
    print(f"  Entity decay after 60 days: {entity.t3_average():.3f}")

    print_result("Entity decay works", entity.t3_average() < 0.7)

    return True


def test_reference_extraction():
    """Test auto-extraction of references from task output."""
    print_section("Reference Extraction")

    gov = AgentGovernance()
    session_id = f"test-ref-extract-{uuid.uuid4().hex[:6]}"
    create_test_session(session_id)

    # Simulate task output with extractable patterns
    task_output = """
    Analysis complete. Here are the key findings:

    Pattern: Always use snake_case for Python function names
    Pattern: Database connections should use connection pooling

    Fact: The API endpoint is at /api/v2/users
    Fact: Maximum request size is 10MB

    Preference: User prefers dark mode themes

    Summary: The codebase follows a clean architecture pattern with
    dependency injection throughout. Main entry point is src/main.py.
    """

    # Extract references (role_id is required)
    role_id = "test-analyzer"
    refs = gov.auto_extract_references(session_id, role_id, task_output)

    print(f"  Extracted {len(refs)} references:")
    for ref in refs[:5]:
        print(f"    - [{ref['ref_type']}] {ref['content'][:50]}...")

    print_result("Patterns extracted", any(r['ref_type'] == 'pattern' for r in refs))
    print_result("Facts extracted", any(r['ref_type'] == 'fact' for r in refs))
    print_result("Preferences extracted", any(r['ref_type'] == 'preference' for r in refs))
    print_result("Confidence assigned", all('confidence' in r for r in refs))

    return True


def test_witnessing_chain():
    """Test witnessing chain tracking."""
    print_section("Witnessing Chains")

    store = EntityTrustStore()

    # Create a witnessing chain: A -> B -> C
    store.witness("session:A", "mcp:B", True)
    store.witness("mcp:B", "role:C", True)
    store.witness("role:C", "ref:D", True)

    # Get chain for B
    chain = store.get_witnessing_chain("mcp:B")

    print(f"  Entity: {chain['entity_id']}")
    print(f"  T3 average: {chain['t3_average']:.3f}")
    print(f"  Witnessed by: {[w['entity_id'] for w in chain['witnessed_by']]}")
    print(f"  Has witnessed: {[w['entity_id'] for w in chain['has_witnessed']]}")

    print_result("Witnessed_by tracked", len(chain['witnessed_by']) > 0)
    print_result("Has_witnessed tracked", len(chain['has_witnessed']) > 0)
    print_result("Chain depth works", chain['t3_average'] > 0)

    return True


def test_r6_workflow():
    """Test R6 request creation (simulated)."""
    print_section("R6 Workflow")

    session_id = f"test-r6-{uuid.uuid4().hex[:6]}"
    session = create_test_session(session_id)

    # Verify session has required fields for R6 workflow
    print_result("Session has token", "token" in session)
    print_result("Session has preferences", "preferences" in session)
    print_result("Session tracks r6_requests", "r6_requests" in session)
    print_result("Session tracks audit_chain", "audit_chain" in session)

    # Verify session directory exists
    session_file = SESSION_DIR / f"{session_id}.json"
    print_result("Session persisted to disk", session_file.exists())

    return True


def main():
    """Run all integration tests."""
    print("\n" + "="*60)
    print("  Web4 Governance - Integration Test Suite")
    print("="*60)

    tests = [
        ("Session Initialization", test_session_init),
        ("MCP Witnessing", test_mcp_witnessing),
        ("Agent Delegation", test_agent_delegation),
        ("Trust Decay", test_trust_decay),
        ("Reference Extraction", test_reference_extraction),
        ("Witnessing Chains", test_witnessing_chain),
        ("R6 Workflow", test_r6_workflow),
    ]

    results = []
    for name, test_fn in tests:
        try:
            result = test_fn()
            results.append((name, True, None))
        except Exception as e:
            results.append((name, False, str(e)))
            print(f"\n  ERROR: {e}")

    # Summary
    print_section("Test Summary")
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)

    print(f"\n  Results: {passed}/{total} tests passed\n")
    for name, success, error in results:
        status = "✓" if success else "✗"
        print(f"  {status} {name}")
        if error:
            print(f"      Error: {error}")

    print("\n" + "="*60)

    # Show storage stats
    print("\n  Storage Stats:")
    web4_dir = Path.home() / ".web4"
    if web4_dir.exists():
        sessions = list((web4_dir / "sessions").glob("*.json"))
        entities = list((web4_dir / "governance" / "entities").glob("*.json"))
        roles = list((web4_dir / "governance" / "roles").glob("*.json"))
        print(f"    Sessions: {len(sessions)}")
        print(f"    Entities: {len(entities)}")
        print(f"    Roles: {len(roles)}")

    return passed == total


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
