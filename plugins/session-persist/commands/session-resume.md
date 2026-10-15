---
description: Restore context from a previously saved session
argument-hint: <session-id>
allowed-tools: Bash(python3:*)
---

Loading session: $ARGUMENTS

!`python3 -c "
import json, os, sys

sid  = '$ARGUMENTS'.strip()
if not sid:
    print('Provide a session ID. Run /session-list to see available sessions.')
    sys.exit(0)

base = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
path = os.path.join(base, '.claude', 'sessions', sid + '.json')

if not os.path.exists(path):
    print(f'No saved session found with ID: {sid}')
    print('Run /session-list to see available sessions.')
    sys.exit(0)

with open(path) as f:
    d = json.load(f)

print(f'=== Session {sid} ===')
print(f'Saved at : {d.get(\"saved_at\", \"unknown\")}')
if d.get('ended_at'):
    print(f'Ended at : {d[\"ended_at\"]}')
print()
print('Last task:')
print(d.get('last_task', '(not recorded)'))
print()
print('Context summary:')
print(d.get('summary', '(not recorded)'))
"`

Based on the session data above, restore the working context. Summarise what was being worked on and confirm you are ready to continue from where this session left off.

If the user wants a future new session to auto-resume this context automatically, advise them to run:

\`\`\`bash
echo "<session-id>" > .claude/.session-resume
\`\`\`

A new session started after that will pick up the saved context without any extra command.
