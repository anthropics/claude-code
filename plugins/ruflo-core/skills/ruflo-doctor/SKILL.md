---
name: ruflo-doctor
description: Run health checks on the Ruflo installation and fix common issues
argument-hint: "[--fix]"
allowed-tools: Bash(npx *)
---
Run `npx @claude-flow/cli@latest doctor --fix` to diagnose and auto-repair common issues.

Checks: Node.js 20+, npm 9+, git, config validity, daemon status, memory database, API keys, MCP servers, disk space, TypeScript.

Targeted fixes:
- Memory: `npx @claude-flow/cli@latest memory init --force`
- Daemon: `npx @claude-flow/cli@latest daemon start`
- Config: `npx @claude-flow/cli@latest config reset`
