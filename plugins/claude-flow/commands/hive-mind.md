---
allowed-tools: Bash(npx claude-flow hive-mind:*), Bash(npx claude-flow status:*)
description: Spawn a hive-mind queen-led consensus system for complex decisions and architecture
argument-hint: Problem or question for the hive-mind (required)
---

# Claude-Flow Hive-Mind

Spawn a queen-led, consensus-based multi-agent coordination system for complex problems that benefit from multiple perspectives and structured deliberation.

## Usage

```
/claude-flow:hive-mind <problem or question>
```

**Examples:**
```
/claude-flow:hive-mind Design the database schema for a multi-tenant SaaS application
/claude-flow:hive-mind Should we use REST or GraphQL for the new API layer?
/claude-flow:hive-mind Review the security posture of the authentication flow
```

## When to Use Hive-Mind vs Swarm

| Hive-Mind | Swarm |
|-----------|-------|
| Architectural decisions | Implementation tasks |
| Design trade-off analysis | Code refactoring |
| Security/risk assessment | Feature development |
| Consensus on approach | Executing a known plan |

## Steps

1. **Validate input**: If no problem is provided in `$ARGUMENTS`, ask the user what decision or question they want the hive-mind to deliberate on.

2. **Check initialization**:
   ```bash
   npx claude-flow status 2>&1
   ```
   If not initialized, tell the user to run `/claude-flow:init` first.

3. **Spawn the hive-mind**:
   ```bash
   npx claude-flow hive-mind spawn "$ARGUMENTS" --queen-type=adaptive
   ```

4. **Report deliberation**: Present the hive-mind's consensus output including:
   - The recommendation or decision reached
   - Key arguments for and against each option considered
   - Confidence level of the consensus
   - Dissenting views (if any agents disagreed)

5. **Suggest next steps**: Based on the consensus, recommend concrete actions the user can take (e.g., run `/claude-flow:swarm` to implement the agreed-upon approach).
