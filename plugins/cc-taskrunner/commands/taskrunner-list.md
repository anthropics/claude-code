---
description: Show the current task queue
argument-hint: ""
allowed-tools: ["Bash", "Read"]
---

# cc-taskrunner — List Queue

Show all tasks in the queue with their status.

## Steps

1. Run the list command:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/taskrunner.sh list
   ```

2. If the queue file doesn't exist or is empty, tell the user and suggest `/taskrunner-add`.

3. Present the results. Status symbols:
   - `○` pending — waiting to run
   - `▶` running — currently executing
   - `✓` completed — finished successfully
   - `✗` failed — task errored or was blocked

4. If there are pending tasks, suggest `/taskrunner` to execute them.
