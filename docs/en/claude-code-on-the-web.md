# Claude Code on the Web

## Background Tasks

When running tasks in the background, you can monitor them through the Background Task Panel. 

> **Note:** The same task set you see here is visible through the [Remote Control](remote-control.md) background-task panel, and perfectly mirrors the output of the local `/tasks` command. See the [Remote Control Background Task Panel](remote-control.md#web-and-mobile-background-task-panel) documentation for more details on status synchronization and troubleshooting.

## Skill Resolution

When working across different Claude runtimes, it is important to understand how Skills are resolved:

* **Claude Code CLI** resolves Skills from the local `~/.claude/skills` directory.
* **Cowork** resolves Skills from the Claude.ai deployment mount rather than the local `~/.claude/skills` directory.
* **Scheduled Cowork tasks** use the same deployed Skill set as Cowork.

> **Note:** A Skill available only in the local `~/.claude/skills` directory may work in the CLI but fail in Cowork or scheduled tasks unless it is deployed to Claude.ai.
