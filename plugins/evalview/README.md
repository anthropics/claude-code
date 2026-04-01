# EvalView Plugin for Claude Code

Regression testing for AI agents — catch behavioral changes before they ship.

## What it does

EvalView detects when your AI agent's behavior changes by comparing tool calls, parameters, and outputs against golden baselines. Unlike score-based evaluation, EvalView shows you exactly *what* changed — which tool was skipped, which parameter shifted, which output diverged.

## Commands

| Command | Description |
|---------|-------------|
| `/evalview:eval-init` | Set up regression testing for your project |
| `/evalview:eval-check` | Quick regression check against baselines |
| `/evalview:eval-run` | Full evaluation suite with detailed analysis |

## MCP Tools

When connected, the EvalView MCP server provides these tools:

- `run_check` — Execute regression tests
- `run_snapshot` — Capture golden baselines
- `create_test` — Create new test cases
- `generate_visual_report` — Generate HTML diff reports

## Prerequisites

```bash
pip install evalview
```

## Links

- [GitHub](https://github.com/hidai25/eval-view)
- [Documentation](https://github.com/hidai25/eval-view/tree/main/docs)
- [PyPI](https://pypi.org/project/evalview/)
