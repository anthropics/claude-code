---
description: Clean up tmux panes for Agent Teams teammates
argument-hint: "[team-name | --all | --orphans]"
allowed-tools: Bash(bash *)
---

# Cleanup Team Panes

Clean up tmux panes left behind by Agent Teams teammates.

## Usage

- `/agent-teams-pipeline:cleanup-team-panes [team-name]` — Clean panes for a specific team
- `/agent-teams-pipeline:cleanup-team-panes --all` — Clean all team panes
- `/agent-teams-pipeline:cleanup-team-panes --orphans` — Find and kill orphaned agent processes

## Implementation

Run the cleanup script:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-team-panes.sh $ARGUMENTS
```

If no argument is provided, the script runs in interactive mode showing available teams and orphan status.

Report the output to the user. Do not use any other tools or do anything else.
