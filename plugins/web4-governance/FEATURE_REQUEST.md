# Feature Request: Agent Governance via Hooks

## The Problem

Agents execute tools, modify files, run commands — no standardized way to:
1. Know what happened
2. Prove the log wasn't tampered with
3. Block actions before they execute

Current options: platform-locked (AWS), theory-heavy (academic), or lack agent semantics (enterprise audit).

## Proposed Solution

Governance plugin using existing `pre_tool_use` / `post_tool_use` hooks.

**Capabilities:**
- Audit trail with structured records
- Hash-linked chain (tamper-evident)
- Pre-action gating: allow/deny/warn
- Policy presets: permissive, safety, strict, audit-only

## Implementation

Working code: [PR #20448](https://github.com/anthropics/claude-code/pull/20448)

Already running in [Moltbot](https://github.com/dp-web4/moltbot/tree/main/extensions/web4-governance) — same framework, different runtime. Proves portability.

## Scope Boundaries

- **IS**: Inspectable, accountable, governable
- **IS NOT**: "Safe" or "correct"
- **IS**: Bounded by what hooks expose
- **IS NOT**: Complete coverage of all behaviors

Trust metrics are operational heuristics for permissioning — not alignment signals.

## Why Now

Agents are acting autonomously at scale. The governance gap is no longer theoretical.

---

**Whitepaper**: https://dp-web4.github.io/web4/
