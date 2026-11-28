#!/usr/bin/env python3
"""Test the entity trust and witnessing system."""

import json
import sys
import uuid
from pathlib import Path

# Add paths
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent / "governance"))

from governance import (
    EntityTrust, EntityTrustStore,
    get_mcp_trust, update_mcp_trust,
    ReferenceStore, AgentGovernance
)


def test_entity_trust():
    """Test entity trust accumulation and witnessing."""
    print("=" * 60)
    print("Testing Entity Trust & Witnessing")
    print("=" * 60)

    store = EntityTrustStore()

    # 1. Create MCP server entities
    print("\n1. MCP Server Trust:")
    mcp_names = ["filesystem", "web4", "database"]
    for name in mcp_names:
        trust = store.get(f"mcp:{name}")
        print(f"   mcp:{name}: T3={trust.t3_average():.3f}")

    # 2. Session witnesses MCP calls
    print("\n2. Session witnesses MCP calls:")
    session_id = f"session:test-{uuid.uuid4().hex[:8]}"

    # Successful calls
    for _ in range(3):
        witness, target = store.witness(session_id, "mcp:filesystem", True, 0.1)
    print(f"   mcp:filesystem after 3 successes: T3={target.t3_average():.3f}")

    # One failure
    witness, target = store.witness(session_id, "mcp:filesystem", False, 0.1)
    print(f"   mcp:filesystem after 1 failure: T3={target.t3_average():.3f}")

    # 3. Check witnessing relationships
    print("\n3. Witnessing relationships:")
    fs_trust = store.get("mcp:filesystem")
    print(f"   mcp:filesystem witnessed by: {fs_trust.witnessed_by[:3]}")

    session_trust = store.get(session_id)
    print(f"   {session_id} has witnessed: {session_trust.has_witnessed[:3]}")

    # 4. Get witnessing chain
    print("\n4. Witnessing chain:")
    chain = store.get_witnessing_chain("mcp:filesystem", depth=2)
    print(f"   mcp:filesystem chain:")
    print(f"     T3: {chain['t3_average']:.3f}")
    print(f"     Witnessed by: {len(chain['witnessed_by'])} entities")
    print(f"     Has witnessed: {len(chain['has_witnessed'])} entities")

    # 5. List entities by type
    print("\n5. Entity listing:")
    mcp_entities = store.list_entities("mcp")
    print(f"   MCP servers: {mcp_entities}")

    session_entities = store.list_entities("session")
    print(f"   Sessions: {len(session_entities)} total")

    # 6. Convenience function
    print("\n6. update_mcp_trust convenience:")
    updated = update_mcp_trust("web4", success=True, witness_id=session_id)
    print(f"   mcp:web4 after success: T3={updated.t3_average():.3f}")

    print("\n" + "=" * 60)
    print("Entity trust test complete!")
    print("=" * 60)


def test_reference_self_curation():
    """Test reference trust and self-curation."""
    print("\n" + "=" * 60)
    print("Testing Reference Self-Curation")
    print("=" * 60)

    refs = ReferenceStore()
    role_id = f"test-curator-{uuid.uuid4().hex[:6]}"

    # 1. Add references with varying initial confidence
    print("\n1. Adding references:")
    patterns = [
        ("Always validate input", 0.8),
        ("Check null before access", 0.6),
        ("Use async for IO", 0.4),
        ("This might not work", 0.2),
    ]

    ref_ids = []
    for content, confidence in patterns:
        ref = refs.add(role_id, content, "test", "pattern", confidence)
        ref_ids.append(ref.ref_id)
        print(f"   {content[:25]}... conf={confidence} trust={ref.trust_score:.2f}")

    # 2. Get context (uses refs, tracks them)
    print("\n2. Getting context (marks refs as used):")
    context, used_ids = refs.get_context_for_role(role_id, min_trust=0.15)
    print(f"   Refs included: {len(used_ids)}")

    # Check which refs were excluded due to low trust
    all_refs = refs.get_for_role(role_id)
    excluded = [r for r in all_refs if r.ref_id not in used_ids]
    print(f"   Refs excluded (low trust): {len(excluded)}")

    # 3. Simulate successful task - witness refs
    print("\n3. Task succeeds - witnessing refs:")
    updated = refs.witness_references(role_id, used_ids, success=True, magnitude=0.2)
    for r in updated:
        print(f"   {r.content[:25]}... trust={r.trust_score:.3f} ({r.trust_level()})")

    # 4. Simulate failed task
    print("\n4. Task fails - witnessing refs:")
    # Re-get context to mark as used
    _, used_again = refs.get_context_for_role(role_id, min_trust=0.15)
    updated = refs.witness_references(role_id, used_again, success=False, magnitude=0.2)
    for r in updated:
        print(f"   {r.content[:25]}... trust={r.trust_score:.3f} ({r.trust_level()})")

    # 5. Check self-curation effect
    print("\n5. Self-curation effect after mixed outcomes:")
    all_refs = refs.get_for_role(role_id)
    for r in all_refs:
        print(f"   {r.content[:25]}... trust={r.trust_score:.3f} success={r.success_count} fail={r.failure_count}")

    print("\n" + "=" * 60)
    print("Reference self-curation test complete!")
    print("=" * 60)


def test_agent_reference_witnessing():
    """Test end-to-end agent + reference witnessing."""
    print("\n" + "=" * 60)
    print("Testing Agent + Reference Integration")
    print("=" * 60)

    gov = AgentGovernance()
    session_id = f"integration-{uuid.uuid4().hex[:8]}"
    role_id = "test-integrator"

    # 1. Add some references
    print("\n1. Adding references for role:")
    gov.extract_reference(session_id, role_id, "Pattern: test first", "tests.py", "pattern")
    gov.extract_reference(session_id, role_id, "Fact: API uses REST", "docs.md", "fact")
    print("   Added 2 references")

    # 2. Spawn agent (loads refs, tracks for witnessing)
    print("\n2. Agent spawn:")
    spawn_ctx = gov.on_agent_spawn(session_id, role_id)
    print(f"   Trust: T3={spawn_ctx['trust']['t3_average']:.3f}")
    print(f"   Refs used: {spawn_ctx.get('references_used', 0)}")

    # 3. Complete successfully
    print("\n3. Agent complete (success):")
    result = gov.on_agent_complete(session_id, role_id, success=True)
    print(f"   Trust updated: T3={result['trust_updated']['t3_average']:.3f}")
    print(f"   Refs witnessed: {result.get('references_witnessed', 0)}")

    # 4. Spawn again - refs should have higher trust
    print("\n4. Second spawn (refs have evolved):")
    spawn_ctx2 = gov.on_agent_spawn(session_id + "-2", role_id)
    print(f"   Refs loaded: {spawn_ctx2['references_loaded']}")

    # Check ref trust levels
    refs = gov.references.get_for_role(role_id)
    for r in refs:
        print(f"   {r.ref_type}: {r.content[:30]}... trust={r.effective_trust():.3f}")

    print("\n" + "=" * 60)
    print("Agent + Reference integration test complete!")
    print("=" * 60)


if __name__ == "__main__":
    test_entity_trust()
    test_reference_self_curation()
    test_agent_reference_witnessing()

    print("\n" + "=" * 60)
    print("ALL ENTITY TRUST TESTS PASSED!")
    print("=" * 60)
