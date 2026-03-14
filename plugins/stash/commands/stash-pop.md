---
allowed-tools: Bash(python3:*)
description: Pop the last stashed message (apply and remove)
---

## Your task

Pop the last message from `~/.claude/stash.jsonl` — print it and remove it from the file.

Run a single bash command:

```bash
python3 -c "
import json, os, sys

stash_path = os.path.expanduser('~/.claude/stash.jsonl')

if not os.path.exists(stash_path):
    print('Stash is empty.')
    sys.exit(0)

entries = []
with open(stash_path, 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            entries.append(json.loads(line))

if not entries:
    print('Stash is empty.')
    sys.exit(0)

last = entries.pop()

with open(stash_path, 'w') as f:
    for e in entries:
        f.write(json.dumps(e) + '\n')

print(f'#{last[\"id\"]}  {last[\"timestamp\"]}')
print()
print(last['message'])
"
```

Print only the output of that command. Do not send any other text.
