# Playbooks — Start Here

This monorepo is tool-agnostic and Podman-first.

Read next:
- playbooks/coding-standards.md
- playbooks/process.md
- playbooks/rules.md
- playbooks/eos-overview.md

Layout (top):
- eos/ — EOS runtime, agents, compose
- claude/ — Claude docs/examples (no binaries, no memory)
- codex/ — Codex docs/examples (no binaries, no memory)
- mcp/servers/ — shared MCP manifests
- workspaces/ — vendor-neutral working folders
- config/ — shared env & policy (no secrets)
- memory/ — read-only snapshots/indexes exported later
- scripts/ — helpers
