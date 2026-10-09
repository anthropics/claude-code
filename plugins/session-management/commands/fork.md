---
description: Fork the current conversation to a different working directory
argument-hint: /path/to/new/directory
allowed-tools: ["Bash(*)", "Read", "AskUserQuestion"]
---

# Fork Conversation to New Directory

Fork (copy) the current conversation to a different working directory so you can continue it there with full history preserved.

## Your Task

### Step 1: Validate Target Directory

The user wants to fork this conversation to: `$ARGUMENTS`

**If $ARGUMENTS is empty:**
Use AskUserQuestion to ask:
- question: "Where would you like to fork this conversation to?"
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

### Step 4: Show Summary and Confirm

Before copying, show the user a summary:

- Source directory: `{cwd}`
- Target directory: `{target_dir}`
- Session file to copy: `{session_file}`
- File size: `{size}`

Check if the file is large and warn if needed:
```bash
size_bytes=$(stat -f "%z" "$project_dir/$session_file" 2>/dev/null || stat -c "%s" "$project_dir/$session_file" 2>/dev/null)
if [ "$size_bytes" -gt 10485760 ]; then
  echo "Note: This conversation file is large ($(du -h "$project_dir/$session_file" | cut -f1)). The copy may take a moment."
fi
```

Use AskUserQuestion to confirm:
- question: "Ready to fork this conversation?"
- description: "This will copy the conversation to the target directory. The original stays intact. You can resume it by running `claude --resume` from the new directory."

### Step 5: Fork the Conversation

Execute the fork with error handling:

```bash
# Create the target project directory if it doesn't exist
mkdir -p "$target_project_dir" || { echo "ERROR: Failed to create target directory"; exit 1; }

# Copy the session JSONL file
cp "$project_dir/$session_file" "$target_project_dir/$session_file" || { echo "ERROR: Failed to copy session file"; exit 1; }

# Copy the session companion directory if it exists (contains subagent data, tool results)
if [ -d "$project_dir/${session_file%.jsonl}" ]; then
  cp -r "$project_dir/${session_file%.jsonl}" "$target_project_dir/${session_file%.jsonl}" || { echo "ERROR: Failed to copy companion directory"; exit 1; }
fi

echo "Fork complete!"
```

### Step 6: Update CWD References in Forked Conversation

After copying, update the `cwd` fields in the forked conversation so Claude associates it with the new directory. Use Python for safe string replacement (avoids sed injection with special characters in paths):

```bash
python3 -c "
import sys
filepath, old_cwd, new_cwd = sys.argv[1], sys.argv[2], sys.argv[3]
with open(filepath, 'r') as f:
    data = f.read()
data = data.replace('\"cwd\":\"' + old_cwd + '\"', '\"cwd\":\"' + new_cwd + '\"')
with open(filepath, 'w') as f:
    f.write(data)
print('Updated cwd references in forked conversation')
" "$target_project_dir/$session_file" "$cwd" "$target_dir" || { echo "ERROR: Failed to update cwd references"; exit 1; }
```

### Step 7: Check for Memory Files

```bash
if [ -f "$project_dir/CLAUDE.md" ]; then
  echo ""
  echo "Note: The source directory has a CLAUDE.md memory file."
  echo "This was NOT copied. To copy it manually:"
  echo "  cp \"$project_dir/CLAUDE.md\" \"$target_project_dir/CLAUDE.md\""
fi
if [ -d "$project_dir/memory" ]; then
  echo ""
  echo "Note: The source directory has a memory/ folder."
  echo "This was NOT copied. To copy it manually:"
  echo "  cp -r \"$project_dir/memory\" \"$target_project_dir/memory\""
fi
```

### Step 8: Confirm Success

Tell the user:

**Conversation forked successfully!**

- Original: `{cwd}` (unchanged)
- Fork: `{target_dir}`

To resume the forked conversation:
```
cd {target_dir}
claude --resume
```

The forked conversation has full history preserved. Both the original and the fork can continue independently.
