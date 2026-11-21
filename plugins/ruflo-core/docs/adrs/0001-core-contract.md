---
id: ADR-0001
title: ruflo-core plugin contract — pinning, MCP server contract, plugin-catalog discovery, smoke as contract
status: Accepted
date: 2026-05-04
updated: 2026-05-09
authors:
  - reviewer (Claude Code)
tags: [plugin, core, mcp, foundation, smoke-test]
---

## Context

`ruflo-core` is the **foundation plugin**. Every other plugin (`ruflo-ruvector`, `ruflo-agentdb`, `ruflo-browser`, `ruflo-intelligence`, `ruflo-adr`, `ruflo-aidefence`, `ruflo-autopilot`, plus 25 others) depends on the MCP server it registers via `.mcp.json` and the orchestration patterns it documents.

Today's plugin (v0.1.0):

- `.claude-plugin/plugin.json:4` — `version: "0.1.0"`, keywords `mcp, orchestration, claude-code`
- `.mcp.json` — registers `ruflo` MCP server via `npx -y @claude-flow/cli@latest`
- `agents/` — 3 generalists (`coder`, `researcher`, `reviewer`)
- `skills/` — 3 first-run helpers (`init-project`, `ruflo-doctor`, `discover-plugins`)
- `commands/ruflo-status.md` — system status one-liner
- `README.md` — terse: "What's Included" + Configuration only

The discover-plugins skill is a substantial asset — a curated 32-plugin catalog with decision guides. That stays.

What's missing matches the cadence we've established:

1. **No plugin-level ADR.** Foundation plugin should document its own contract since 30+ plugins depend on it.
2. **No smoke test.**
3. **No Compatibility section** pinning to `@claude-flow/cli` v3.6.
4. **MCP server tool count is undocumented.** `discover-plugins` mentions "314 tools" once, but this should be a contract claim with a verification path.
5. **No cross-references** to sibling ADRs (namespace convention, 3-gate pattern, 4-step pipeline) that other plugins now reference.

## Decision

### 1. Add this ADR (Proposed)

`docs/adrs/0001-core-contract.md`. Cross-links the seven sibling ADRs.

### 2. README augmentation (no rewrite)

Append:

- **Compatibility** — pin to `@claude-flow/cli` v3.6. Note the `npx -y @claude-flow/cli@latest` invocation in `.mcp.json` is the dynamic resolver; smoke verifies the resolved version.
- **MCP server contract** — the registered `ruflo` MCP server exposes 300+ tools across families: `memory_*`, `agentdb_*`, `embeddings_*`, `ruvllm_*`, `hooks_*`, `aidefence_*`, `neural_*`, `autopilot_*`, `browser_*`, `agent_*`, `swarm_*`, `system_*`, etc. Runtime truth via `mcp tool call mcp_status`.
- **Sibling contracts** — pointer block to the seven sibling ADRs that already define namespace convention, 3-gate pattern, 4-step pipeline, etc.
- **Architecture Decisions** + **Verification** sections.

### 3. Plugin metadata bump

`0.1.0 → 0.2.0`. Keywords add `foundation`, `mcp-server`, `plugin-catalog`, `discovery`.

### 4. Smoke contract (`scripts/smoke.sh`)

10 checks:

1. plugin.json declares `0.2.0` with the new keywords.
2. `.mcp.json` exists and registers a `ruflo` MCP server.
3. All 3 agents present (`coder`, `researcher`, `reviewer`) with valid frontmatter.
4. All 3 skills present (`init-project`, `ruflo-doctor`, `discover-plugins`) with valid frontmatter.
5. `discover-plugins` skill catalog references at least 25 sibling plugins (the curated catalog).
6. README pins to `@claude-flow/cli` v3.6.
7. README cross-references sibling contracts (namespace convention, 3-gate pattern, 4-step pipeline).
8. ADR-0001 exists with status `Proposed`.
9. `commands/ruflo-status.md` invokes `doctor` and `status`.
10. No skill grants wildcard tool access.

## Consequences

**Positive:**
- Foundation plugin is now contractually self-documenting.
- Sibling-ADR cross-references make the cohesive plugin family discoverable from the entry point.
- Plugin catalog claims are now smoke-verifiable.

**Negative:**
- `discover-plugins` catalog must be kept in sync as plugins are added. Today there are 33 plugins (including this one); the catalog covers ~32. Drift remediation is a separate, mechanical task.

**Neutral:**
- No new MCP tools, no new skills, no new agents. Documentation + smoke only.

## Verification

```bash
bash plugins/ruflo-core/scripts/smoke.sh
# Expected: "10 passed, 0 failed"
```

## Related

- `plugins/ruflo-ruvector/docs/adrs/0001-pin-ruvector-0.2.25.md`
- `plugins/ruflo-agentdb/docs/adrs/0001-agentdb-optimization.md` — namespace convention
- `plugins/ruflo-browser/docs/adrs/0001-browser-skills-architecture.md`
- `plugins/ruflo-intelligence/docs/adrs/0001-intelligence-surface-completeness.md` — 4-step pipeline
- `plugins/ruflo-adr/docs/adrs/0001-adr-plugin-pattern.md`
- `plugins/ruflo-aidefence/docs/adrs/0001-aidefence-contract.md` — 3-gate pattern
- `plugins/ruflo-autopilot/docs/adrs/0001-autopilot-contract.md` — 270s cache-aware /loop
- `v3/@claude-flow/cli/` — the MCP server source backing this plugin

## Implementation status

Plugin version v0.2.1 shipped and listed in marketplace.json. Source exists at `plugins/ruflo-core/`. Contract elements implemented: `.mcp.json` registers `ruflo` server via `npx -y @claude-flow/cli@latest`; plugin-catalog discovery skill present; 3 generalist agents shipped; smoke-as-contract gate defined in `scripts/smoke.sh`.
