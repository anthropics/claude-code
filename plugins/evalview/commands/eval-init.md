---
description: Initialize EvalView regression testing for this project
allowed-tools: Bash, Read, Write
---

Set up EvalView regression testing for the current project.

1. Check if `evalview` is installed (`pip show evalview`). If not, install it: `pip install evalview`
2. Run `evalview init` to create the default configuration
3. Help the user create their first test case based on their agent setup
4. Run `evalview snapshot` to capture the initial golden baseline
5. Explain the workflow: make changes → run `evalview check` → review diffs → update baselines
