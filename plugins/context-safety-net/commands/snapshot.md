<!-- # /project:snapshot [name]

Create a manual context snapshot of the current repository state.

## Instructions for the Agent

When the user runs `/project:snapshot [name]`, execute the following steps:

1. **Read the current session ID** from stdin JSON (provided by the hook system).

2. **Execute READ-ONLY git capture logic** (identical to the pre-compact hook):
   ```bash
   git diff > working.diff
   git ls-files > tracked-files.txt
   git rev-parse HEAD > commit.txt
   ```
   - Do NOT use `git stash` or any command that mutates the repository.
   - Capture the output to variables or temporary files.

3. **Determine the snapshot directory**:
   ```
   ~/.claude/context-safety-net/<current_session_id>/<timestamp>_<name>/
   ```
   - `<timestamp>`: Current timestamp in format `YYYYMMDD_HHMMSS`
   - `<name>`: The user-provided name (or "manual" if not provided)
   - Create the directory with `mkdir -p`

4. **Save the captured git state** to the snapshot directory:
   - `working.diff` — output of `git diff`
   - `tracked-files.txt` — output of `git ls-files`
   - `commit.txt` — output of `git rev-parse HEAD`

5. **Copy `.claude/context-anchors.json`** to `anchors.json` in the snapshot directory if it exists.

6. **Create `metadata.json`** in the snapshot directory:
   ```json
   {
     "timestamp": "<current_ISO8601_timestamp>",
     "git_commit": "<commit_hash_from_commit.txt>",
     "type": "manual",
     "name": "<user_provided_name>"
   }
   ```

## Important Constraints

- **DO NOT** use `git stash`, `git commit`, `git reset`, or any command that mutates the repository.
- **DO NOT** modify any files in the working directory.
- This is a READ-ONLY capture operation only.
- If not in a git repository, exit gracefully without creating a snapshot. -->

# /project:snapshot [name]

Create a manual context snapshot of the current repository state.

## Instructions for the Agent

When the user runs `/project:snapshot [name]`, execute the following steps:

1. Determine the current Claude Code session ID. You can find this in your current session environment. Use it to locate the snapshot directory at `~/.claude/context-safety-net/<session_id>/`.

2. **Execute READ-ONLY git capture logic** (identical to the pre-compact hook):

   ```bash
   git diff > working.diff
   git ls-files > tracked-files.txt
   git rev-parse HEAD > commit.txt
   ```

   - Do NOT use `git stash` or any command that mutates the repository.
   - Capture the output to variables or temporary files.

3. **Determine the snapshot directory**:

   ```
   ~/.claude/context-safety-net/<current_session_id>/<timestamp>_<name>/
   ```

   - `<timestamp>`: Current timestamp in format `YYYYMMDD_HHMMSS`
   - `<name>`: The user-provided name (or "manual" if not provided)
   - Create the directory with `mkdir -p`

4. **Save the captured git state** to the snapshot directory:
   - `working.diff` — output of `git diff`
   - `tracked-files.txt` — output of `git ls-files`
   - `commit.txt` — output of `git rev-parse HEAD`

5. **Copy `.claude/context-anchors.json`** to `anchors.json` in the snapshot directory if it exists.

6. **Create `metadata.json`** in the snapshot directory:
   ```json
   {
     "timestamp": "<current_ISO8601_timestamp>",
     "git_commit": "<commit_hash_from_commit.txt>",
     "type": "manual",
     "name": "<user_provided_name>"
   }
   ```

## Important Constraints

- **DO NOT** use `git stash`, `git commit`, `git reset`, or any command that mutates the repository.
- **DO NOT** modify any files in the working directory.
- This is a READ-ONLY capture operation only.
- If not in a git repository, exit gracefully without creating a snapshot.

```

```
