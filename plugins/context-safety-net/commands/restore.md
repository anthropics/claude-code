<!-- # /project:restore [name]

Restore anchor files from a specified snapshot into the active context.

## Instructions for the Agent

When the user runs `/project:restore [name]`, execute the following steps:

1. **Read the current session ID** from stdin JSON (provided by the hook system).

2. **Determine the snapshot directory**:
   - If `name` is provided: `~/.claude/context-safety-net/<session_id>/<timestamp>_<name>/`
   - If `name` is not provided: Use the most recent snapshot (auto or manual)
   - List available snapshots with `/project:list-snapshots` if user needs to see names

3. **Read `anchors.json`** from the snapshot directory:
   ```json
   {
     "version": 1,
     "anchors": [
       {"path": "src/core/config.ts", "priority": "critical", "reason": "Core configuration"},
       {"path": "src/auth/tokens.ts", "priority": "high", "reason": "Authentication logic"}
     ]
   }
   ```

4. **For each anchor path in the `anchors` array**:
   - **Use your file reading tool** to read the file at that path from the working directory
   - **Load the content into your active context window**
   - **Do NOT** write to the filesystem
   - **Do NOT** run `git checkout`, `git restore`, or any git mutation command
   - **Do NOT** create, modify, or delete any files

5. **Output confirmation** listing which anchor files were loaded into context.

## Strict Constraints

> **⚠️ DO NOT MUTATE THE FILE SYSTEM.**
> **⚠️ DO NOT RUN `git checkout`, `git restore`, `git switch`, OR ANY GIT COMMAND THAT MODIFIES FILES.**
> **⚠️ ONLY READ FILES INTO YOUR ACTIVE CONTEXT WINDOW.**

This command is for **context recovery only** — the agent reloads critical files into its working memory. The user's working directory remains unchanged.

## Example Output

```
Restored 3 anchor files from snapshot 20250115_143022_auto:
- src/core/config.ts (critical)
- src/auth/tokens.ts (high)
- src/api/routes.ts (high)
``` -->

# /project:restore [name]

Restore anchor files from a specified snapshot into the active context.

## Instructions for the Agent

When the user runs `/project:restore [name]`, execute the following steps:

1. Determine the current Claude Code session ID. You can find this in your current session environment. Use it to locate the snapshot directory at `~/.claude/context-safety-net/<session_id>/`.

2. **Determine the snapshot directory**:
   - If `name` is provided: `~/.claude/context-safety-net/<session_id>/<timestamp>_<name>/`
   - If `name` is not provided: Use the most recent snapshot (auto or manual)
   - List available snapshots with `/project:list-snapshots` if user needs to see names

3. **Read `anchors.json`** from the snapshot directory:

   ```json
   {
     "version": 1,
     "anchors": [
       {
         "path": "src/core/config.ts",
         "priority": "critical",
         "reason": "Core configuration"
       },
       {
         "path": "src/auth/tokens.ts",
         "priority": "high",
         "reason": "Authentication logic"
       }
     ]
   }
   ```

4. **For each anchor path in the `anchors` array**:
   - **Use your file reading tool** to read the file at that path from the working directory
   - **Load the content into your active context window**
   - **Do NOT** write to the filesystem
   - **Do NOT** run `git checkout`, `git restore`, or any git mutation command
   - **Do NOT** create, modify, or delete any files

5. **Output confirmation** listing which anchor files were loaded into context.

## Strict Constraints

> **⚠️ DO NOT MUTATE THE FILE SYSTEM.**
> **⚠️ DO NOT RUN `git checkout`, `git restore`, `git switch`, OR ANY GIT COMMAND THAT MODIFIES FILES.**
> **⚠️ ONLY READ FILES INTO YOUR ACTIVE CONTEXT WINDOW.**

This command is for **context recovery only** — the agent reloads critical files into its working memory. The user's working directory remains unchanged.

## Example Output

```text
Restored 3 anchor files from snapshot 20250115_143022_auto:
- src/core/config.ts (critical)
- src/auth/tokens.ts (high)
- src/api/routes.ts (high)
```

```

```
