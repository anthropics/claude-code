---
allowed-tools: Bash(python3:*)
description: List all stashed messages
---

## Your task

List all messages in `~/.claude/stash.jsonl`.

Run a single bash command:

```bash
python3 -c "
import json, os

stash_path = os.path.expanduser('~/.claude/stash.jsonl')

if not os.path.exists(stash_path):
    print('Stash is empty.')
    raise SystemExit(0)

entries = []
with open(stash_path, 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            entries.append(json.loads(line))

if not entries:
    print('Stash is empty.')
    raise SystemExit(0)

for e in entries:
    msg = e['message']
    preview = (msg[:77] + '...') if len(msg) > 80 else msg
    preview = preview.replace('\n', ' ')
    print(f'#{e[\"id\"]}  {e[\"timestamp\"]}  {preview}')

print(f'\n{len(entries)} stashed message(s)')
"
```

Print only the output of that command. Do not send any other text.
