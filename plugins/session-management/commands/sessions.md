---
description: List all conversation sessions for the current or specified directory
argument-hint: Optional /path/to/directory
allowed-tools: ["Bash(ls:*)", "Bash(du:*)", "Bash(stat:*)", "Bash(basename:*)", "Bash(grep:*)", "Bash(python3:*)", "Bash(test:*)", "Bash(wc:*)"]
---

# List Conversation Sessions

Show all conversation sessions stored for a working directory.

## Your Task

### Step 1: Determine Target Directory

```bash
if [ -n "$ARGUMENTS" ]; then
  target_dir="$ARGUMENTS"
  # Safe tilde expansion without eval
  case "$target_dir" in
    ~/*) target_dir="$HOME/${target_dir#\~/}" ;;
    ~)   target_dir="$HOME" ;;
  esac
  # Resolve to canonical absolute path
  target_dir="$(cd "$target_dir" 2>/dev/null && pwd -P)" || { echo "ERROR: Cannot resolve path: $ARGUMENTS"; exit 1; }
else
  target_dir="$(pwd -P)"
fi
encoded_dir=$(printf '%s' "$target_dir" | sed 's|/|-|g')
project_dir="$HOME/.claude/projects/$encoded_dir"
echo "Looking for sessions in: $target_dir"
echo "Storage path: $project_dir"
```

### Step 2: List Sessions

```bash
if [ -d "$project_dir" ]; then
  echo ""
  echo "Sessions (most recent first):"
  echo "=============================="
  ls -t "$project_dir"/*.jsonl 2>/dev/null | while IFS= read -r f; do
    [ -z "$f" ] && continue
    session_id=$(basename "$f" .jsonl)
    size=$(du -h "$f" | cut -f1)
    modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || (stat -c "%y" "$f" 2>/dev/null | cut -d. -f1))
    # Get the first user message as a preview
    preview=$(grep -m1 '"type":"user"' "$f" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.readline())
    c = d.get('message', {}).get('content', '')
    print((c[:80] if isinstance(c, str) else str(c)[:80]))
except Exception:
    print('(no preview)')
" 2>/dev/null || echo "(no preview)")
    echo ""
    echo "  ID: $session_id"
    echo "  Modified: $modified"
    echo "  Size: $size"
    echo "  Preview: $preview"
  done
else
  echo "No sessions found for this directory."
  echo ""
  echo "Available project directories:"
  ls -dt "$HOME/.claude/projects"/*/ 2>/dev/null | head -10 | while IFS= read -r dir; do
    dirname=$(basename "$dir")
    decoded=$(printf '%s' "$dirname" | sed 's|-|/|g')
    count=$(ls "$dir"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
    echo "  $decoded ($count sessions)"
  done
fi
```

Present the results in a clean, readable format. If no sessions are found, suggest the user check the directory path.
