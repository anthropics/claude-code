#!/usr/bin/env python3
"""Test the full agent governance flow through hooks."""

import json
import sys
import uuid
from pathlib import Path

# Add paths
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "hooks"))

from governance import AgentGovernance, RoleTrustStore, ReferenceStore


def test_agent_flow():
    """Simulate the full agent lifecycle."""
    print("=" * 60)
    print("Testing Agent Governance Flow")
    print("=" * 60)

    session_id = f"test-{uuid.uuid4().hex[:8]}"
    agent_name = "code-reviewer"

    gov = AgentGovernance()
    trust_store = RoleTrustStore()
    ref_store = ReferenceStore()

    # 1. Get initial trust
    initial_trust = trust_store.get(agent_name)
    print(f"\n1. Initial trust for '{agent_name}':")
    print(f"   T3 average: {initial_trust.t3_average():.3f}")
    print(f"   Trust level: {initial_trust.trust_level()}")
    print(f"   Action count: {initial_trust.action_count}")

    # 2. Simulate agent spawn (like pre_tool_use with Task)
    print(f"\n2. Agent spawn (session: {session_id}):")
    spawn_ctx = gov.on_agent_spawn(session_id, agent_name)
    print(f"   Trust loaded: T3={spawn_ctx['trust']['t3_average']:.3f}")
    print(f"   References loaded: {spawn_ctx['references_loaded']}")
    print(f"   Capabilities: write={spawn_ctx['capabilities']['can_write']}, execute={spawn_ctx['capabilities']['can_execute']}")

    # 3. Add a reference (simulate agent learning something)
    print(f"\n3. Extract reference:")
    ref = ref_store.add(
        agent_name,
        "Pattern: Always validate input before processing",
        "code review of auth.py",
        "pattern",
        confidence=0.8
    )
    print(f"   Added: {ref.ref_id}")
    print(f"   Content: {ref.content[:50]}...")

    # 4. Simulate agent completion (success)
    print(f"\n4. Agent complete (success):")
    result = gov.on_agent_complete(session_id, agent_name, success=True)
    print(f"   Trust updated: T3={result['trust_updated']['t3_average']:.3f}")
    print(f"   Reliability: {result['trust_updated']['reliability']:.3f}")

    # 5. Check updated trust
    updated_trust = trust_store.get(agent_name)
    print(f"\n5. Updated trust:")
    print(f"   T3 average: {updated_trust.t3_average():.3f} (was {initial_trust.t3_average():.3f})")
    print(f"   Action count: {updated_trust.action_count}")
    print(f"   Success rate: {updated_trust.success_count}/{updated_trust.action_count}")

    # 6. Spawn again - should have more references now
    print(f"\n6. Second spawn (same agent):")
    spawn_ctx2 = gov.on_agent_spawn(session_id + "-2", agent_name)
    print(f"   References now: {spawn_ctx2['references_loaded']}")
    print(f"   Context preview: {spawn_ctx2['context'][:100]}..." if spawn_ctx2['context'] else "   (no context)")

    # 7. Simulate failure
    print(f"\n7. Agent complete (failure):")
    result_fail = gov.on_agent_complete(session_id + "-2", agent_name, success=False)
    print(f"   Trust after failure: T3={result_fail['trust_updated']['t3_average']:.3f}")

    # 8. Check capabilities changed
    final_caps = trust_store.derive_capabilities(agent_name)
    print(f"\n8. Final capabilities:")
    print(f"   Trust level: {final_caps['trust_level']}")
    print(f"   Can write: {final_caps['can_write']}")
    print(f"   Can delegate: {final_caps['can_delegate']}")
    print(f"   Max ATP/action: {final_caps['max_atp_per_action']}")

    # 9. List all roles
    print(f"\n9. All known roles:")
    all_roles = gov.get_all_roles()
    for role in all_roles[:5]:
        print(f"   {role['role_id']}: T3={role['t3_average']:.2f} ({role['action_count']} actions)")

    print("\n" + "=" * 60)
    print("Agent governance flow test complete!")
    print("=" * 60)


if __name__ == "__main__":
    test_agent_flow()
