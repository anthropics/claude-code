---
allowed-tools: Bash(mkdir:*), Bash(python3:*)
description: Stash a message for later use
---

## Your task

Stash the user's message to `~/.claude/stash.jsonl`. The message is everything in `$ARGUMENTS`.

If `$ARGUMENTS` is empty, reply with: `Usage: /stash <message>` and stop.

Run a single bash command to do the following atomically:

1. Create `~/.claude/` if it doesn't exist
2. Read the current max ID from the stash file (or start at 0 if the file doesn't exist)
3. Append a new JSON line with `{"id": <next_id>, "message": "<message>", "timestamp": "<ISO8601>"}`
4. Print: `Message stashed. #<id>`

Use `python3` for this:

```bash
python3 -c "
import json, os, sys
from datetime import datetime, timezone

stash_path = os.path.expanduser('~/.claude/stash.jsonl')
os.makedirs(os.path.dirname(stash_path), exist_ok=True)

max_id = -1
if os.path.exists(stash_path):
    with open(stash_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line:
                entry = json.loads(line)
                max_id = max(max_id, entry['id'])

new_id = max_id + 1
entry = {
    'id': new_id,
    'message': sys.argv[1],
    'timestamp': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
}

with open(stash_path, 'a') as f:
    f.write(json.dumps(entry) + '\n')

msg = sys.argv[1]
if len(msg) > 100:
    # Find the nearest word boundary around 100 chars
    cut = msg.rfind(' ', 0, 110)
    if cut <= 50:
        cut = 100
    preview = msg[:cut] + '...'
else:
    preview = msg
preview = preview.replace('\n', ' ')

print('Message stashed.')
print(f'#{new_id}  {preview}')
" "$ARGUMENTS"
```

Print only the output of that command. Do not send any other text.
