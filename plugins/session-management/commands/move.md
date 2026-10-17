---
description: Move the current conversation to a different working directory
argument-hint: /path/to/new/directory
allowed-tools: ["Bash(*)", "Read", "AskUserQuestion"]
---

# Move Conversation to New Directory

Move the current conversation to a different working directory. This is useful when you've reorganized your project files and want to continue the conversation from the new location.

## Your Task

### Step 1: Validate Target Directory

The user wants to move this conversation to: `$ARGUMENTS`

**If $ARGUMENTS is empty:**
Use AskUserQuestion to ask:
- question: "Where would you like to move this conversation to?"
- description: "Enter the absolute path to the target directory (e.g., ~/Documents/my-project)"

Once you have the target path:

1. Expand the path safely (resolve `~` without eval) and validate it is absolute:
   ```bash
   target_dir="$ARGUMENTS"
   # Safe tilde expansion without eval
   case "$target_dir" in
     ~/*) target_dir="$HOME/${target_dir#\~/}" ;;
     ~)   target_dir="$HOME" ;;
   esac
   # Resolve to canonical absolute path
   target_dir="$(cd "$target_dir" 2>/dev/null && pwd -P)" || { echo "ERROR: Cannot resolve path: $ARGUMENTS"; exit 1; }
   # Verify it is absolute
   case "$target_dir" in
     /*) echo "Target directory: $target_dir" ;;
     *)  echo "ERROR: Target must be an absolute path. Got: $target_dir"; exit 1 ;;
   esac
   ```
2. Verify the target directory exists:
   ```bash
   test -d "$target_dir" && echo "Directory exists" || echo "Directory does not exist"
   ```
3. If it does not exist, ask the user if they want to create it. If yes, create it with `mkdir -p`.

### Step 2: Identify Current Session

Get the current session ID and source project directory:

```bash
# Get the current working directory encoded as Claude stores it
cwd="$(pwd -P)"
encoded_cwd=$(printf '%s' "$cwd" | sed 's|/|-|g')
project_dir="$HOME/.claude/projects/$encoded_cwd"
echo "Source project dir: $project_dir"
ls -lt "$project_dir"/*.jsonl 2>/dev/null | head -5
```

The most recently modified `.jsonl` file is the current (or most recent) conversation session.

### Step 3: Identify Target Project Directory

```bash
# Encode the target directory path the same way Claude does
encoded_target=$(printf '%s' "$target_dir" | sed 's|/|-|g')
target_project_dir="$HOME/.claude/projects/$encoded_target"
echo "Target project dir: $target_project_dir"
```

### Step 4: Check for Conflicts

```bash
# Check if target already has conversations
if ls "$target_project_dir"/*.jsonl 2>/dev/null | head -1 > /dev/null 2>&1; then
  echo "WARNING: Target directory already has existing conversations"
  ls -lt "$target_project_dir"/*.jsonl | head -5
else
  echo "No existing conversations in target directory"
fi
```

### Step 5: Show Summary and Confirm

Before moving, show the user a summary:

- Source directory: `{cwd}`
- Target directory: `{target_dir}`
- Session file to move: `{session_file}`
- File size: `{size}`
- **Note**: The original conversation will be removed from the source directory

Check if the file is large and warn if needed:
```bash
size_bytes=$(stat -f "%z" "$project_dir/$session_file" 2>/dev/null || stat -c "%s" "$project_dir/$session_file" 2>/dev/null)
if [ "$size_bytes" -gt 10485760 ]; then
  echo "Note: This conversation file is large ($(du -h "$project_dir/$session_file" | cut -f1)). The move may take a moment."
fi
```

Use AskUserQuestion to confirm:
- question: "Ready to move this conversation? The original will be removed."
- description: "This moves the conversation to the target directory. You can resume it by running `claude --resume` from the new directory."

### Step 6: Move the Conversation

Execute the move with error handling:

```bash
# Create the target project directory if it doesn't exist
mkdir -p "$target_project_dir" || { echo "ERROR: Failed to create target directory"; exit 1; }

# Move the session JSONL file
mv "$project_dir/$session_file" "$target_project_dir/$session_file" || { echo "ERROR: Failed to move session file"; exit 1; }

# Move the session companion directory if it exists (contains subagent data, tool results)
if [ -d "$project_dir/${session_file%.jsonl}" ]; then
  mv "$project_dir/${session_file%.jsonl}" "$target_project_dir/${session_file%.jsonl}" || { echo "ERROR: Failed to move companion directory"; exit 1; }
fi

echo "Move complete!"
```

### Step 7: Update CWD References in Moved Conversation

After moving, update the `cwd` fields so Claude associates it with the new directory. Use Python for safe string replacement (avoids sed injection with special characters in paths):

```bash
python3 -c "
import sys
filepath, old_cwd, new_cwd = sys.argv[1], sys.argv[2], sys.argv[3]
with open(filepath, 'r') as f:
    data = f.read()
data = data.replace('\"cwd\":\"' + old_cwd + '\"', '\"cwd\":\"' + new_cwd + '\"')
with open(filepath, 'w') as f:
    f.write(data)
print('Updated cwd references in moved conversation')
" "$target_project_dir/$session_file" "$cwd" "$target_dir" || { echo "ERROR: Failed to update cwd references"; exit 1; }
```

### Step 8: Check for Memory Files

```bash
if [ -f "$project_dir/CLAUDE.md" ]; then
  echo ""
  echo "Note: The source directory has a CLAUDE.md memory file."
  echo "This was NOT moved. To move it manually:"
  echo "  mv \"$project_dir/CLAUDE.md\" \"$target_project_dir/CLAUDE.md\""
fi
if [ -d "$project_dir/memory" ]; then
  echo ""
  echo "Note: The source directory has a memory/ folder."
  echo "This was NOT moved. To move it manually:"
  echo "  mv \"$project_dir/memory\" \"$target_project_dir/memory\""
fi
```

### Step 9: Confirm Success

Tell the user:

**Conversation moved successfully!**

- From: `{cwd}`
- To: `{target_dir}`

To resume the moved conversation:
```
cd {target_dir}
claude --resume
```

The conversation retains full history. The original has been removed from the source directory.

**Important**: This current session is still running from the old directory. After this session ends, use the command above to continue from the new location.
