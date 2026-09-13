## Preflight Checklist

- [x] I have searched existing requests and this feature hasn't been requested yet
- [x] This is a single feature request (not multiple features)

## Problem Statement

Claude Code agents currently operate with **zero governance or accountability infrastructure**. Every tool call (file edits, bash commands, network requests) executes immediately without:

- **Audit trail** - No record of what the agent actually did, when, or why
- **Policy framework** - No way to gate dangerous operations before execution
- **Trust metrics** - No mechanism to track agent reliability over time
- **Provenance chain** - No cryptographic proof of action history

This creates serious problems:

**For enterprises**: Cannot deploy Claude Code in regulated environments (healthcare, finance, government) where audit trails are mandatory. No compliance story.

**For teams**: Cannot answer "what did the agent change last week?" or "why did this file get modified?" No accountability when things go wrong.

**For safety**: Destructive bash commands (`rm -rf`, `DROP TABLE`) execute without gates. No pre-action policy enforcement to prevent accidents.

**For multi-agent systems**: When multiple agents or MCP servers interact, there's no trust framework. Every interaction starts from zero trust.

The current model is "execute everything, ask questions never" - great for demos, problematic for production.

## Proposed Solution

Add an **optional governance plugin** that provides:

### R6 Audit Trail
Every tool call gets a structured record:
- **R**ules: Constraints that applied
- **R**ole: Session identity and context
- **R**equest: Tool name, category, target
- **R**eference: Chain position (hash-linked provenance)
- **R**esource: (Optional) cost/token estimates
- **R**esult: Status, output hash, duration

Records form a hash-linked chain stored in `~/.web4/audit/{session}.jsonl`, enabling:
- Post-session review ("show me all file writes from yesterday")
- Tamper detection (break one link, verify entire chain fails)
- Compliance reporting (export for auditors)

### Policy Engine (Pre-Action Gating)
Rule-based gates that evaluate **before** tool execution:
```python
policy = {
  "rules": [
    {"match": {"tools": ["Bash"]}, "decision": "warn"},
    {"match": {"targetPatterns": ["rm -rf"]}, "decision": "deny"}
  ],
  "defaultPolicy": "allow",
  "enforce": True  # or False for dry-run mode
}
```

Decisions: `allow`, `warn`, `deny`
Built-in presets: permissive, safety, strict, audit-only

### Trust Accumulation (T3 Tensors)
Track agent/MCP reliability across dimensions:
- Completeness, Consistency, Timeliness, Reliability, Relevance, Transparency

Integrates with policy: "Allow network calls only if agent reliability > 0.7"

### Implementation
- **Hook-based**: Uses existing `session_start`, `pre_tool_use`, `post_tool_use` hooks
- **Zero core changes**: Plugin lives in `plugins/web4-governance/`
- **Opt-in**: Disabled by default, enable via `.claude/settings.json`
- **SQLite storage**: `~/.web4/ledger.db` with WAL mode for concurrent sessions
- **Observational by default**: Records everything, blocks nothing (unless policy enforces)

## Alternative Solutions

**Current workarounds:**
- Manual git commits after every session (tedious, incomplete)
- Wrapper scripts that log commands (misses file operations, breaks interactivity)
- "Trust but verify" - inspect git diffs after the fact (too late if damage done)
- Don't use Claude Code in production (limits adoption)

**Why those don't work:**
- No structured format for replay/analysis
- No pre-action policy enforcement
- No cryptographic proof of integrity
- Can't answer "what would have happened?" for policy dry-runs

**Other tools:**
- Traditional audit logs (syslog, etc.) - not agent-aware, miss intent
- Git history - only captures committed changes, not attempted actions
- IDE activity logs - don't understand agent semantics

None capture **agent intent** (the "why") alongside action and result.

## Priority

**High - Significant impact on productivity**

Blocks enterprise adoption. Teams want Claude Code but can't deploy without governance story.

## Feature Category

**Configuration and settings**

