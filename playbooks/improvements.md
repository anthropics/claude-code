# Improvements Backlog

This document collects small, incremental ideas to improve our developer and agent experience. Each item should be low-risk, reversible, and align with our shared dev root + single .env model.

## 2025-08-21 — MCP enhancements and orchestrator integration (proposal)
- Reference: playbooks/mcp-eos-orchestrator-proposal.md
- Summary:
  - Enrich MCP manifests with metadata, argument schemas, and examples
  - Add convenience tools (codex-exec, claude-print) and a masked readiness check (mcp-health)
  - Keep secrets out of manifests; rely on config/env → .env
  - Prepare for an EOS orchestrator agent using OFTX to coordinate tools without changing native behavior
- Next:
  - Review with EOS expert and decide which items to implement first
  - Validate from VS Code MCP discovery after adding/adjusting manifests

## How to add new ideas
- Append a dated section with:
  - Title and brief context
  - Links to related files or proposals
  - Why it helps (user/agent value)
  - Risks and how it stays low-risk
  - Acceptance criteria (what does “done” look like?)

