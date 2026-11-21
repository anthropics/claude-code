# PR Description: Agent Governance Plugin

## The Problem

No way to answer "what did the agent do and why?"

- No audit trail
- No pre-execution policy gates
- No tamper-evident provenance

## The Solution

Hook-based governance using `pre_tool_use` / `post_tool_use`. Zero core changes.

**What you get:**
- Searchable audit trail (R6 structured records)
- Hash-linked chain (tamper-evident)
- Policy engine: allow/deny/warn before execution
- Presets: permissive, safety, strict, audit-only

**Key files:**
- `hooks/pre_tool_use.py` — policy check, log intent
- `hooks/post_tool_use.py` — log result, extend chain
- `governance/` — ledger, policy, rate limiting

## Scope

This makes agents **inspectable, accountable, governable** — not "safe" or "correct." We can only govern what hooks expose. Honest constraint.

## Evidence

- 75+ tests passing
- Same framework running in [Moltbot](https://github.com/dp-web4/moltbot/tree/main/extensions/web4-governance)
- Opt-in, observational by default

## Background

Implements concepts from [Web4](https://dp-web4.github.io/web4/) — R6 workflow formalism, T3 trust tensors (operational heuristics for permissioning, not alignment claims).

---

Happy to address questions.
