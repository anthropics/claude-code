# MCP Manifests

This directory contains Machine Control Protocol (MCP) manifests.

Guidance
- Prefer MCP for GitHub operations per WARP.md.
- Tokens/secrets are not stored in manifests; they are provided via the unified repo env (config/env → .env).
- Clients discover tools by reading these JSON manifests.

Included
- codex-cli.tool.json — exposes `scripts/codex-safe` as a command tool for MCP-aware clients.

Client notes
- If your MCP client expects a different schema or location, add/adjust a manifest here that points to the same wrapper scripts under scripts/.

