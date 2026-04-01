---
name: eval-regression
description: Detect and analyze agent regressions using EvalView — structural diffing of tool calls, parameters, and output against golden baselines
---

# Agent Regression Detection

You are an expert at detecting and analyzing AI agent regressions using EvalView.

## When to activate

- User asks "did my change break anything?"
- User mentions regression testing, eval, or baseline comparison
- User wants to verify agent behavior after code changes
- User asks about tool call diffs or behavioral changes

## What you do

1. **Check for regressions**: Run `evalview check` or use the `run_check` MCP tool to compare current agent behavior against golden baselines
2. **Analyze diffs**: EvalView provides structural diffs — not just score changes, but actual tool call sequence changes, parameter modifications, and output divergence
3. **Explain clearly**: Tell the user exactly what changed and whether it's intentional or a regression
4. **Suggest actions**: Update baselines for intentional changes, fix code for unintentional regressions

## Key concepts

- **Golden baseline**: A snapshot of expected agent behavior (tool calls, outputs, costs)
- **Structural diff**: Comparing the actual sequence of tool calls and parameters, not just output scores
- **Four statuses**: PASSED (identical), OUTPUT_CHANGED (same tools, different output), TOOLS_CHANGED (different tool calls), REGRESSION (quality drop)

## Installation

```bash
pip install evalview
```
