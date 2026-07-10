# Remote Control

## Web and Mobile Background Task Panel

When using Remote Control from the web or mobile app, you have access to a Background Task Panel. This panel displays the live background tasks for your active session. 

### Status Synchronization
As of version 2.1.205, the Background Task Panel recomputes the full task set whenever membership changes. This means that whenever a task starts, completes, fails, stops, or is backgrounded, the panel will update its status. This prevents tasks from showing a stale "Running" status when they have already finished or failed.

### Local `/tasks` Command vs Background Task Panel
The Background Task Panel shows the exact same task set as the local `/tasks` command running in your terminal. They are fully synchronized, so whether you check your tasks in your local CLI or via the Remote Control panel, you will see identical information.

## Troubleshooting

### Task stuck in "Running" status
If a background task appears to be stuck on "Running" indefinitely in the panel:
1. Ensure your local Claude Code terminal is still running and connected to the internet. If the CLI session disconnected, the panel might temporarily lose track of the task's final state.
2. Check the local `/tasks` command. If the task has completed locally but not in the panel, try refreshing your Remote Control interface.
3. If the task is still running locally as well, it might be hanging on a long-running command. You can interrupt it from the CLI.
