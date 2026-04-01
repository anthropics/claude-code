---
description: Run a quick regression check against golden baselines
allowed-tools: mcp__evalview__run_check, mcp__evalview__generate_visual_report, Bash, Read
---

Run EvalView regression checks on the current project.

1. Look for existing test configurations in the project (`.evalview/`, `tests/eval/`, or `evalview.yaml`)
2. If found, use the `run_check` MCP tool to execute regression tests against golden baselines
3. If no config exists, suggest running `/evalview:eval-init` first
4. Report results clearly: which tests passed, which regressed, and what specifically changed
5. If there are regressions, explain the behavioral diff (tool calls changed, parameters shifted, output diverged)
