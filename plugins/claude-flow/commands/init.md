---
allowed-tools: Bash(npx claude-flow init:*), Bash(npx claude-flow doctor:*), Bash(ls:*), Bash(cat:*)
description: Initialize claude-flow agent orchestration in the current project
argument-hint: Optional flags (e.g. --sparc, --force)
---

# Initialize Claude-Flow

Set up the claude-flow (RuFlo) agent orchestration system in the current project.

## Steps

1. Check if claude-flow is already initialized by looking for a `.claude-flow` directory or `claude-flow.config.json`:
   ```bash
   ls -la | grep -E '\.claude-flow|claude-flow\.config'
   ```

2. If not yet initialized, run:
   ```bash
   npx claude-flow@latest init $ARGUMENTS
   ```

3. After initialization, run a health check:
   ```bash
   npx claude-flow doctor
   ```

4. Report back:
   - What was created (config files, directories, hooks)
   - How to use the orchestration system (`/claude-flow:swarm` or `/claude-flow:hive-mind`)
   - Any warnings or recommended next steps from `doctor`

If already initialized, report current config and suggest `/claude-flow:swarm` to begin orchestrating agents.
