---
allowed-tools: Bash(python3:*), Bash(cp:*), Bash(ls:*), Bash(uuidgen:*)
description: Branch the current conversation (like git branch)
argument-hint: <branch-name>
---

You are branching the current conversation. This creates a snapshot of the entire conversation that can be resumed independently, like `git branch`.

Branch name: $ARGUMENTS

## Steps

Run the following Python script in a single Bash call. Pass the branch name as an argument. This script will:
1. Find the current session (most recently modified .jsonl in the project sessions dir)
2. Copy it to a new UUID
3. Copy the session subdirectory if it exists (subagents, tool-results)
4. Add an entry to sessions-index.json with the branch name as customTitle

```bash
python3 -c '
import json, os, sys, uuid, shutil
from datetime import datetime, timezone

branch_name = sys.argv[1] if len(sys.argv) > 1 else ""
if not branch_name:
    print("ERROR: Branch name is required. Usage: /branch <name>")
    sys.exit(1)

# Encode project path
project_path = os.getcwd()
encoded = project_path.replace("/", "-")
sessions_dir = os.path.expanduser(f"~/.claude/projects/{encoded}")

if not os.path.isdir(sessions_dir):
    print(f"ERROR: Sessions directory not found: {sessions_dir}")
    sys.exit(1)

# Find current session (most recently modified .jsonl)
jsonl_files = [f for f in os.listdir(sessions_dir) if f.endswith(".jsonl")]
if not jsonl_files:
    print("ERROR: No session files found.")
    sys.exit(1)

jsonl_files.sort(key=lambda f: os.path.getmtime(os.path.join(sessions_dir, f)), reverse=True)
current_file = jsonl_files[0]
current_id = current_file.replace(".jsonl", "")
current_path = os.path.join(sessions_dir, current_file)

# Generate new session ID
new_id = str(uuid.uuid4())
new_path = os.path.join(sessions_dir, f"{new_id}.jsonl")

# Copy session file
shutil.copy2(current_path, new_path)

# Copy session subdirectory if it exists
current_subdir = os.path.join(sessions_dir, current_id)
if os.path.isdir(current_subdir):
    new_subdir = os.path.join(sessions_dir, new_id)
    shutil.copytree(current_subdir, new_subdir)

# Read first user message for firstPrompt
first_prompt = ""
line_count = 0
with open(current_path) as f:
    for line in f:
        line_count += 1
        try:
            obj = json.loads(line)
            if obj.get("type") == "user" and obj.get("message", {}).get("role") == "user":
                content = obj["message"].get("content", "")
                if isinstance(content, str):
                    first_prompt = content[:200]
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            first_prompt = block["text"][:200]
                            break
                break
        except json.JSONDecodeError:
            continue

# Update sessions-index.json
index_path = os.path.join(sessions_dir, "sessions-index.json")
now = datetime.now(timezone.utc).isoformat()

if os.path.exists(index_path):
    with open(index_path) as f:
        index = json.load(f)
else:
    index = {"version": 1, "entries": [], "originalPath": project_path}

new_entry = {
    "sessionId": new_id,
    "fullPath": new_path,
    "fileMtime": int(os.path.getmtime(new_path) * 1000),
    "firstPrompt": first_prompt,
    "customTitle": branch_name,
    "summary": f"Branch: {branch_name}",
    "messageCount": line_count,
    "created": now,
    "modified": now,
    "gitBranch": "",
    "projectPath": project_path,
    "isSidechain": False
}

index["entries"].append(new_entry)

with open(index_path, "w") as f:
    json.dump(index, f, indent=2)

file_size = os.path.getsize(new_path)
size_str = f"{file_size / 1024:.0f}KB" if file_size < 1048576 else f"{file_size / 1048576:.1f}MB"

print(f"BRANCH_NAME={branch_name}")
print(f"BRANCH_ID={new_id}")
print(f"SOURCE_ID={current_id}")
print(f"SIZE={size_str}")
print(f"MESSAGES={line_count}")
' "$ARGUMENTS"
```

After the script runs successfully, report to the user:

**Branched: `{branch_name}`**
- Session snapshot created with all conversation history
- To switch to this branch later: `claude --resume "{branch_name}"`
- To continue here (original): just keep chatting
- Current session remains unchanged

If the script fails, report the error clearly.

Do NOT do anything else. Do not read files, explore code, or make any other tool calls. Just run the script and report the result.
