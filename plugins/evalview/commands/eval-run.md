---
description: Run full evaluation suite with detailed analysis
allowed-tools: mcp__evalview__run_check, mcp__evalview__run_snapshot, mcp__evalview__generate_visual_report, mcp__evalview__create_test, Bash, Read
---

Run a comprehensive EvalView evaluation workflow.

1. Run all regression tests using `run_check`
2. Generate a visual HTML report using `generate_visual_report`
3. Analyze results and provide a summary:
   - Total tests, passed, failed, regressions
   - For each regression: what changed at the behavioral level (tool calls, parameters, output)
   - Cost and latency comparison if available
4. If tests pass, suggest updating snapshots if the user made intentional changes
5. If tests fail, help diagnose the root cause and suggest fixes