Also touches: CLI commands, Hooks, Developer tools/SDK

## Use Case Example

### Scenario 1: Enterprise Compliance (Healthcare Startup)

**Context**: Medical software company wants to use Claude Code for refactoring. HIPAA requires audit trails of all data access.

**Without governance:**
- Cannot deploy - no audit trail
- Manual logging insufficient for compliance
- Forced to use other tools

**With governance:**
1. Enable web4-governance plugin with `audit-only` preset
2. Developers use Claude Code normally
3. Audit queries: `ledger.query_audit(tool="Read", targetPattern="*/patient/*")`
4. Export audit trail for compliance review
5. Demonstrate to auditors: cryptographically verified action history

**Impact**: Unlocks Claude Code for regulated industries.

### Scenario 2: Team Debugging (Open Source Project)

**Context**: Junior dev's Claude Code session went wrong - production configs overwritten.

**Without governance:**
- "I don't know what happened"
- Git shows final state, not agent's intent
- Team loses trust in AI tools

**With governance:**
1. Review audit trail: `ledger.query_audit(session_id="abc123", tool="Write")`
2. See exact sequence: agent misunderstood context, wrote staging config to prod
3. Reconstruct decision tree from R6 records
4. Update policy: `deny writes to */config/prod/* without confirmation`
5. Share learnings, improve prompts

**Impact**: Transforms failures into learning opportunities.

### Scenario 3: Multi-Agent Federation (Advanced Usage)

**Context**: Multiple Claude Code sessions + MCP servers collaborating on codebase.

**Without governance:**
- No trust metrics between agents
- Every agent starts from zero trust
- Race conditions from concurrent edits
- Can't answer "which agent changed this?"

**With governance:**
1. Each agent/MCP builds trust history (T3 tensors)
2. High-trust agents get broader permissions
3. Witnessing: agents observe each other's actions
4. Audit trails show "Agent A called MCP B, which modified file C"
5. Policy: "Only agents with consistency > 0.8 can edit core files"

**Impact**: Enables safe multi-agent systems.

## Additional Context

### Working Implementation

I've built a complete working version as a PR: **#20448**
- 75+ passing tests
- SQLite ledger with WAL mode
- Hook integration (session_start, pre_tool_use, post_tool_use)
- Policy presets, rate limiting, audit query/reporting
- PolicyEntity (policies as first-class trust participants)

Code is ready to review/merge if this aligns with Claude Code's vision.

### Why This Matters Now

AI agents are moving from demos to production. Claude Code is ahead of the curve in functionality, but **governance is the missing piece** for serious adoption.

Every other agent framework will add governance eventually. Claude Code can lead by:
1. Making it optional (doesn't slow down existing users)
2. Making it extensible (community can build policy presets)
3. Making it open (not black-box enterprise-only feature)

### Trust-Native Computing

This implements concepts from "Web4" - trust-native internet infrastructure:
- LCTs (Linked Context Tokens): Session identity
- R6 framework: Structured intent capture
- T3 tensors: Multi-dimensional trust
- Witnessing chains: Cryptographic provenance

Not asking you to adopt the "Web4" branding - just showing this is part of a larger architectural vision for AI-native trust infrastructure.

### Questions for Maintainers

1. **Interest**: Does governance/audit functionality align with Claude Code's roadmap?
2. **Scope**: Should this be core feature, official plugin, or community plugin?
3. **Approach**: Any concerns with the hook-based implementation?
4. **Naming**: "web4-governance" or something more generic like "audit-policy"?

Happy to:
- Adapt the implementation to your preferences
- Break into smaller incremental PRs
- Write documentation/examples
- Maintain as official or community plugin

### Links

- PR #20448: https://github.com/anthropics/claude-code/pull/20448
- Web4 framework: https://github.com/dp-web4/web4
- Working demo/tests in PR

---

*Note: "web4" used generically to describe trust-native, cryptographically-accountable infrastructure for the AI agent era. Not a trademark claim.*
