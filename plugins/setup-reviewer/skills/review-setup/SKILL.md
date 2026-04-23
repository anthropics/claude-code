---
name: review-setup
description: Comprehensive review and audit of a user's Claude Code setup — skills, commands, rules, plugins, MCP servers, settings, hooks, terminal config, and CLAUDE.md files. Identifies gaps, redundancies, errors, and improvement opportunities.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - TaskCreate
  - TaskUpdate
  - WebFetch
  - WebSearch
---

# Claude Code Setup Reviewer

Comprehensive audit of a Claude Code installation. Dispatches 10 parallel review agents, each with detailed instructions in `agents/`, then synthesizes findings into a scored report.

## Execution Flow

### Phase 1 — Parallel Audit (agents 1-10)

Dispatch ALL of the following agents simultaneously using the Agent tool. Each agent's full instructions are in the corresponding file under `${CLAUDE_PLUGIN_ROOT}/agents/`. Read the file and pass its contents as the agent prompt.

| # | Agent | Instruction File | What It Reviews |
|---|-------|-----------------|-----------------|
| 1 | Skills Auditor | `agents/01_skills.md` | Skills directory, SKILL.md files, referenced scripts |
| 2 | Commands Auditor | `agents/02_commands.md` | Command files, overlap with skills |
| 3 | Rules Auditor | `agents/03_rules.md` | Rule files, contradictions, staleness |
| 4 | Plugins Auditor | `agents/04_plugins.md` | Plugin registry, blocklist, marketplace config |
| 5 | MCP Servers Auditor | `agents/05_mcp.md` | MCP config, connectivity, env vars |
| 6 | Settings Auditor | `agents/06_settings.md` | Permissions, hooks config, env vars, JSON validity |
| 7 | CLAUDE.md Auditor | `agents/07_claudemd.md` | Global + project CLAUDE.md files |
| 8 | Terminal Auditor | `agents/08_terminal.md` | Shell config, aliases, env vars, security |
| 9 | Hooks Auditor | `agents/09_hooks.md` | Hook scripts, wiring, coverage gaps |
| 10 | Best Practices Researcher | `agents/10_best_practices.md` | Web research: Anthropic docs, community guides |

**Launch pattern:**

For each agent, send a prompt like:

> Read your instruction file at `${CLAUDE_PLUGIN_ROOT}/agents/XX_name.md` and follow it exactly. That file is your guidebook — it tells you what to inspect, what checks to run, and how to format your findings. Return your findings report when done.

Do NOT read the agent files yourself. Each agent reads its own guidebook and works autonomously.

Launch all 10 in a single message for maximum parallelism.

### Phase 2 — Synthesis

Once all 10 agents have returned, launch one final agent with this prompt:

> Read your instruction file at `${CLAUDE_PLUGIN_ROOT}/agents/11_synthesis.md` and follow it exactly. Below are the findings from 10 parallel audit agents. Synthesize them into the final report format described in your guidebook.
>
> [paste all 10 agents' findings here]

This agent produces the final report.

### Phase 3 — Present & Act

1. Present the synthesized report to the user
2. Offer to apply quick fixes immediately
3. For larger improvements, suggest the user create reminders or tasks for follow-up
4. If the user has an `/update-rules` skill, suggest running it to persist any learnings

## Finding Severity Levels

Agents should categorize every finding as one of:
- **Critical:** Broken functionality, security risk, or missing essential config
- **Improvement:** Working but suboptimal — clear benefit to fixing
- **Info:** Observation, nice-to-have, or cosmetic
