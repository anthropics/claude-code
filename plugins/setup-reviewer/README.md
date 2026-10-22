# Setup Reviewer

Comprehensive audit of your Claude Code configuration. Dispatches **10 parallel review agents**, each specialized in one area of your setup, then synthesizes all findings into a single report with a health score, maturity rating, and prioritized action items.

## What it reviews

| # | Agent | What it checks |
|---|-------|---------------|
| 1 | Skills Auditor | SKILL.md files, allowed-tools scoping, script references, overlaps |
| 2 | Commands Auditor | Slash command quality, MCP references, skill overlap |
| 3 | Rules Auditor | Contradictions, staleness, duplicates, secrets, context window cost |
| 4 | Plugins Auditor | Registry health, blocklist, orphaned plugins, marketplace freshness |
| 5 | MCP Servers Auditor | Connectivity, env vars, ghost servers, security |
| 6 | Settings Auditor | Permission scoping, hook wiring, env var security, JSON validity |
| 7 | CLAUDE.md Auditor | Global + project files, content placement, bloat detection |
| 8 | Terminal Auditor | Shell aliases, env vars, API key security, tool versions |
| 9 | Hooks Auditor | Wiring, orphaned scripts, automation opportunities |
| 10 | Best Practices Researcher | Web research from Anthropic docs and community guides |

A final **Synthesis Agent** cross-references all findings, benchmarks against best practices, and assigns a maturity rating.

## How it works

The skill auto-triggers when the user asks to review or audit their Claude Code setup.

1. **Phase 1**: Dispatches agents 1-10 in parallel. Each reads its own instruction file (`agents/XX_name.md`) and works autonomously.
2. **Phase 2**: Synthesis agent receives all findings and produces the final report.
3. **Phase 3**: Report is presented with quick-fix offers and follow-up recommendations.

## Report output

- **Health Score** (X/10)
- **Maturity Rating** (Beginner / Intermediate / Advanced / Power User / Elite)
- **Findings by area** with severity (Critical / Improvement / Info)
- **Best Practices Scorecard** comparing setup against official recommendations
- **Prioritized actions** grouped by effort (quick fix / moderate / strategic)

## Architecture

```
skills/review-setup/SKILL.md (orchestrator)
  |
  |-- dispatches in parallel -->
  |     agents/01_skills.md
  |     agents/02_commands.md
  |     agents/03_rules.md
  |     agents/04_plugins.md
  |     agents/05_mcp.md
  |     agents/06_settings.md
  |     agents/07_claudemd.md
  |     agents/08_terminal.md
  |     agents/09_hooks.md
  |     agents/10_best_practices.md
  |
  |-- then synthesizes -->
        agents/11_synthesis.md
```

## Customization

- **Add a review dimension**: Create `agents/12_your_area.md` following the existing pattern
- **Adjust scoring**: Edit `agents/11_synthesis.md` to change maturity criteria or severity thresholds
- **Scope the review**: Remove agent dispatches from the orchestrator to skip areas

## Contents

- **Skill:** `review-setup` — auto-invoked orchestrator that dispatches parallel audit agents
- **Agents:** 11 specialized audit agents (10 parallel reviewers + 1 synthesis)
