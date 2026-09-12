---
allowed-tools: Bash(npx claude-flow swarm:*), Bash(npx claude-flow task:*), Bash(npx claude-flow status:*)
description: Launch a coordinated swarm of AI agents to complete a task
argument-hint: Task description for the swarm (required)
---

# Claude-Flow Swarm

Launch a coordinated swarm of specialized AI agents to tackle a complex task using claude-flow's orchestration system.

## Usage

```
/claude-flow:swarm <task description>
```

**Example:**
```
/claude-flow:swarm Refactor the authentication module to use JWT tokens and add refresh token support
```

## Steps

1. **Validate input**: If no task description is provided in `$ARGUMENTS`, ask the user to describe what they want the swarm to accomplish.

2. **Check initialization**: Verify claude-flow is initialized:
   ```bash
   npx claude-flow status 2>&1
   ```
   If not initialized, tell the user to run `/claude-flow:init` first.

3. **Launch the swarm**:
   ```bash
   npx claude-flow swarm "$ARGUMENTS" --monitor
   ```

4. **Monitor progress**: Stream agent activity and report:
   - Which agents are active and what each is working on
   - Task completion status
   - Any errors or blockers encountered

5. **Summarize results**: When the swarm completes, report:
   - What was accomplished
   - Files changed
   - Any follow-up actions recommended

## Tips

- Be specific in your task description for best results
- For architectural decisions requiring consensus, use `/claude-flow:hive-mind` instead
- The swarm automatically decomposes tasks and assigns specialized agents
