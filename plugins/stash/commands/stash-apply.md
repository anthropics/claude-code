---
allowed-tools: Bash(python3:*)
description: Apply a stashed message by ID (and remove it)
---

## Your task

Apply and remove a specific message from `~/.claude/stash.jsonl` by its ID. The ID is `$ARGUMENTS`.

If `$ARGUMENTS` is empty, reply with: `Usage: /stash-apply <id>` and stop.

Run a single bash command:

```bash
python3 -c "
import json, os, sys

stash_path = os.path.expanduser('~/.claude/stash.jsonl')
target_id = int(sys.argv[1])

if not os.path.exists(stash_path):
    print('Stash is empty.')
    sys.exit(0)

entries = []
found = None
with open(stash_path, 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            entry = json.loads(line)
            if entry['id'] == target_id:
                found = entry
            else:
                entries.append(entry)

if not found:
    print(f'Stash #{target_id} not found.')
    sys.exit(0)

with open(stash_path, 'w') as f:
    for e in entries:
        f.write(json.dumps(e) + '\n')

print(f'#{found[\"id\"]}  {found[\"timestamp\"]}')
print()
print(found['message'])
" "$ARGUMENTS"
```

Print only the output of that command. Do not send any other text.
