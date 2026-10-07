---
description: List all saved sessions for this project
allowed-tools: Bash(python3:*)
---

!`python3 -c "
import json, os, glob, sys

base = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
sessions_dir = os.path.join(base, '.claude', 'sessions')

if not os.path.isdir(sessions_dir):
    print('No sessions directory found — no sessions have been saved yet.')
    sys.exit(0)

files = sorted(glob.glob(os.path.join(sessions_dir, '*.json')), reverse=True)

if not files:
    print('No saved sessions found. Use /session-save to checkpoint the current session.')
    sys.exit(0)

print(f'Found {len(files)} saved session(s):\n')
for fp in files[:20]:
    try:
        with open(fp) as f:
            d = json.load(f)
        sid   = d.get('session_id', os.path.basename(fp).replace('.json', ''))
        ts    = d.get('saved_at', 'unknown')[:19].replace('T', ' ')
        ended = d.get('ended_at', '')[:19].replace('T', ' ')
        task  = d.get('last_task', '')[:80]
        if len(d.get('last_task', '')) > 80:
            task += '...'
        print(f'{sid}')
        print(f'  Saved:     {ts} UTC' + (f'  |  Ended: {ended} UTC' if ended else ''))
        if task:
            print(f'  Last task: {task}')
        print()
    except Exception as e:
        print(f'  (could not read {os.path.basename(fp)}: {e})\n')
"`

Display the sessions above. To restore a session run \`/session-resume <session-id>\`.
